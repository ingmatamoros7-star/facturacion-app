const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const db = require('./database');
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

// Manejo de errores
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error del servidor' });
});

// Inicializa la base de datos y arranca el servidor
db.init()
  .then(() => {
    app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('No se pudo inicializar la base de datos:', err);
    process.exit(1);
  });
