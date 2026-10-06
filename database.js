const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

// En producción (ej. Render) usar disco persistente vía DB_PATH;
// localmente, guardar el archivo junto al proyecto.
const dbPath = process.env.DB_PATH
  ? path.join(process.env.DB_PATH, 'facturacion.db')
  : path.join(__dirname, 'facturacion.db');

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ============ ESQUEMA ============
db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    rol TEXT NOT NULL DEFAULT 'usuario',
    activo INTEGER NOT NULL DEFAULT 1,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    identificacion TEXT,
    telefono TEXT,
    email TEXT,
    direccion TEXT,
    notas TEXT,
    activo INTEGER NOT NULL DEFAULT 1,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS productos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    precio_unitario REAL NOT NULL,
    activo INTEGER NOT NULL DEFAULT 1,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS ventas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero TEXT,
    cliente_id INTEGER NOT NULL,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    subtotal REAL NOT NULL DEFAULT 0,
    descuento REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    pagado REAL NOT NULL DEFAULT 0,
    forma_pago TEXT NOT NULL DEFAULT 'efectivo',
    estado TEXT NOT NULL DEFAULT 'pendiente',
    fecha_vencimiento DATE,
    notas TEXT,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
  );

  CREATE TABLE IF NOT EXISTS detalle_ventas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    venta_id INTEGER NOT NULL,
    producto_id INTEGER,
    descripcion TEXT,
    cantidad REAL NOT NULL,
    precio_unitario REAL NOT NULL,
    subtotal REAL NOT NULL,
    FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id)
  );

  CREATE TABLE IF NOT EXISTS pagos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    venta_id INTEGER NOT NULL,
    cliente_id INTEGER,
    monto REAL NOT NULL,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    metodo TEXT NOT NULL DEFAULT 'efectivo',
    notas TEXT,
    FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
  );

  CREATE INDEX IF NOT EXISTS idx_ventas_cliente ON ventas(cliente_id);
  CREATE INDEX IF NOT EXISTS idx_detalle_venta ON detalle_ventas(venta_id);
  CREATE INDEX IF NOT EXISTS idx_pagos_venta ON pagos(venta_id);
`);

// ============ MIGRACIONES SUAVES ============
// Agrega columnas nuevas a instalaciones existentes sin perder datos.
function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  }
}

ensureColumn('clientes', 'identificacion', 'identificacion TEXT');
ensureColumn('clientes', 'activo', 'activo INTEGER NOT NULL DEFAULT 1');
ensureColumn('productos', 'codigo', 'codigo TEXT');
ensureColumn('ventas', 'numero', 'numero TEXT');
ensureColumn('ventas', 'subtotal', 'subtotal REAL NOT NULL DEFAULT 0');
ensureColumn('ventas', 'descuento', 'descuento REAL NOT NULL DEFAULT 0');
ensureColumn('ventas', 'forma_pago', "forma_pago TEXT NOT NULL DEFAULT 'efectivo'");
ensureColumn('ventas', 'fecha_vencimiento', 'fecha_vencimiento DATE');
ensureColumn('ventas', 'creado_en', 'creado_en DATETIME');
ensureColumn('pagos', 'cliente_id', 'cliente_id INTEGER');

// Rellenar numero/subtotal en ventas antiguas que no lo tengan.
db.prepare(
  `UPDATE ventas SET numero = 'V-' || substr('000000' || id, -6, 6) WHERE numero IS NULL OR numero = ''`
).run();
db.prepare(`UPDATE ventas SET subtotal = total WHERE subtotal = 0 AND total > 0`).run();

// ============ USUARIO ADMIN POR DEFECTO ============
const totalUsuarios = db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n;
if (totalUsuarios === 0) {
  const email = process.env.ADMIN_EMAIL || 'admin@sistema.com';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const hash = bcrypt.hashSync(password, 10);
  db.prepare(
    'INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)'
  ).run('Administrador', email, hash, 'admin');
  console.log('------------------------------------------------------------');
  console.log(' Usuario administrador creado:');
  console.log('   Email:    ' + email);
  console.log('   Password: ' + password);
  console.log(' Cambia la contraseña desde el módulo de Usuarios.');
  console.log('------------------------------------------------------------');
}

module.exports = db;
