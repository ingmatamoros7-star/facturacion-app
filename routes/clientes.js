const express = require('express');
const router = express.Router();
const db = require('../database');
const { enriquecerVenta } = require('../lib/estado');

// Listar clientes con su saldo pendiente
router.get('/', (req, res) => {
  const clientes = db
    .prepare(
      `SELECT c.*,
         COALESCE((SELECT SUM(v.total - v.pagado) FROM ventas v
                   WHERE v.cliente_id = c.id AND v.total > v.pagado), 0) AS saldo_pendiente
       FROM clientes c
       ORDER BY c.nombre`
    )
    .all();
  res.json(clientes);
});

// Obtener un cliente
router.get('/:id', (req, res) => {
  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);
  if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
  res.json(cliente);
});

// Historial de compras + saldo + cartera del cliente
router.get('/:id/historial', (req, res) => {
  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);
  if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });

  const ventas = db
    .prepare('SELECT * FROM ventas WHERE cliente_id = ? ORDER BY fecha DESC')
    .all(req.params.id)
    .map(enriquecerVenta);

  const saldoPendiente = ventas.reduce((s, v) => s + (v.saldo > 0 ? v.saldo : 0), 0);
  const carteraVencida = ventas
    .filter((v) => v.estado === 'vencido')
    .reduce((s, v) => s + v.saldo, 0);

  res.json({
    cliente,
    ventas,
    saldo_pendiente: Math.round(saldoPendiente * 100) / 100,
    cartera_vencida: Math.round(carteraVencida * 100) / 100,
  });
});

// Crear cliente
router.post('/', (req, res) => {
  const { nombre, identificacion, telefono, email, direccion, notas, activo } = req.body;
  if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre es requerido' });

  const result = db
    .prepare(
      `INSERT INTO clientes (nombre, identificacion, telefono, email, direccion, notas, activo)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      nombre.trim(),
      identificacion || null,
      telefono || null,
      email || null,
      direccion || null,
      notas || null,
      activo === 0 || activo === false ? 0 : 1
    );

  res.status(201).json(db.prepare('SELECT * FROM clientes WHERE id = ?').get(result.lastInsertRowid));
});

// Actualizar cliente
router.put('/:id', (req, res) => {
  const { nombre, identificacion, telefono, email, direccion, notas, activo } = req.body;
  if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre es requerido' });

  const result = db
    .prepare(
      `UPDATE clientes SET nombre=?, identificacion=?, telefono=?, email=?, direccion=?, notas=?, activo=?
       WHERE id=?`
    )
    .run(
      nombre.trim(),
      identificacion || null,
      telefono || null,
      email || null,
      direccion || null,
      notas || null,
      activo === 0 || activo === false ? 0 : 1,
      req.params.id
    );

  if (result.changes === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
  res.json(db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id));
});

// Eliminar cliente (solo si no tiene ventas)
router.delete('/:id', (req, res) => {
  const ventas = db.prepare('SELECT COUNT(*) AS count FROM ventas WHERE cliente_id = ?').get(req.params.id);
  if (ventas.count > 0) {
    return res
      .status(400)
      .json({ error: 'No se puede eliminar: el cliente tiene ventas registradas. Puedes desactivarlo.' });
  }

  const result = db.prepare('DELETE FROM clientes WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
  res.json({ message: 'Cliente eliminado' });
});

module.exports = router;
