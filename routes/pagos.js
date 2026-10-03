const express = require('express');
const router = express.Router();
const db = require('../database');

// Registrar pago
router.post('/', (req, res) => {
  const { venta_id, monto, metodo, notas } = req.body;

  if (!venta_id || !monto || monto <= 0) {
    return res.status(400).json({ error: 'Se requiere venta_id y un monto mayor a 0' });
  }

  const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(venta_id);
  if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });

  const saldoPendiente = venta.total - venta.pagado;
  if (monto > saldoPendiente + 0.01) {
    return res.status(400).json({
      error: `El monto excede el saldo pendiente de $${saldoPendiente.toFixed(2)}`
    });
  }

  const registrarPago = db.transaction(() => {
    const result = db.prepare(
      'INSERT INTO pagos (venta_id, monto, metodo, notas) VALUES (?, ?, ?, ?)'
    ).run(venta_id, monto, metodo || 'efectivo', notas || null);

    const nuevoPagado = venta.pagado + monto;
    const nuevoEstado = nuevoPagado >= venta.total ? 'pagada' : 'pendiente';

    db.prepare('UPDATE ventas SET pagado = ?, estado = ? WHERE id = ?')
      .run(nuevoPagado, nuevoEstado, venta_id);

    return { id: result.lastInsertRowid, nuevoPagado, nuevoEstado };
  });

  const resultado = registrarPago();
  res.status(201).json({
    id: resultado.id,
    monto,
    total_pagado: resultado.nuevoPagado,
    estado: resultado.nuevoEstado
  });
});

// Listar pagos de una venta
router.get('/venta/:ventaId', (req, res) => {
  const pagos = db.prepare('SELECT * FROM pagos WHERE venta_id = ? ORDER BY fecha DESC')
    .all(req.params.ventaId);
  res.json(pagos);
});

module.exports = router;
