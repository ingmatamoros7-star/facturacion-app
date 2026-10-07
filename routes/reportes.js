const express = require('express');
const router = express.Router();
const db = require('../database');
const { enriquecerVenta } = require('../lib/estado');

const round2 = (n) => Math.round(n * 100) / 100;

// REPORTE DE VENTAS con filtros: desde, hasta, cliente_id, estado
router.get('/ventas', async (req, res, next) => {
  try {
    const { desde, hasta, cliente_id, estado } = req.query;
    const where = [];
    const params = [];
    if (desde) { where.push('date(v.fecha) >= date(?)'); params.push(desde); }
    if (hasta) { where.push('date(v.fecha) <= date(?)'); params.push(hasta); }
    if (cliente_id) { where.push('v.cliente_id = ?'); params.push(cliente_id); }

    const sql = `
      SELECT v.*, c.nombre AS cliente_nombre
      FROM ventas v JOIN clientes c ON v.cliente_id = c.id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY v.fecha DESC, v.id DESC`;

    let ventas = (await db.all(sql, params)).map(enriquecerVenta);
    if (estado) ventas = ventas.filter((v) => v.estado === estado);

    const resumen = {
      cantidad: ventas.length,
      total: round2(ventas.reduce((s, v) => s + v.total, 0)),
      pagado: round2(ventas.reduce((s, v) => s + v.pagado, 0)),
      saldo: round2(ventas.reduce((s, v) => s + (v.saldo > 0 ? v.saldo : 0), 0)),
    };
    res.json({ ventas, resumen });
  } catch (e) { next(e); }
});

// REPORTE DE CARTERA: por cliente -> total adeudado, total vencido, días máximos
router.get('/cartera', async (req, res, next) => {
  try {
    const ventas = (await db.all(
      `SELECT v.*, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono
       FROM ventas v JOIN clientes c ON v.cliente_id = c.id
       WHERE v.total > v.pagado + 0.005`
    )).map(enriquecerVenta);

    const porCliente = {};
    for (const v of ventas) {
      if (!porCliente[v.cliente_id]) {
        porCliente[v.cliente_id] = {
          cliente_id: v.cliente_id,
          cliente_nombre: v.cliente_nombre,
          cliente_telefono: v.cliente_telefono,
          total_adeudado: 0,
          total_vencido: 0,
          dias_max: 0,
          cuentas: 0,
        };
      }
      const g = porCliente[v.cliente_id];
      g.total_adeudado += v.saldo;
      if (v.estado === 'vencido') g.total_vencido += v.saldo;
      g.dias_max = Math.max(g.dias_max, v.dias_vencido);
      g.cuentas += 1;
    }

    const lista = Object.values(porCliente)
      .map((g) => ({ ...g, total_adeudado: round2(g.total_adeudado), total_vencido: round2(g.total_vencido) }))
      .sort((a, b) => b.total_vencido - a.total_vencido || b.total_adeudado - a.total_adeudado);

    res.json({
      lista,
      resumen: {
        clientes: lista.length,
        total_adeudado: round2(lista.reduce((s, g) => s + g.total_adeudado, 0)),
        total_vencido: round2(lista.reduce((s, g) => s + g.total_vencido, 0)),
      },
    });
  } catch (e) { next(e); }
});

module.exports = router;
