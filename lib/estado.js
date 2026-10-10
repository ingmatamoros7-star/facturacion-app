// Lógica compartida para calcular el estado real de una venta.
// Estados posibles: pagado | pendiente | parcial | vencido

function hoyISO() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// Diferencia en días entre hoy y una fecha (positivo = ya pasó / vencido).
function diasVencido(fechaVencimiento) {
  if (!fechaVencimiento) return 0;
  const venc = new Date(fechaVencimiento + 'T00:00:00');
  const hoy = new Date(hoyISO() + 'T00:00:00');
  return Math.round((hoy - venc) / 86400000);
}

// Enriquece una venta con saldo, estado real y días de vencimiento.
function enriquecerVenta(v) {
  const total = Number(v.total) || 0;
  const pagado = Number(v.pagado) || 0;
  const saldo = Math.round((total - pagado) * 100) / 100;
  const dias = diasVencido(v.fecha_vencimiento);

  let estado;
  if (saldo <= 0.005) {
    estado = 'pagado';
  } else if (v.fecha_vencimiento && dias > 0) {
    estado = 'vencido';
  } else if (pagado > 0.005) {
    estado = 'parcial';
  } else {
    estado = 'pendiente';
  }

  return {
    ...v,
    saldo,
    estado,
    dias_vencido: dias > 0 ? dias : 0,
    dias_para_vencer: dias < 0 ? -dias : 0,
  };
}

module.exports = { hoyISO, diasVencido, enriquecerVenta };
