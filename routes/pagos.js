const express = require('express');
const router = express.Router();
const db = require('../database');

const METODOS = ['efectivo', 'transferencia', 'tarjeta', 'otro'];

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

// Registrar pago sobre una venta
router.post('/', (req, res) => {
  const { venta_id, monto, metodo, notas } = req.body;
  const m = round2(monto);

  if (!venta_id || !m || m <= 0) {
    return res.status(400).json({ error: 'Se requiere la venta y un monto mayor a 0' });
  }

  const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(venta_id);
  if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });

  const saldo = round2(venta.total - venta.pagado);
  if (m > saldo + 0.01) {
    return res.status(400).json({ error: `El monto excede el saldo pendiente de $${saldo.toFixed(2)}` });
  }

  const registrar = db.transaction(() => {
    const result = db
      .prepare('INSERT INTO pagos (venta_id, cliente_id, monto, metodo, notas) VALUES (?, ?, ?, ?, ?)')
      .run(venta_id, venta.cliente_id, m, METODOS.includes(metodo) ? metodo : 'efectivo', notas || null);

    const nuevoPagado = round2(venta.pagado + m);
    let estado = 'parcial';
    if (nuevoPagado >= venta.total - 0.005) estado = 'pagado';
    else if (nuevoPagado <= 0.005) estado = 'pendiente';

    db.prepare('UPDATE ventas SET pagado = ?, estado = ? WHERE id = ?').run(nuevoPagado, estado, venta_id);
    return { id: result.lastInsertRowid, nuevoPagado, estado };
  });

  const r = registrar();
  res.status(201).json({ id: r.id, monto: m, total_pagado: r.nuevoPagado, estado: r.estado });
});

// Listar pagos de una venta
router.get('/venta/:ventaId', (req, res) => {
  const pagos = db
    .prepare('SELECT * FROM pagos WHERE venta_id = ? ORDER BY fecha DESC')
    .all(req.params.ventaId);
  res.json(pagos);
});

module.exports = router;
