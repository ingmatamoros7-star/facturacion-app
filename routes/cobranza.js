const express = require('express');
const router = express.Router();
const db = require('../database');
const { enriquecerVenta } = require('../lib/estado');

const round2 = (n) => Math.round(n * 100) / 100;

// Trae todas las ventas con saldo pendiente, enriquecidas.
async function pendientes() {
  return (await db.all(
    `SELECT v.*, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono, c.email AS cliente_email
     FROM ventas v JOIN clientes c ON v.cliente_id = c.id
     WHERE v.total > v.pagado + 0.005
     ORDER BY v.fecha ASC`
  )).map(enriquecerVenta);
}

// CUENTAS POR COBRAR: todas las ventas con saldo pendiente
router.get('/cuentas-por-cobrar', async (req, res, next) => {
  try {
    const lista = (await pendientes()).sort((a, b) => b.dias_vencido - a.dias_vencido);
    const total = round2(lista.reduce((s, v) => s + v.saldo, 0));
    const totalVencido = round2(lista.filter((v) => v.estado === 'vencido').reduce((s, v) => s + v.saldo, 0));
    res.json({ lista, total, total_vencido: totalVencido, cantidad: lista.length });
  } catch (e) { next(e); }
});

// CARTERA VENCIDA: solo ventas cuyo vencimiento ya pasó y mantienen saldo
router.get('/cartera-vencida', async (req, res, next) => {
  try {
    const lista = (await pendientes())
      .filter((v) => v.estado === 'vencido')
      .sort((a, b) => b.dias_vencido - a.dias_vencido);
    const total = round2(lista.reduce((s, v) => s + v.saldo, 0));
    res.json({ lista, total, cantidad: lista.length });
  } catch (e) { next(e); }
});

// A QUIÉN TENGO QUE COBRAR: pendientes con clasificación por urgencia
router.get('/cobros', async (req, res, next) => {
  try {
    const filtro = req.query.filtro || 'todos';
    let lista = (await pendientes()).map((v) => {
      let urgencia;
      if (v.estado === 'vencido') urgencia = 'vencido';
      else if (v.fecha_vencimiento && v.dias_para_vencer === 0) urgencia = 'hoy';
      else if (v.fecha_vencimiento && v.dias_para_vencer > 0 && v.dias_para_vencer <= 7) urgencia = 'proximo';
      else urgencia = 'pendiente';
      return { ...v, urgencia };
    });

    if (filtro === 'vencidos') lista = lista.filter((v) => v.urgencia === 'vencido');
    else if (filtro === 'hoy') lista = lista.filter((v) => v.urgencia === 'hoy');
    else if (filtro === 'proximos') lista = lista.filter((v) => v.urgencia === 'proximo');

    const peso = { vencido: 0, hoy: 1, proximo: 2, pendiente: 3 };
    lista.sort((a, b) => (peso[a.urgencia] - peso[b.urgencia]) || (b.dias_vencido - a.dias_vencido));

    res.json({ lista, cantidad: lista.length, total: round2(lista.reduce((s, v) => s + v.saldo, 0)) });
  } catch (e) { next(e); }
});

module.exports = router;
