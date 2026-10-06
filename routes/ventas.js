const express = require('express');
const router = express.Router();
const db = require('../database');
const { enriquecerVenta } = require('../lib/estado');

const FORMAS_PAGO = ['efectivo', 'transferencia', 'tarjeta', 'credito'];

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

// Listar ventas con filtros opcionales: desde, hasta, cliente_id, estado
router.get('/', (req, res) => {
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

  let ventas = db.prepare(sql).all(...params).map(enriquecerVenta);
  if (estado) ventas = ventas.filter((v) => v.estado === estado);
  res.json(ventas);
});

// Obtener una venta con detalle + pagos
router.get('/:id', (req, res) => {
  const venta = db
    .prepare(
      `SELECT v.*, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono, c.identificacion AS cliente_identificacion
       FROM ventas v JOIN clientes c ON v.cliente_id = c.id WHERE v.id = ?`
    )
    .get(req.params.id);
  if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });

  const detalles = db
    .prepare(
      `SELECT dv.*, p.nombre AS producto_nombre
       FROM detalle_ventas dv LEFT JOIN productos p ON dv.producto_id = p.id
       WHERE dv.venta_id = ?`
    )
    .all(req.params.id);

  const pagos = db.prepare('SELECT * FROM pagos WHERE venta_id = ? ORDER BY fecha DESC').all(req.params.id);

  res.json({ ...enriquecerVenta(venta), detalles, pagos });
});

// Crear venta
router.post('/', (req, res) => {
  const { cliente_id, items, forma_pago, descuento, fecha, fecha_vencimiento, pagado_inicial, notas } = req.body;

  if (!cliente_id) return res.status(400).json({ error: 'Se requiere un cliente' });
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'Se requiere al menos un producto o servicio' });
  }

  const cliente = db.prepare('SELECT id FROM clientes WHERE id = ?').get(cliente_id);
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

    let producto = null;
    let precio = Number(item.precio_unitario);
    let descripcion = item.descripcion || null;

    if (item.producto_id) {
      producto = db.prepare('SELECT * FROM productos WHERE id = ?').get(item.producto_id);
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

  // Pago
  let pagado = 0;
  if (esCredito) {
    pagado = round2(pagado_inicial);
    if (pagado < 0) pagado = 0;
    if (pagado > total) pagado = total;
  } else {
    pagado = total; // contado => pagado completo
  }

  let estado = 'pendiente';
  if (pagado >= total - 0.005) estado = 'pagado';
  else if (pagado > 0.005) estado = 'parcial';

  const crear = db.transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO ventas (cliente_id, fecha, subtotal, descuento, total, pagado, forma_pago, estado, fecha_vencimiento, notas)
         VALUES (?, COALESCE(?, CURRENT_TIMESTAMP), ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        cliente_id,
        fecha || null,
        subtotal,
        desc,
        total,
        pagado,
        formaPago,
        estado,
        esCredito ? fecha_vencimiento : null,
        notas || null
      );

    const ventaId = result.lastInsertRowid;
    const numero = 'V-' + String(ventaId).padStart(6, '0');
    db.prepare('UPDATE ventas SET numero = ? WHERE id = ?').run(numero, ventaId);

    const insDet = db.prepare(
      'INSERT INTO detalle_ventas (venta_id, producto_id, descripcion, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?, ?)'
    );
    for (const l of lineas) {
      insDet.run(ventaId, l.producto_id, l.descripcion, l.cantidad, l.precio_unitario, l.subtotal);
    }

    // Registrar el pago inicial / de contado
    if (pagado > 0.005) {
      const metodoPago = esCredito ? 'efectivo' : formaPago;
      db.prepare(
        'INSERT INTO pagos (venta_id, cliente_id, monto, metodo, notas) VALUES (?, ?, ?, ?, ?)'
      ).run(ventaId, cliente_id, pagado, metodoPago, esCredito ? 'Pago inicial' : 'Pago de contado');
    }

    return ventaId;
  });

  try {
    const ventaId = crear();
    res.status(201).json({ id: ventaId });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Eliminar venta
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM ventas WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Venta no encontrada' });
  res.json({ message: 'Venta eliminada' });
});

module.exports = router;
