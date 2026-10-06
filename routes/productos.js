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
  const { codigo, nombre, descripcion, precio_unitario, activo } = req.body;
  if (!nombre || !nombre.trim() || precio_unitario == null || isNaN(Number(precio_unitario))) {
    return res.status(400).json({ error: 'Nombre y precio unitario son requeridos' });
  }
  if (Number(precio_unitario) < 0) {
    return res.status(400).json({ error: 'El precio no puede ser negativo' });
  }

  const result = db
    .prepare(
      'INSERT INTO productos (codigo, nombre, descripcion, precio_unitario, activo) VALUES (?, ?, ?, ?, ?)'
    )
    .run(
      codigo || null,
      nombre.trim(),
      descripcion || null,
      Number(precio_unitario),
      activo === 0 || activo === false ? 0 : 1
    );

  res.status(201).json(db.prepare('SELECT * FROM productos WHERE id = ?').get(result.lastInsertRowid));
});

// Actualizar producto
router.put('/:id', (req, res) => {
  const { codigo, nombre, descripcion, precio_unitario, activo } = req.body;
  if (!nombre || !nombre.trim() || precio_unitario == null || isNaN(Number(precio_unitario))) {
    return res.status(400).json({ error: 'Nombre y precio unitario son requeridos' });
  }
  if (Number(precio_unitario) < 0) {
    return res.status(400).json({ error: 'El precio no puede ser negativo' });
  }

  const result = db
    .prepare(
      'UPDATE productos SET codigo=?, nombre=?, descripcion=?, precio_unitario=?, activo=? WHERE id=?'
    )
    .run(
      codigo || null,
      nombre.trim(),
      descripcion || null,
      Number(precio_unitario),
      activo === 0 || activo === false ? 0 : 1,
      req.params.id
    );

  if (result.changes === 0) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(db.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id));
});

// Eliminar producto (solo si no está en ventas)
router.delete('/:id', (req, res) => {
  const usado = db
    .prepare('SELECT COUNT(*) AS count FROM detalle_ventas WHERE producto_id = ?')
    .get(req.params.id);
  if (usado.count > 0) {
    return res
      .status(400)
      .json({ error: 'No se puede eliminar: el producto tiene ventas asociadas. Puedes desactivarlo.' });
  }

  const result = db.prepare('DELETE FROM productos WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json({ message: 'Producto eliminado' });
});

module.exports = router;
