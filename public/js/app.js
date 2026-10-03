const API = '';

// ============ UTILIDADES ============
function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function formatMoney(n) {
  return '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

async function api(path, opts = {}) {
  try {
    const res = await fetch(API + path, {
      headers: { 'Content-Type': 'application/json' },
      ...opts,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error del servidor');
    return data;
  } catch (err) {
    toast(err.message, 'error');
    throw err;
  }
}

// ============ NAVEGACIÓN ============
function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('sec-' + name).classList.add('active');

  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');

  if (name === 'clientes') loadClientes();
  if (name === 'productos') loadProductos();
  if (name === 'ventas') loadVentas();
  if (name === 'cartera') loadCartera();
}

// ============ CLIENTES ============
async function loadClientes() {
  const clientes = await api('/api/clientes');
  const tbody = document.getElementById('clientes-table');
  tbody.innerHTML = clientes.length ? clientes.map(c => `
    <tr>
      <td><strong>${esc(c.nombre)}</strong></td>
      <td>${esc(c.telefono || '-')}</td>
      <td>${esc(c.email || '-')}</td>
      <td>
        <button class="btn btn-primary btn-sm" onclick="editCliente(${c.id})">Editar</button>
        <button class="btn btn-danger btn-sm" onclick="deleteCliente(${c.id})">Eliminar</button>
      </td>
    </tr>
  `).join('') : '<tr><td colspan="4" style="text-align:center;color:#999;padding:40px">No hay clientes registrados</td></tr>';
}

function showClienteForm(cliente = null) {
  const c = cliente || {};
  document.getElementById('cliente-form-container').innerHTML = `
    <div class="form-card">
      <h3>${c.id ? 'Editar' : 'Nuevo'} Cliente</h3>
      <div class="form-row">
        <div><label>Nombre *</label><input id="cf-nombre" value="${esc(c.nombre || '')}"></div>
        <div><label>Teléfono</label><input id="cf-telefono" value="${esc(c.telefono || '')}"></div>
      </div>
      <div class="form-row">
        <div><label>Email</label><input id="cf-email" type="email" value="${esc(c.email || '')}"></div>
        <div><label>Dirección</label><input id="cf-direccion" value="${esc(c.direccion || '')}"></div>
      </div>
      <div style="margin-top:12px">
        <button class="btn btn-primary" onclick="saveCliente(${c.id || 0})">Guardar</button>
        <button class="btn" style="background:var(--gray-200)" onclick="this.closest('.form-card').remove()">Cancelar</button>
      </div>
    </div>
  `;
}

async function saveCliente(id) {
  const body = {
    nombre: document.getElementById('cf-nombre').value.trim(),
    telefono: document.getElementById('cf-telefono').value.trim(),
    email: document.getElementById('cf-email').value.trim(),
    direccion: document.getElementById('cf-direccion').value.trim(),
  };
  if (!body.nombre) return toast('El nombre es requerido', 'error');

  if (id) {
    await api('/api/clientes/' + id, { method: 'PUT', body });
  } else {
    await api('/api/clientes', { method: 'POST', body });
  }
  toast('Cliente guardado', 'success');
  document.getElementById('cliente-form-container').innerHTML = '';
  loadClientes();
}

async function editCliente(id) {
  const c = await api('/api/clientes/' + id);
  showClienteForm(c);
}

async function deleteCliente(id) {
  if (!confirm('¿Eliminar este cliente?')) return;
  await api('/api/clientes/' + id, { method: 'DELETE' });
  toast('Cliente eliminado', 'success');
  loadClientes();
}

// ============ PRODUCTOS ============
async function loadProductos() {
  const productos = await api('/api/productos');
  const tbody = document.getElementById('productos-table');
  tbody.innerHTML = productos.length ? productos.map(p => `
    <tr>
      <td><strong>${esc(p.nombre)}</strong></td>
      <td>${esc(p.descripcion || '-')}</td>
      <td>${formatMoney(p.precio_unitario)}</td>
      <td>
        <button class="btn btn-primary btn-sm" onclick="editProducto(${p.id})">Editar</button>
        <button class="btn btn-danger btn-sm" onclick="deleteProducto(${p.id})">Eliminar</button>
      </td>
    </tr>
  `).join('') : '<tr><td colspan="4" style="text-align:center;color:#999;padding:40px">No hay productos registrados</td></tr>';
}

function showProductoForm(producto = null) {
  const p = producto || {};
  document.getElementById('producto-form-container').innerHTML = `
    <div class="form-card">
      <h3>${p.id ? 'Editar' : 'Nuevo'} Producto</h3>
      <div class="form-row">
        <div><label>Nombre *</label><input id="pf-nombre" value="${esc(p.nombre || '')}"></div>
        <div><label>Precio Unitario *</label><input id="pf-precio" type="number" step="0.01" min="0" value="${p.precio_unitario || ''}"></div>
      </div>
      <div class="form-row">
        <div><label>Descripción</label><input id="pf-descripcion" value="${esc(p.descripcion || '')}"></div>
      </div>
      <div style="margin-top:12px">
        <button class="btn btn-primary" onclick="saveProducto(${p.id || 0})">Guardar</button>
        <button class="btn" style="background:var(--gray-200)" onclick="this.closest('.form-card').remove()">Cancelar</button>
      </div>
    </div>
  `;
}

async function saveProducto(id) {
  const body = {
    nombre: document.getElementById('pf-nombre').value.trim(),
    precio_unitario: parseFloat(document.getElementById('pf-precio').value),
    descripcion: document.getElementById('pf-descripcion').value.trim(),
  };
  if (!body.nombre || isNaN(body.precio_unitario)) return toast('Nombre y precio son requeridos', 'error');

  if (id) {
    await api('/api/productos/' + id, { method: 'PUT', body });
  } else {
    await api('/api/productos', { method: 'POST', body });
  }
  toast('Producto guardado', 'success');
  document.getElementById('producto-form-container').innerHTML = '';
  loadProductos();
}

async function editProducto(id) {
  const p = await api('/api/productos/' + id);
  showProductoForm(p);
}

async function deleteProducto(id) {
  if (!confirm('¿Eliminar este producto?')) return;
  await api('/api/productos/' + id, { method: 'DELETE' });
  toast('Producto eliminado', 'success');
  loadProductos();
}

// ============ VENTAS ============
let productosCache = [];

async function loadVentas() {
  const ventas = await api('/api/ventas');
  const tbody = document.getElementById('ventas-table');
  tbody.innerHTML = ventas.length ? ventas.map(v => `
    <tr>
      <td>${v.id}</td>
      <td>${esc(v.cliente_nombre)}</td>
      <td>${formatDate(v.fecha)}</td>
      <td>${formatMoney(v.total)}</td>
      <td>${formatMoney(v.pagado)}</td>
      <td><span class="badge ${v.estado === 'pagada' ? 'badge-paid' : 'badge-pending'}">${v.estado === 'pagada' ? 'Pagada' : 'Pendiente'}</span></td>
      <td>
        <button class="btn btn-primary btn-sm" onclick="verVenta(${v.id})">Ver</button>
        <button class="btn btn-danger btn-sm" onclick="deleteVenta(${v.id})">Eliminar</button>
      </td>
    </tr>
  `).join('') : '<tr><td colspan="7" style="text-align:center;color:#999;padding:40px">No hay ventas registradas</td></tr>';
}

async function showNuevaVenta() {
  const [clientes, productos] = await Promise.all([api('/api/clientes'), api('/api/productos')]);
  productosCache = productos;

  if (!clientes.length) return toast('Primero registra al menos un cliente', 'error');
  if (!productos.length) return toast('Primero registra al menos un producto', 'error');

  document.getElementById('venta-form-container').innerHTML = `
    <div class="form-card">
      <h3>Nueva Venta</h3>
      <div class="form-row">
        <div>
          <label>Cliente *</label>
          <select id="vf-cliente">
            <option value="">Seleccionar...</option>
            ${clientes.map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="venta-items" id="venta-items">
        <label>Productos</label>
      </div>
      <button class="btn btn-sm" style="background:var(--gray-200);margin-bottom:12px" onclick="addVentaItem()">+ Agregar producto</button>
      <div class="venta-total" id="venta-total">Total: $0.00</div>
      <div style="margin-top:12px">
        <button class="btn btn-primary" onclick="saveVenta()">Guardar Venta</button>
        <button class="btn" style="background:var(--gray-200)" onclick="this.closest('.form-card').remove()">Cancelar</button>
      </div>
    </div>
  `;
  addVentaItem();
}

function addVentaItem() {
  const container = document.getElementById('venta-items');
  const div = document.createElement('div');
  div.className = 'venta-item';
  div.innerHTML = `
    <div>
      <select class="vi-producto" onchange="updateVentaTotal()">
        <option value="">Producto...</option>
        ${productosCache.filter(p => p.activo).map(p => `<option value="${p.id}" data-precio="${p.precio_unitario}">${esc(p.nombre)} - ${formatMoney(p.precio_unitario)}</option>`).join('')}
      </select>
    </div>
    <div><input class="vi-cantidad" type="number" min="1" step="1" value="1" placeholder="Cant." onchange="updateVentaTotal()" oninput="updateVentaTotal()"></div>
    <div style="line-height:36px;text-align:right;font-weight:600" class="vi-subtotal">$0.00</div>
    <div><button class="btn btn-danger btn-sm" onclick="this.closest('.venta-item').remove();updateVentaTotal()">✕</button></div>
  `;
  container.appendChild(div);
}

function updateVentaTotal() {
  let total = 0;
  document.querySelectorAll('.venta-item').forEach(row => {
    const sel = row.querySelector('.vi-producto');
    const cant = parseFloat(row.querySelector('.vi-cantidad').value) || 0;
    const opt = sel.options[sel.selectedIndex];
    const precio = opt ? parseFloat(opt.dataset.precio) || 0 : 0;
    const sub = precio * cant;
    total += sub;
    row.querySelector('.vi-subtotal').textContent = formatMoney(sub);
  });
  document.getElementById('venta-total').textContent = 'Total: ' + formatMoney(total);
}

async function saveVenta() {
  const cliente_id = parseInt(document.getElementById('vf-cliente').value);
  if (!cliente_id) return toast('Selecciona un cliente', 'error');

  const items = [];
  let valid = true;
  document.querySelectorAll('.venta-item').forEach(row => {
    const producto_id = parseInt(row.querySelector('.vi-producto').value);
    const cantidad = parseFloat(row.querySelector('.vi-cantidad').value);
    if (!producto_id || !cantidad || cantidad <= 0) { valid = false; return; }
    items.push({ producto_id, cantidad });
  });

  if (!valid || !items.length) return toast('Agrega al menos un producto con cantidad válida', 'error');

  await api('/api/ventas', { method: 'POST', body: { cliente_id, items } });
  toast('Venta registrada', 'success');
  document.getElementById('venta-form-container').innerHTML = '';
  loadVentas();
}

async function verVenta(id) {
  const v = await api('/api/ventas/' + id);
  const saldo = v.total - v.pagado;

  document.getElementById('modal-content').innerHTML = `
    <h3>Venta #${v.id} — ${esc(v.cliente_nombre)}</h3>
    <p style="color:var(--gray-500);margin-bottom:16px">${formatDate(v.fecha)}</p>

    <table>
      <thead><tr><th>Producto</th><th>Cant.</th><th>P. Unit.</th><th>Subtotal</th></tr></thead>
      <tbody>
        ${v.detalles.map(d => `
          <tr>
            <td>${esc(d.producto_nombre)}</td>
            <td>${d.cantidad}</td>
            <td>${formatMoney(d.precio_unitario)}</td>
            <td>${formatMoney(d.subtotal)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div style="text-align:right;margin:12px 0;font-size:18px">
      <strong>Total: ${formatMoney(v.total)}</strong><br>
      <span style="color:var(--success)">Pagado: ${formatMoney(v.pagado)}</span><br>
      ${saldo > 0 ? `<span style="color:var(--danger)">Saldo: ${formatMoney(saldo)}</span>` : '<span class="badge badge-paid">PAGADA</span>'}
    </div>

    ${v.pagos.length ? `
      <h4 style="margin:16px 0 8px">Historial de Pagos</h4>
      <table>
        <thead><tr><th>Fecha</th><th>Monto</th><th>Método</th></tr></thead>
        <tbody>
          ${v.pagos.map(p => `
            <tr><td>${formatDate(p.fecha)}</td><td>${formatMoney(p.monto)}</td><td>${p.metodo}</td></tr>
          `).join('')}
        </tbody>
      </table>
    ` : ''}

    ${saldo > 0 ? `
      <h4 style="margin:16px 0 8px">Registrar Pago</h4>
      <div class="form-row">
        <div><label>Monto *</label><input id="pago-monto" type="number" step="0.01" min="0.01" max="${saldo.toFixed(2)}" value="${saldo.toFixed(2)}"></div>
        <div>
          <label>Método</label>
          <select id="pago-metodo">
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="otro">Otro</option>
          </select>
        </div>
      </div>
      <button class="btn btn-success" onclick="registrarPago(${v.id})">Registrar Pago</button>
    ` : ''}

    <div class="modal-actions">
      <button class="btn" style="background:var(--gray-200)" onclick="closeModal()">Cerrar</button>
    </div>
  `;
  document.getElementById('modal-overlay').style.display = 'flex';
}

async function registrarPago(ventaId) {
  const monto = parseFloat(document.getElementById('pago-monto').value);
  const metodo = document.getElementById('pago-metodo').value;
  if (!monto || monto <= 0) return toast('Ingresa un monto válido', 'error');

  await api('/api/pagos', { method: 'POST', body: { venta_id: ventaId, monto, metodo } });
  toast('Pago registrado', 'success');
  verVenta(ventaId); // recargar modal
  loadVentas(); // actualizar tabla de fondo
}

async function deleteVenta(id) {
  if (!confirm('¿Eliminar esta venta y sus pagos?')) return;
  await api('/api/ventas/' + id, { method: 'DELETE' });
  toast('Venta eliminada', 'success');
  loadVentas();
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
}

// ============ CARTERA VENCIDA ============
async function loadCartera() {
  const data = await api('/api/ventas/reportes/cartera-vencida');

  document.getElementById('cartera-stats').innerHTML = `
    <div class="stat-card">
      <div class="label">Cuentas pendientes</div>
      <div class="value">${data.cartera.length}</div>
    </div>
    <div class="stat-card">
      <div class="label">Total por cobrar</div>
      <div class="value danger">${formatMoney(data.totalPendiente)}</div>
    </div>
  `;

  const tbody = document.getElementById('cartera-table');
  tbody.innerHTML = data.cartera.length ? data.cartera.map(r => `
    <tr>
      <td><strong>${esc(r.cliente_nombre)}</strong></td>
      <td>${esc(r.cliente_telefono || '-')}</td>
      <td>${formatDate(r.fecha)}</td>
      <td>${formatMoney(r.total)}</td>
      <td>${formatMoney(r.pagado)}</td>
      <td style="color:var(--danger);font-weight:600">${formatMoney(r.saldo_pendiente)}</td>
      <td><span class="badge ${r.dias_transcurridos > 30 ? 'badge-overdue' : 'badge-pending'}">${r.dias_transcurridos} días</span></td>
      <td><button class="btn btn-success btn-sm" onclick="showSection('ventas');setTimeout(()=>verVenta(${r.venta_id}),300)">Pagar</button></td>
    </tr>
  `).join('') : '<tr><td colspan="8" style="text-align:center;color:var(--success);padding:40px">✓ No hay cuentas pendientes</td></tr>';
}

// ============ HELPERS ============
function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// Cargar clientes al inicio
loadClientes();
