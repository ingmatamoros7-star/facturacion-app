const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const { requireAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware base
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Autenticación (público)
app.use('/api/auth', require('./routes/auth'));

// API protegida (requiere sesión)
app.use('/api/clientes', requireAuth, require('./routes/clientes'));
app.use('/api/productos', requireAuth, require('./routes/productos'));
app.use('/api/ventas', requireAuth, require('./routes/ventas'));
app.use('/api/pagos', requireAuth, require('./routes/pagos'));
app.use('/api/dashboard', requireAuth, require('./routes/dashboard'));
app.use('/api/cobranza', requireAuth, require('./routes/cobranza'));
app.use('/api/reportes', requireAuth, require('./routes/reportes'));

// Ruta principal (SPA)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
