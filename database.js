const path = require('path');
const bcrypt = require('bcryptjs');
const { createClient } = require('@libsql/client');

/*
 * Base de datos: Turso / libSQL (compatible con SQLite).
 *
 * - En producción: define TURSO_DATABASE_URL (libsql://...) y TURSO_AUTH_TOKEN.
 * - En local / sin esas variables: usa un archivo SQLite local (file:...),
 *   guardado en DB_PATH si existe, o junto al proyecto.
 */
const localFile = process.env.DB_PATH
  ? 'file:' + path.join(process.env.DB_PATH, 'facturacion.db')
  : 'file:' + path.join(__dirname, 'facturacion.db');

const url = process.env.TURSO_DATABASE_URL || localFile;
const authToken = process.env.TURSO_AUTH_TOKEN; // solo necesario para Turso remoto

const client = createClient({ url, authToken });

// ---- Helpers (convierten las filas a objetos planos) ----
function toPlain(res) {
  return res.rows.map((row) => {
    const o = {};
    for (const c of res.columns) o[c] = row[c];
    return o;
  });
}

async function all(sql, args = []) {
  const res = await client.execute({ sql, args });
  return toPlain(res);
}

async function get(sql, args = []) {
  const rows = await all(sql, args);
  return rows[0];
}

async function run(sql, args = []) {
  const res = await client.execute({ sql, args });
  return {
    lastInsertRowid: res.lastInsertRowid != null ? Number(res.lastInsertRowid) : undefined,
    changes: res.rowsAffected,
  };
}

// Transacción de escritura: devuelve un objeto con execute/commit/rollback.
async function tx() {
  return client.transaction('write');
}

// ---- Esquema ----
const SCHEMA = `
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
`;

async function ensureColumn(table, column, definition) {
  const cols = await all(`PRAGMA table_info(${table})`);
  if (!cols.some((c) => c.name === column)) {
    await client.execute(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  }
}

// Inicializa el esquema, migraciones suaves y el usuario admin por defecto.
async function init() {
  await client.executeMultiple(SCHEMA);

  await ensureColumn('clientes', 'identificacion', 'identificacion TEXT');
  await ensureColumn('clientes', 'activo', 'activo INTEGER NOT NULL DEFAULT 1');
  await ensureColumn('productos', 'codigo', 'codigo TEXT');
  await ensureColumn('ventas', 'numero', 'numero TEXT');
  await ensureColumn('ventas', 'subtotal', 'subtotal REAL NOT NULL DEFAULT 0');
  await ensureColumn('ventas', 'descuento', 'descuento REAL NOT NULL DEFAULT 0');
  await ensureColumn('ventas', 'forma_pago', "forma_pago TEXT NOT NULL DEFAULT 'efectivo'");
  await ensureColumn('ventas', 'fecha_vencimiento', 'fecha_vencimiento DATE');
  await ensureColumn('ventas', 'creado_en', 'creado_en DATETIME');
  await ensureColumn('pagos', 'cliente_id', 'cliente_id INTEGER');

  await run(`UPDATE ventas SET numero = 'V-' || substr('000000' || id, -6, 6) WHERE numero IS NULL OR numero = ''`);
  await run(`UPDATE ventas SET subtotal = total WHERE subtotal = 0 AND total > 0`);

  const { n } = (await get('SELECT COUNT(*) AS n FROM usuarios')) || { n: 0 };
  if (!n) {
    const email = process.env.ADMIN_EMAIL || 'admin@sistema.com';
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    const hash = bcrypt.hashSync(password, 10);
    await run('INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)', [
      'Administrador', email, hash, 'admin',
    ]);
    console.log('------------------------------------------------------------');
    console.log(' Usuario administrador creado:');
    console.log('   Email:    ' + email);
    console.log('   Password: ' + password);
    console.log(' Cambia la contraseña desde "Mi cuenta".');
    console.log('------------------------------------------------------------');
  }
}

module.exports = { client, all, get, run, tx, init };
