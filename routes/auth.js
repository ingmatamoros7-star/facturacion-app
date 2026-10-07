const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../database');
const { requireAuth, firmarToken, COOKIE_NAME } = require('../middleware/auth');

const cookieOpts = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// Iniciar sesión
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }

    const usuario = await db.get('SELECT * FROM usuarios WHERE email = ? AND activo = 1', [
      String(email).trim().toLowerCase(),
    ]);

    if (!usuario || !bcrypt.compareSync(password, usuario.password_hash)) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const token = firmarToken({ id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol });
    res.cookie(COOKIE_NAME, token, cookieOpts);
    res.json({ id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol });
  } catch (e) { next(e); }
});

// Cerrar sesión
router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { ...cookieOpts, maxAge: undefined });
  res.json({ message: 'Sesión cerrada' });
});

// Usuario actual
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const u = await db.get('SELECT id, nombre, email, rol FROM usuarios WHERE id = ? AND activo = 1', [req.usuario.id]);
    if (!u) return res.status(401).json({ error: 'No autenticado' });
    res.json(u);
  } catch (e) { next(e); }
});

// Cambiar la propia contraseña
router.post('/cambiar-password', requireAuth, async (req, res, next) => {
  try {
    const { actual, nueva } = req.body;
    if (!actual || !nueva) return res.status(400).json({ error: 'Datos incompletos' });
    if (String(nueva).length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
    }

    const u = await db.get('SELECT * FROM usuarios WHERE id = ?', [req.usuario.id]);
    if (!u || !bcrypt.compareSync(actual, u.password_hash)) {
      return res.status(400).json({ error: 'La contraseña actual es incorrecta' });
    }

    const hash = bcrypt.hashSync(nueva, 10);
    await db.run('UPDATE usuarios SET password_hash = ? WHERE id = ?', [hash, u.id]);
    res.json({ message: 'Contraseña actualizada' });
  } catch (e) { next(e); }
});

module.exports = router;
