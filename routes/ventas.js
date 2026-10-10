const express = require('express');
const router = express.Router();
const db = require('../database');
const { enriquecerVenta } = require('../lib/estado');

const FORMAS_PAGO = ['efectivo', 'transferencia', 'tarjeta', 'credito'];
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Listar ventas con filtros opcionales: desde, hasta, cliente_id, estado
router.get('/', async (req, res, next) => {
  try {
    const { desde, hasta, cliente_id, estado } = req.query;
    const where = [];
    const params = [];
    if (desde) { where.push('date(v.fecha) >= date(?)'); params.push(desde); }
    if (hasta) { where.push('date(v.fecha) <= date(?)'); params.push(hasta); }
    if (cliente_id) { where.push('v.cliente_id = ?'); params.push(cliente_id); }

    const sql = `
      SELECT v.*, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono
      FROM ventas v
      JOIN clientes c ON v.cliente_id = c.id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY v.fecha DESC, v.id DESC`;

    let ventas = (await db.all(sql, params)).map(enriquecerVenta);
    if (estado) ventas = ventas.filter((v) => v.estado === estado);
    res.json(ventas);
  } catch (e) { next(e); }
});

// Obtener una venta con detalle + pagos
router.get('/:id', async (req, res, next) => {
  try {
    const venta = await db.get(
      `SELECT v.*, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono, c.identificacion AS cliente_identificacion
       FROM ventas v JOIN clientes c ON v.cliente_id = c.id WHERE v.id = ?`,
      [req.params.id]
    );
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });

    const detalles = await db.all(
      `SELECT dv.*, p.nombre AS producto_nombre
       FROM detalle_ventas dv LEFT JOIN productos p ON dv.producto_id = p.id
       WHERE dv.venta_id = ?`,
      [req.params.id]
    );
    const pagos = await db.all('SELECT * FROM pagos WHERE venta_id = ? ORDER BY fecha DESC', [req.params.id]);
    res.json({ ...enriquecerVenta(venta), detalles, pagos });
  } catch (e) { next(e); }
});

// Crear venta
router.post('/', async (req, res, next) => {
  try {
    const { cliente_id, items, forma_pago, descuento, fecha, fecha_vencimiento, pagado_inicial, notas } = req.body;

    if (!cliente_id) return res.status(400).json({ error: 'Se requiere un cliente' });
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: 'Se requiere al menos un producto o servicio' });
    }

    const cliente = await db.get('SELECT id FROM clientes WHERE id = ?', [cliente_id]);
    if (!cliente) return res.status(400).json({ error: 'Cliente no encontrado' });

    const formaPago = FORMAS_PAGO.includes(forma_pago) ? forma_pago : 'efectivo';
    const esCredito = formaPago === 'credito';
    if (esCredito && !fecha_vencimiento) {
      return res.status(400).json({ error: 'Las ventas a crédito requieren fecha de vencimiento' });
    }

    // Calcular líneas
    let subtotal = 0;
    const lineas = [];
    for (const item of items) {
      const cantidad = Number(item.cantidad);
      if (!cantidad || cantidad <= 0) return res.status(400).json({ error: 'Cantidad inválida en un producto' });

      let precio = Number(item.precio_unitario);
      let descripcion = item.descripcion || null;

      if (item.producto_id) {
        const producto = await db.get('SELECT * FROM productos WHERE id = ?', [item.producto_id]);
        if (!producto) return res.status(400).json({ error: 'Producto no encontrado' });
        if (isNaN(precio)) precio = producto.precio_unitario;
        if (!descripcion) descripcion = producto.nombre;
      }

      if (isNaN(precio) || precio < 0) return res.status(400).json({ error: 'Precio inválido en un producto' });
      if (!descripcion) return res.status(400).json({ error: 'Cada línea requiere producto o descripción' });

      const subLinea = round2(precio * cantidad);
      subtotal += subLinea;
      lineas.push({
        producto_id: item.producto_id || null,
        descripcion,
        cantidad,
        precio_unitario: round2(precio),
        subtotal: subLinea,
      });
    }

    subtotal = round2(subtotal);
    let desc = round2(descuento);
    if (desc < 0) desc = 0;
    if (desc > subtotal) desc = subtotal;
    const total = round2(subtotal - desc);

    let pagado = 0;
    if (esCredito) {
      pagado = round2(pagado_inicial);
      if (pagado < 0) pagado = 0;
      if (pagado > total) pagado = total;
    } else {
      pagado = total;
    }

    let estado = 'pendiente';
    if (pagado >= total - 0.005) estado = 'pagado';
    else if (pagado > 0.005) estado = 'parcial';

    const trx = await db.tx();
    try {
      const result = await trx.execute({
        sql: `INSERT INTO ventas (cliente_id, fecha, subtotal, descuento, total, pagado, forma_pago, estado, fecha_vencimiento, notas)
              VALUES (?, COALESCE(?, CURRENT_TIMESTAMP), ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [cliente_id, fecha || null, subtotal, desc, total, pagado, formaPago, estado,
          esCredito ? fecha_vencimiento : null, notas || null],
      });
      const ventaId = Number(result.lastInsertRowid);
      const numero = 'V-' + String(ventaId).padStart(6, '0');
      await trx.execute({ sql: 'UPDATE ventas SET numero = ? WHERE id = ?', args: [numero, ventaId] });

      for (const l of lineas) {
        await trx.execute({
          sql: 'INSERT INTO detalle_ventas (venta_id, producto_id, descripcion, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
          args: [ventaId, l.producto_id, l.descripcion, l.cantidad, l.precio_unitario, l.subtotal],
        });
      }

      if (pagado > 0.005) {
        const metodoPago = esCredito ? 'efectivo' : formaPago;
        await trx.execute({
          sql: 'INSERT INTO pagos (venta_id, cliente_id, monto, metodo, notas) VALUES (?, ?, ?, ?, ?)',
          args: [ventaId, cliente_id, pagado, metodoPago, esCredito ? 'Pago inicial' : 'Pago de contado'],
        });
      }

      await trx.commit();
      res.status(201).json({ id: ventaId });
    } catch (err) {
      await trx.rollback();
      throw err;
    }
  } catch (e) { next(e); }
});

// Eliminar venta (y sus detalles/pagos)
router.delete('/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    const venta = await db.get('SELECT id FROM ventas WHERE id = ?', [id]);
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });

    const trx = await db.tx();
    try {
      await trx.execute({ sql: 'DELETE FROM pagos WHERE venta_id = ?', args: [id] });
      await trx.execute({ sql: 'DELETE FROM detalle_ventas WHERE venta_id = ?', args: [id] });
      await trx.execute({ sql: 'DELETE FROM ventas WHERE id = ?', args: [id] });
      await trx.commit();
    } catch (err) {
      await trx.rollback();
      throw err;
    }
    res.json({ message: 'Venta eliminada' });
  } catch (e) { next(e); }
});

module.exports = router;
