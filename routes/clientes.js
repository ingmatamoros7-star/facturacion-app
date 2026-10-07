const express = require('express');
const router = express.Router();
const db = require('../database');
const { enriquecerVenta } = require('../lib/estado');

// Listar clientes con su saldo pendiente
router.get('/', async (req, res, next) => {
  try {
    const clientes = await db.all(
      `SELECT c.*,
         COALESCE((SELECT SUM(v.total - v.pagado) FROM ventas v
                   WHERE v.cliente_id = c.id AND v.total > v.pagado), 0) AS saldo_pendiente
       FROM clientes c
       ORDER BY c.nombre`
    );
    res.json(clientes);
  } catch (e) { next(e); }
});

// Obtener un cliente
router.get('/:id', async (req, res, next) => {
  try {
    const cliente = await db.get('SELECT * FROM clientes WHERE id = ?', [req.params.id]);
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(cliente);
  } catch (e) { next(e); }
});

// Historial de compras + saldo + cartera del cliente
router.get('/:id/historial', async (req, res, next) => {
  try {
    const cliente = await db.get('SELECT * FROM clientes WHERE id = ?', [req.params.id]);
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });

    const ventas = (await db.all('SELECT * FROM ventas WHERE cliente_id = ? ORDER BY fecha DESC', [req.params.id]))
      .map(enriquecerVenta);

    const saldoPendiente = ventas.reduce((s, v) => s + (v.saldo > 0 ? v.saldo : 0), 0);
    const carteraVencida = ventas.filter((v) => v.estado === 'vencido').reduce((s, v) => s + v.saldo, 0);

    res.json({
      cliente,
      ventas,
      saldo_pendiente: Math.round(saldoPendiente * 100) / 100,
      cartera_vencida: Math.round(carteraVencida * 100) / 100,
    });
  } catch (e) { next(e); }
});

// Crear cliente
router.post('/', async (req, res, next) => {
  try {
    const { nombre, identificacion, telefono, email, direccion, notas, activo } = req.body;
    if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre es requerido' });

    const result = await db.run(
      `INSERT INTO clientes (nombre, identificacion, telefono, email, direccion, notas, activo)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [nombre.trim(), identificacion || null, telefono || null, email || null, direccion || null, notas || null,
        activo === 0 || activo === false ? 0 : 1]
    );

    res.status(201).json(await db.get('SELECT * FROM clientes WHERE id = ?', [result.lastInsertRowid]));
  } catch (e) { next(e); }
});

// Actualizar cliente
router.put('/:id', async (req, res, next) => {
  try {
    const { nombre, identificacion, telefono, email, direccion, notas, activo } = req.body;
    if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre es requerido' });

    const result = await db.run(
      `UPDATE clientes SET nombre=?, identificacion=?, telefono=?, email=?, direccion=?, notas=?, activo=?
       WHERE id=?`,
      [nombre.trim(), identificacion || null, telefono || null, email || null, direccion || null, notas || null,
        activo === 0 || activo === false ? 0 : 1, req.params.id]
    );

    if (result.changes === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(await db.get('SELECT * FROM clientes WHERE id = ?', [req.params.id]));
  } catch (e) { next(e); }
});

// Eliminar cliente (solo si no tiene ventas)
router.delete('/:id', async (req, res, next) => {
  try {
    const ventas = await db.get('SELECT COUNT(*) AS count FROM ventas WHERE cliente_id = ?', [req.params.id]);
    if (ventas.count > 0) {
      return res.status(400).json({ error: 'No se puede eliminar: el cliente tiene ventas registradas. Puedes desactivarlo.' });
    }
    const result = await db.run('DELETE FROM clientes WHERE id = ?', [req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json({ message: 'Cliente eliminado' });
  } catch (e) { next(e); }
});

module.exports = router;
