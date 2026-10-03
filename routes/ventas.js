const express = require('express');
const router = express.Router();
const db = require('../database');

// Cartera vencida - cuentas por cobrar (ANTES de /:id para que no lo capture)
router.get('/reportes/cartera-vencida', (req, res) => {
  const cartera = db.prepare(`
    SELECT
      v.id as venta_id,
      c.nombre as cliente_nombre,
      c.telefono as cliente_telefono,
      v.fecha,
      v.total,
      v.pagado,
      (v.total - v.pagado) as saldo_pendiente,
      CAST(julianday('now') - julianday(v.fecha) AS INTEGER) as dias_transcurridos
    FROM ventas v
    JOIN clientes c ON v.cliente_id = c.id
    WHERE v.total > v.pagado
    ORDER BY dias_transcurridos DESC
  `).all();

  const totalPendiente = cartera.reduce((sum, r) => sum + r.saldo_pendiente, 0);

  res.json({ cartera, totalPendiente });
});

// Listar ventas con nombre de cliente
router.get('/', (req, res) => {
  const ventas = db.prepare(`
    SELECT v.*, c.nombre as cliente_nombre
    FROM ventas v
    JOIN clientes c ON v.cliente_id = c.id
    ORDER BY v.fecha DESC
  `).all();
  res.json(ventas);
});

// Obtener una venta con detalle
router.get('/:id', (req, res) => {
  const venta = db.prepare(`
    SELECT v.*, c.nombre as cliente_nombre
    FROM ventas v
    JOIN clientes c ON v.cliente_id = c.id
    WHERE v.id = ?
  `).get(req.params.id);

  if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });

  const detalles = db.prepare(`
    SELECT dv.*, p.nombre as producto_nombre
    FROM detalle_ventas dv
    JOIN productos p ON dv.producto_id = p.id
    WHERE dv.venta_id = ?
  `).all(req.params.id);

  const pagos = db.prepare('SELECT * FROM pagos WHERE venta_id = ? ORDER BY fecha DESC').all(req.params.id);

  res.json({ ...venta, detalles, pagos });
});

// Crear venta
router.post('/', (req, res) => {
  const { cliente_id, items, notas } = req.body;

  if (!cliente_id || !items || !items.length) {
    return res.status(400).json({ error: 'Se requiere cliente y al menos un producto' });
  }

  // Verificar que el cliente existe
  const cliente = db.prepare('SELECT id FROM clientes WHERE id = ?').get(cliente_id);
  if (!cliente) return res.status(400).json({ error: 'Cliente no encontrado' });

  // Calcular total
  let total = 0;
  const itemsConPrecio = items.map(item => {
    const producto = db.prepare('SELECT * FROM productos WHERE id = ?').get(item.producto_id);
    if (!producto) throw new Error(`Producto ${item.producto_id} no encontrado`);
    const precio = producto.precio_unitario;
    const subtotal = precio * item.cantidad;
    total += subtotal;
    return { ...item, precio_unitario: precio, subtotal };
  });

  const insertVenta = db.prepare(
    'INSERT INTO ventas (cliente_id, total, notas) VALUES (?, ?, ?)'
  );
  const insertDetalle = db.prepare(
    'INSERT INTO detalle_ventas (venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?)'
  );

  const crearVenta = db.transaction(() => {
    const result = insertVenta.run(cliente_id, total, notas || null);
    const ventaId = result.lastInsertRowid;

    for (const item of itemsConPrecio) {
      insertDetalle.run(ventaId, item.producto_id, item.cantidad, item.precio_unitario, item.subtotal);
    }

    return ventaId;
  });

  try {
    const ventaId = crearVenta();
    res.status(201).json({ id: ventaId, total });
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
