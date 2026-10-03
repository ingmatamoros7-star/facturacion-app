const express = require('express');
const router = express.Router();
const db = require('../database');

// Listar todos los clientes
router.get('/', (req, res) => {
  const clientes = db.prepare('SELECT * FROM clientes ORDER BY nombre').all();
  res.json(clientes);
});

// Obtener un cliente
router.get('/:id', (req, res) => {
  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);
  if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
  res.json(cliente);
});

// Crear cliente
router.post('/', (req, res) => {
  const { nombre, telefono, email, direccion, notas } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });

  const result = db.prepare(
    'INSERT INTO clientes (nombre, telefono, email, direccion, notas) VALUES (?, ?, ?, ?, ?)'
  ).run(nombre, telefono || null, email || null, direccion || null, notas || null);

  res.status(201).json({ id: result.lastInsertRowid, nombre, telefono, email, direccion, notas });
});

// Actualizar cliente
router.put('/:id', (req, res) => {
  const { nombre, telefono, email, direccion, notas } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });

  const result = db.prepare(
    'UPDATE clientes SET nombre=?, telefono=?, email=?, direccion=?, notas=? WHERE id=?'
  ).run(nombre, telefono || null, email || null, direccion || null, notas || null, req.params.id);

  if (result.changes === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
  res.json({ id: Number(req.params.id), nombre, telefono, email, direccion, notas });
});

// Eliminar cliente
router.delete('/:id', (req, res) => {
  const ventas = db.prepare('SELECT COUNT(*) as count FROM ventas WHERE cliente_id = ?').get(req.params.id);
  if (ventas.count > 0) {
    return res.status(400).json({ error: 'No se puede eliminar: el cliente tiene ventas registradas' });
  }

  const result = db.prepare('DELETE FROM clientes WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
  res.json({ message: 'Cliente eliminado' });
});

module.exports = router;
