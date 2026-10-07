/*
 * Cargador de datos de ejemplo (OPCIONAL).
 *
 *   npm run seed            → inserta datos demo solo si la base está vacía
 *   npm run seed -- --force → inserta aunque ya existan datos
 *
 * Úsalo únicamente para probar/evaluar el sistema.
 */
const db = require('./database');

const force = process.argv.includes('--force');
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const hoy = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const masDias = (n) => { const d = new Date(hoy); d.setDate(d.getDate() + n); return iso(d); };

const clientes = [
  { nombre: 'Comercial Andrade S.A.', identificacion: '1790012345001', telefono: '0991112233', email: 'ventas@andrade.com', direccion: 'Av. Amazonas N34-120, Quito' },
  { nombre: 'María Fernanda López', identificacion: '1712345678', telefono: '0987654321', email: 'mafer.lopez@gmail.com', direccion: 'Cdla. Kennedy, Guayaquil' },
  { nombre: 'Ferretería El Tornillo', identificacion: '0992233445001', telefono: '0961234567', email: 'contacto@eltornillo.ec', direccion: 'Av. de las Américas, Cuenca' },
  { nombre: 'Distribuidora Pacífico Cía. Ltda.', identificacion: '0190998877001', telefono: '0999887766', email: 'cobros@pacifico.ec', direccion: 'Km 8.5 Vía Daule, Guayaquil' },
];

const productos = [
  { codigo: 'SERV-01', nombre: 'Mantenimiento mensual', descripcion: 'Soporte y mantenimiento de sistema', precio_unitario: 150 },
  { codigo: 'PROD-01', nombre: 'Licencia software anual', descripcion: 'Licencia de uso por 12 meses', precio_unitario: 320 },
  { codigo: 'PROD-02', nombre: 'Equipo de red', descripcion: 'Router empresarial', precio_unitario: 85 },
  { codigo: 'SERV-02', nombre: 'Capacitación (hora)', descripcion: 'Capacitación al personal', precio_unitario: 40 },
  { codigo: 'PROD-03', nombre: 'Disco SSD 1TB', descripcion: 'Unidad de estado sólido', precio_unitario: 95 },
];

const ventas = [
  { cliente: 0, forma_pago: 'efectivo', fecha: masDias(-20), items: [{ prod: 0, cant: 2 }, { prod: 2, cant: 4 }] },
  { cliente: 1, forma_pago: 'credito', fecha: masDias(-60), vencimiento: masDias(-21), pagado_inicial: 100, items: [{ prod: 1, cant: 1 }] },
  { cliente: 2, forma_pago: 'credito', fecha: masDias(-10), vencimiento: masDias(3), items: [{ prod: 0, cant: 3 }, { prod: 1, cant: 1 }] },
  { cliente: 3, forma_pago: 'credito', fecha: masDias(-45), vencimiento: masDias(-15), items: [{ prod: 4, cant: 5 }], pagos: [{ monto: 200, metodo: 'transferencia' }] },
  { cliente: 1, forma_pago: 'transferencia', fecha: masDias(-3), items: [{ prod: 3, cant: 6 }] },
  { cliente: 0, forma_pago: 'credito', fecha: masDias(-2), vencimiento: masDias(0), items: [{ prod: 1, cant: 2 }] },
];

async function main() {
  await db.init();

  const existentes = (await db.get('SELECT COUNT(*) AS n FROM clientes')).n;
  if (existentes > 0 && !force) {
    console.log(`La base ya tiene ${existentes} cliente(s). No se insertaron datos demo.`);
    console.log('Usa "npm run seed -- --force" si deseas agregarlos de todos modos.');
    return;
  }

  const clienteIds = [];
  for (const c of clientes) {
    const r = await db.run('INSERT INTO clientes (nombre, identificacion, telefono, email, direccion) VALUES (?, ?, ?, ?, ?)',
      [c.nombre, c.identificacion, c.telefono, c.email, c.direccion]);
    clienteIds.push(r.lastInsertRowid);
  }

  const prodRows = [];
  for (const p of productos) {
    const r = await db.run('INSERT INTO productos (codigo, nombre, descripcion, precio_unitario) VALUES (?, ?, ?, ?)',
      [p.codigo, p.nombre, p.descripcion, p.precio_unitario]);
    prodRows.push({ id: r.lastInsertRowid, precio: p.precio_unitario, nombre: p.nombre });
  }

  for (const v of ventas) {
    let subtotal = 0;
    const lineas = v.items.map((it) => {
      const p = prodRows[it.prod];
      const sub = round2(p.precio * it.cant);
      subtotal += sub;
      return { id: p.id, nombre: p.nombre, cant: it.cant, precio: p.precio, sub };
    });
    subtotal = round2(subtotal);
    const total = subtotal;
    const esCredito = v.forma_pago === 'credito';
    let pagado = esCredito ? round2(v.pagado_inicial || 0) : total;
    if (pagado > total) pagado = total;

    const clienteId = clienteIds[v.cliente];
    const estado = pagado >= total - 0.005 ? 'pagado' : pagado > 0.005 ? 'parcial' : 'pendiente';
    const r = await db.run(
      `INSERT INTO ventas (cliente_id, fecha, subtotal, descuento, total, pagado, forma_pago, estado, fecha_vencimiento, notas)
       VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, NULL)`,
      [clienteId, v.fecha, subtotal, total, pagado, v.forma_pago, estado, esCredito ? v.vencimiento : null]
    );
    const ventaId = r.lastInsertRowid;
    await db.run('UPDATE ventas SET numero = ? WHERE id = ?', ['V-' + String(ventaId).padStart(6, '0'), ventaId]);

    for (const l of lineas) {
      await db.run('INSERT INTO detalle_ventas (venta_id, producto_id, descripcion, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
        [ventaId, l.id, l.nombre, l.cant, l.precio, l.sub]);
    }

    if (pagado > 0.005) {
      await db.run('INSERT INTO pagos (venta_id, cliente_id, monto, fecha, metodo, notas) VALUES (?, ?, ?, ?, ?, ?)',
        [ventaId, clienteId, pagado, v.fecha, esCredito ? 'efectivo' : v.forma_pago, esCredito ? 'Pago inicial' : 'Pago de contado']);
    }

    for (const pg of v.pagos || []) {
      await db.run('INSERT INTO pagos (venta_id, cliente_id, monto, fecha, metodo, notas) VALUES (?, ?, ?, ?, ?, ?)',
        [ventaId, clienteId, pg.monto, v.fecha, pg.metodo, 'Abono']);
      pagado = round2(pagado + pg.monto);
      if (pagado > total) pagado = total;
      const est = pagado >= total - 0.005 ? 'pagado' : pagado > 0.005 ? 'parcial' : 'pendiente';
      await db.run('UPDATE ventas SET pagado = ?, estado = ? WHERE id = ?', [pagado, est, ventaId]);
    }
  }

  console.log(`Datos demo insertados: ${clientes.length} clientes, ${productos.length} productos, ${ventas.length} ventas.`);
  console.log('Ingresa con  admin@sistema.com  /  admin123');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
