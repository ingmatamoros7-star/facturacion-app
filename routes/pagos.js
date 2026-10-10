const express = require('express');
const router = express.Router();
const db = require('../database');

const METODOS = ['efectivo', 'transferencia', 'tarjeta', 'otro'];
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Registrar pago sobre una venta
router.post('/', async (req, res, next) => {
  try {
    const { venta_id, monto, metodo, notas } = req.body;
    const m = round2(monto);
    if (!venta_id || !m || m <= 0) {
      return res.status(400).json({ error: 'Se requiere la venta y un monto mayor a 0' });
    }

    const venta = await db.get('SELECT * FROM ventas WHERE id = ?', [venta_id]);
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });

    const saldo = round2(venta.total - venta.pagado);
    if (m > saldo + 0.01) {
      return res.status(400).json({ error: `El monto excede el saldo pendiente de $${saldo.toFixed(2)}` });
    }

    const nuevoPagado = round2(venta.pagado + m);
    let estado = 'parcial';
    if (nuevoPagado >= venta.total - 0.005) estado = 'pagado';
    else if (nuevoPagado <= 0.005) estado = 'pendiente';

    const trx = await db.tx();
    let pagoId;
    try {
      const r = await trx.execute({
        sql: 'INSERT INTO pagos (venta_id, cliente_id, monto, metodo, notas) VALUES (?, ?, ?, ?, ?)',
        args: [venta_id, venta.cliente_id, m, METODOS.includes(metodo) ? metodo : 'efectivo', notas || null],
      });
      pagoId = Number(r.lastInsertRowid);
      await trx.execute({ sql: 'UPDATE ventas SET pagado = ?, estado = ? WHERE id = ?', args: [nuevoPagado, estado, venta_id] });
      await trx.commit();
    } catch (err) {
      await trx.rollback();
      throw err;
    }

    res.status(201).json({ id: pagoId, monto: m, total_pagado: nuevoPagado, estado });
  } catch (e) { next(e); }
});

// Listar pagos de una venta
router.get('/venta/:ventaId', async (req, res, next) => {
  try {
    res.json(await db.all('SELECT * FROM pagos WHERE venta_id = ? ORDER BY fecha DESC', [req.params.ventaId]));
  } catch (e) { next(e); }
});

module.exports = router;
