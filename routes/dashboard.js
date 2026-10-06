const express = require('express');
const router = express.Router();
const db = require('../database');
const { enriquecerVenta, hoyISO } = require('../lib/estado');

router.get('/', (req, res) => {
  const hoy = hoyISO();
  const inicioMes = hoy.slice(0, 7) + '-01';

  const ventas = db
    .prepare(
      `SELECT v.*, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono
       FROM ventas v JOIN clientes c ON v.cliente_id = c.id
       ORDER BY v.fecha DESC, v.id DESC`
    )
    .all()
    .map(enriquecerVenta);

  const esDeHoy = (f) => (f || '').slice(0, 10) === hoy;
  const esDelMes = (f) => (f || '').slice(0, 10) >= inicioMes;

  const ventasDia = ventas.filter((v) => esDeHoy(v.fecha)).reduce((s, v) => s + v.total, 0);
  const ventasMes = ventas.filter((v) => esDelMes(v.fecha)).reduce((s, v) => s + v.total, 0);

  const totalCobrado = db.prepare('SELECT COALESCE(SUM(monto), 0) AS n FROM pagos').get().n;
  const porCobrar = ventas.reduce((s, v) => s + (v.saldo > 0 ? v.saldo : 0), 0);
  const carteraVencida = ventas.filter((v) => v.estado === 'vencido').reduce((s, v) => s + v.saldo, 0);

  const clientesConDeuda = new Set(ventas.filter((v) => v.saldo > 0).map((v) => v.cliente_id)).size;

  const totalClientes = db.prepare('SELECT COUNT(*) AS n FROM clientes').get().n;
  const totalProductos = db.prepare('SELECT COUNT(*) AS n FROM productos').get().n;

  // Clientes que requieren seguimiento (vencidos, mayor antigüedad primero)
  const seguimiento = ventas
    .filter((v) => v.estado === 'vencido')
    .sort((a, b) => b.dias_vencido - a.dias_vencido)
    .slice(0, 5);

  const round2 = (n) => Math.round(n * 100) / 100;

  res.json({
    ventas_dia: round2(ventasDia),
    ventas_mes: round2(ventasMes),
    total_cobrado: round2(totalCobrado),
    por_cobrar: round2(porCobrar),
    cartera_vencida: round2(carteraVencida),
    clientes_con_deuda: clientesConDeuda,
    total_clientes: totalClientes,
    total_productos: totalProductos,
    ventas_recientes: ventas.slice(0, 5),
    seguimiento,
  });
});

module.exports = router;
