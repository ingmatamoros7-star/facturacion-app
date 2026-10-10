const express = require('express');
const router = express.Router();
const db = require('../database');

// Listar productos
router.get('/', async (req, res, next) => {
  try {
    res.json(await db.all('SELECT * FROM productos ORDER BY nombre'));
  } catch (e) { next(e); }
});

// Obtener un producto
router.get('/:id', async (req, res, next) => {
  try {
    const producto = await db.get('SELECT * FROM productos WHERE id = ?', [req.params.id]);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(producto);
  } catch (e) { next(e); }
});

// Crear producto
router.post('/', async (req, res, next) => {
  try {
    const { codigo, nombre, descripcion, precio_unitario, activo } = req.body;
    if (!nombre || !nombre.trim() || precio_unitario == null || isNaN(Number(precio_unitario))) {
      return res.status(400).json({ error: 'Nombre y precio unitario son requeridos' });
    }
    if (Number(precio_unitario) < 0) return res.status(400).json({ error: 'El precio no puede ser negativo' });

    const result = await db.run(
      'INSERT INTO productos (codigo, nombre, descripcion, precio_unitario, activo) VALUES (?, ?, ?, ?, ?)',
      [codigo || null, nombre.trim(), descripcion || null, Number(precio_unitario),
        activo === 0 || activo === false ? 0 : 1]
    );
    res.status(201).json(await db.get('SELECT * FROM productos WHERE id = ?', [result.lastInsertRowid]));
  } catch (e) { next(e); }
});

// Actualizar producto
router.put('/:id', async (req, res, next) => {
  try {
    const { codigo, nombre, descripcion, precio_unitario, activo } = req.body;
    if (!nombre || !nombre.trim() || precio_unitario == null || isNaN(Number(precio_unitario))) {
      return res.status(400).json({ error: 'Nombre y precio unitario son requeridos' });
    }
    if (Number(precio_unitario) < 0) return res.status(400).json({ error: 'El precio no puede ser negativo' });

    const result = await db.run(
      'UPDATE productos SET codigo=?, nombre=?, descripcion=?, precio_unitario=?, activo=? WHERE id=?',
      [codigo || null, nombre.trim(), descripcion || null, Number(precio_unitario),
        activo === 0 || activo === false ? 0 : 1, req.params.id]
    );
    if (result.changes === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(await db.get('SELECT * FROM productos WHERE id = ?', [req.params.id]));
  } catch (e) { next(e); }
});

// Eliminar producto (solo si no está en ventas)
router.delete('/:id', async (req, res, next) => {
  try {
    const usado = await db.get('SELECT COUNT(*) AS count FROM detalle_ventas WHERE producto_id = ?', [req.params.id]);
    if (usado.count > 0) {
      return res.status(400).json({ error: 'No se puede eliminar: el producto tiene ventas asociadas. Puedes desactivarlo.' });
    }
    const result = await db.run('DELETE FROM productos WHERE id = ?', [req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ message: 'Producto eliminado' });
  } catch (e) { next(e); }
});

module.exports = router;
