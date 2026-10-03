const express = require('express');
const router = express.Router();
const db = require('../database');

// Listar productos
router.get('/', (req, res) => {
  const productos = db.prepare('SELECT * FROM productos ORDER BY nombre').all();
  res.json(productos);
});

// Obtener un producto
router.get('/:id', (req, res) => {
  const producto = db.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id);
  if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(producto);
});

// Crear producto
router.post('/', (req, res) => {
  const { nombre, descripcion, precio_unitario } = req.body;
  if (!nombre || precio_unitario == null) {
    return res.status(400).json({ error: 'Nombre y precio unitario son requeridos' });
  }

  const result = db.prepare(
    'INSERT INTO productos (nombre, descripcion, precio_unitario) VALUES (?, ?, ?)'
  ).run(nombre, descripcion || null, precio_unitario);

  res.status(201).json({ id: result.lastInsertRowid, nombre, descripcion, precio_unitario });
});

// Actualizar producto
router.put('/:id', (req, res) => {
  const { nombre, descripcion, precio_unitario, activo } = req.body;
  if (!nombre || precio_unitario == null) {
    return res.status(400).json({ error: 'Nombre y precio unitario son requeridos' });
  }

  const result = db.prepare(
    'UPDATE productos SET nombre=?, descripcion=?, precio_unitario=?, activo=? WHERE id=?'
  ).run(nombre, descripcion || null, precio_unitario, activo != null ? activo : 1, req.params.id);

  if (result.changes === 0) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json({ id: Number(req.params.id), nombre, descripcion, precio_unitario, activo });
});

// Eliminar producto
router.delete('/:id', (req, res) => {
  const usado = db.prepare('SELECT COUNT(*) as count FROM detalle_ventas WHERE producto_id = ?').get(req.params.id);
  if (usado.count > 0) {
    return res.status(400).json({ error: 'No se puede eliminar: el producto tiene ventas asociadas. Puedes desactivarlo.' });
  }

  const result = db.prepare('DELETE FROM productos WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json({ message: 'Producto eliminado' });
});

module.exports = router;
