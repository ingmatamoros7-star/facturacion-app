const API = '';

// ============ UTILIDADES ============
let toastCount = 0;
function toast(msg, type = '') {
  const icon = type === 'success'
    ? '<svg class="toast-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>'
    : type === 'error'
    ? '<svg class="toast-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
    : '';
  const el = document.createElement('div');
  const offset = toastCount * 60;
  toastCount++;
  el.className = 'toast ' + type;
  el.style.bottom = (24 + offset) + 'px';
  el.innerHTML = icon + '<span>' + esc(msg) + '</span>';
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(10px)';
    setTimeout(() => { el.remove(); toastCount = Math.max(0, toastCount - 1); }, 300);
  }, 3000);
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

// ============ LOADING ============
function showLoading() {
  document.getElementById('loading-overlay').style.display = 'flex';
}
function hideLoading() {
  document.getElementById('loading-overlay').style.display = 'none';
}

// ============ CONFIRM DIALOG ============
function confirmAction(title, message, btnText = 'Eliminar') {
  return new Promise(resolve => {
    const overlay = document.getElementById('confirm-overlay');
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    document.getElementById('confirm-ok').textContent = btnText;
    overlay.style.display = 'flex';

    const onOk = () => { cleanup(); resolve(true); };
    const onCancel = () => { cleanup(); resolve(false); };
    const onKey = e => { if (e.key === 'Escape') onCancel(); };

    function cleanup() {
      overlay.style.display = 'none';
      document.getElementById('confirm-ok').removeEventListener('click', onOk);
      document.getElementById('confirm-cancel').removeEventListener('click', onCancel);
      document.removeEventListener('keydown', onKey);
    }

    document.getElementById('confirm-ok').addEventListener('click', onOk);
    document.getElementById('confirm-cancel').addEventListener('click', onCancel);
    document.addEventListener('keydown', onKey);
  });
}

// ============ NAVEGACIÓN ============
const pageTitles = {
  dashboard: 'Dashboard',
  clientes: 'Clientes',
  productos: 'Productos',
  ventas: 'Ventas',
  cartera: 'Cartera Vencida',
};

function navigateTo(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('sec-' + name).classList.add('active');

  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  const navItem = document.querySelector(`.nav-item[data-section="${name}"]`);
  if (navItem) navItem.classList.add('active');

  document.getElementById('page-title').textContent = pageTitles[name] || name;

  // Close mobile sidebar
  closeSidebar();

  if (name === 'dashboard') loadDashboard();
  if (name === 'clientes') loadClientes();
  if (name === 'productos') loadProductos();
  if (name === 'ventas') loadVentas();
  if (name === 'cartera') loadCartera();
}

// Sidebar navigation
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    navigateTo(item.dataset.section);
  });
});

// Mobile sidebar toggle
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');

document.getElementById('menu-toggle').addEventListener('click', () => {
  sidebar.classList.add('open');
  sidebarOverlay.classList.add('active');
});

document.getElementById('sidebar-close').addEventListener('click', closeSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);

function closeSidebar() {
  sidebar.classList.remove('open');
  sidebarOverlay.classList.remove('active');
}

// ============ DASHBOARD ============
async function loadDashboard() {
  try {
    const [clientes, productos, ventas, cartera] = await Promise.all([
      api('/api/clientes'),
      api('/api/productos'),
      api('/api/ventas'),
      api('/api/ventas/reportes/cartera-vencida'),
    ]);

    document.getElementById('dash-clientes').textContent = clientes.length;
    document.getElementById('dash-productos').textContent = productos.length;

    const totalVentas = ventas.reduce((s, v) => s + v.total, 0);
    document.getElementById('dash-ventas-total').textContent = formatMoney(totalVentas);
    document.getElementById('dash-por-cobrar').textContent = formatMoney(cartera.totalPendiente);

    // Update cartera badge
    const badge = document.getElementById('cartera-badge');
    if (cartera.cartera.length > 0) {
      badge.textContent = cartera.cartera.length;
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }

    // Recent ventas
    const recientes = ventas.slice(0, 5);
    const recentesEl = document.getElementById('dash-ventas-recientes');
    recentesEl.innerHTML = recientes.length ? recientes.map(v => `
      <div class="panel-item" style="cursor:pointer" onclick="navigateTo('ventas');setTimeout(()=>verVenta(${v.id}),200)">
        <div class="panel-item-left">
          <span class="panel-item-name">${esc(v.cliente_nombre)}</span>
          <span class="panel-item-sub">${formatDate(v.fecha)}</span>
        </div>
        <div class="panel-item-right">
          <div class="panel-item-amount">${formatMoney(v.total)}</div>
          <span class="badge ${v.estado === 'pagada' ? 'badge-paid' : 'badge-pending'}" style="font-size:11px;padding:2px 8px">
            <span class="badge-dot"></span>${v.estado === 'pagada' ? 'Pagada' : 'Pendiente'}
          </span>
        </div>
      </div>
    `).join('') : '<div class="empty-state-sm">Sin ventas registradas aún</div>';

    // Cartera resumen
    const carteraResumen = document.getElementById('dash-cartera-resumen');
    const carteraTop = cartera.cartera.slice(0, 5);
    carteraResumen.innerHTML = carteraTop.length ? carteraTop.map(r => `
      <div class="panel-item" style="cursor:pointer" onclick="verVenta(${r.venta_id})">
        <div class="panel-item-left">
          <span class="panel-item-name">${esc(r.cliente_nombre)}</span>
          <span class="panel-item-sub">${r.dias_transcurridos} días pendiente</span>
        </div>
        <div class="panel-item-right">
          <div class="panel-item-amount" style="color:var(--danger)">${formatMoney(r.saldo_pendiente)}</div>
        </div>
      </div>
    `).join('') : '<div class="empty-state-sm">Sin cuentas pendientes</div>';

  } catch (e) { /* api() already toasts errors */ }
}

// ============ CLIENTES ============
let allClientes = [];

async function loadClientes() {
  try {
    allClientes = await api('/api/clientes');
    renderClientes(allClientes);
  } catch (e) { /* api() already toasts */ }
}

function renderClientes(list) {
  const tbody = document.getElementById('clientes-table');
  tbody.innerHTML = list.length ? list.map(c => `
    <tr>
      <td>
        <div class="client-name">${esc(c.nombre)}</div>
        ${c.direccion ? `<div class="client-email">${esc(c.direccion)}</div>` : ''}
      </td>
      <td>${esc(c.telefono || '-')}</td>
      <td>${esc(c.email || '-')}</td>
      <td class="text-right">
        <div class="td-actions">
          <button class="btn-icon" onclick="editCliente(${c.id})" title="Editar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon danger" onclick="deleteCliente(${c.id})" title="Eliminar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('') : `
    <tr><td colspan="4">
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <div class="empty-state-title">Sin clientes</div>
        <div class="empty-state-desc">Agrega tu primer cliente para comenzar</div>
      </div>
    </td></tr>`;
}

function filterClientes(q) {
  const term = q.toLowerCase();
  renderClientes(allClientes.filter(c =>
    c.nombre.toLowerCase().includes(term) ||
    (c.email || '').toLowerCase().includes(term) ||
    (c.telefono || '').includes(term)
  ));
}

function showClienteForm(cliente = null) {
  const c = cliente || {};
  document.getElementById('cliente-form-container').innerHTML = `
    <div class="form-card">
      <h3>${c.id ? 'Editar' : 'Nuevo'} Cliente</h3>
      <div class="form-row">
        <div class="form-group"><label>Nombre *</label><input id="cf-nombre" placeholder="Nombre completo" value="${esc(c.nombre || '')}"></div>
        <div class="form-group"><label>Teléfono</label><input id="cf-telefono" placeholder="(000) 000-0000" value="${esc(c.telefono || '')}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Email</label><input id="cf-email" type="email" placeholder="correo@ejemplo.com" value="${esc(c.email || '')}"></div>
        <div class="form-group"><label>Dirección</label><input id="cf-direccion" placeholder="Dirección del cliente" value="${esc(c.direccion || '')}"></div>
      </div>
      <div class="form-actions">
        <button class="btn btn-primary" onclick="saveCliente(${c.id || 0})">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
          Guardar
        </button>
        <button class="btn btn-outline" onclick="this.closest('.form-card').remove()">Cancelar</button>
      </div>
    </div>
  `;
  document.getElementById('cf-nombre').focus();
}

async function saveCliente(id) {
  const body = {
    nombre: document.getElementById('cf-nombre').value.trim(),
    telefono: document.getElementById('cf-telefono').value.trim(),
    email: document.getElementById('cf-email').value.trim(),
    direccion: document.getElementById('cf-direccion').value.trim(),
  };
  if (!body.nombre) return toast('El nombre es requerido', 'error');

  try {
    showLoading();
    if (id) {
      await api('/api/clientes/' + id, { method: 'PUT', body });
    } else {
      await api('/api/clientes', { method: 'POST', body });
    }
    toast('Cliente guardado', 'success');
    document.getElementById('cliente-form-container').innerHTML = '';
    loadClientes();
  } finally {
    hideLoading();
  }
}

async function editCliente(id) {
  try {
    const c = await api('/api/clientes/' + id);
    showClienteForm(c);
  } catch (e) { /* api() toasts */ }
}

async function deleteCliente(id) {
  const ok = await confirmAction(
    'Eliminar Cliente',
    '¿Estás seguro de que deseas eliminar este cliente? Esta acción no se puede deshacer.'
  );
  if (!ok) return;
  try {
    showLoading();
    await api('/api/clientes/' + id, { method: 'DELETE' });
    toast('Cliente eliminado', 'success');
    loadClientes();
  } catch (e) { /* api() toasts */ }
  finally { hideLoading(); }
}

// ============ PRODUCTOS ============
let allProductos = [];

async function loadProductos() {
  try {
    allProductos = await api('/api/productos');
    renderProductos(allProductos);
  } catch (e) { /* api() already toasts */ }
}

function renderProductos(list) {
  const tbody = document.getElementById('productos-table');
  tbody.innerHTML = list.length ? list.map(p => `
    <tr>
      <td>
        <div class="product-name">${esc(p.nombre)}</div>
      </td>
      <td><span class="product-desc">${esc(p.descripcion || '-')}</span></td>
      <td class="text-right"><strong>${formatMoney(p.precio_unitario)}</strong></td>
      <td class="text-right">
        <div class="td-actions">
          <button class="btn-icon" onclick="editProducto(${p.id})" title="Editar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon danger" onclick="deleteProducto(${p.id})" title="Eliminar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('') : `
    <tr><td colspan="4">
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
        </div>
        <div class="empty-state-title">Sin productos</div>
        <div class="empty-state-desc">Agrega tu primer producto para comenzar</div>
      </div>
    </td></tr>`;
}

function filterProductos(q) {
  const term = q.toLowerCase();
  renderProductos(allProductos.filter(p =>
    p.nombre.toLowerCase().includes(term) ||
    (p.descripcion || '').toLowerCase().includes(term)
  ));
}

function showProductoForm(producto = null) {
  const p = producto || {};
  document.getElementById('producto-form-container').innerHTML = `
    <div class="form-card">
      <h3>${p.id ? 'Editar' : 'Nuevo'} Producto</h3>
      <div class="form-row">
        <div class="form-group"><label>Nombre *</label><input id="pf-nombre" placeholder="Nombre del producto" value="${esc(p.nombre || '')}"></div>
        <div class="form-group"><label>Precio Unitario *</label><input id="pf-precio" type="number" step="0.01" min="0" placeholder="0.00" value="${p.precio_unitario || ''}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Descripción</label><input id="pf-descripcion" placeholder="Descripción breve" value="${esc(p.descripcion || '')}"></div>
      </div>
      <div class="form-actions">
        <button class="btn btn-primary" onclick="saveProducto(${p.id || 0})">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
          Guardar
        </button>
        <button class="btn btn-outline" onclick="this.closest('.form-card').remove()">Cancelar</button>
      </div>
    </div>
  `;
  document.getElementById('pf-nombre').focus();
}

async function saveProducto(id) {
  const body = {
    nombre: document.getElementById('pf-nombre').value.trim(),
    precio_unitario: parseFloat(document.getElementById('pf-precio').value),
    descripcion: document.getElementById('pf-descripcion').value.trim(),
  };
  if (!body.nombre || isNaN(body.precio_unitario)) return toast('Nombre y precio son requeridos', 'error');
  if (body.precio_unitario < 0) return toast('El precio no puede ser negativo', 'error');

  try {
    showLoading();
    if (id) {
      await api('/api/productos/' + id, { method: 'PUT', body });
    } else {
      await api('/api/productos', { method: 'POST', body });
    }
    toast('Producto guardado', 'success');
    document.getElementById('producto-form-container').innerHTML = '';
    loadProductos();
  } finally {
    hideLoading();
  }
}

async function editProducto(id) {
  try {
    const p = await api('/api/productos/' + id);
    showProductoForm(p);
  } catch (e) { /* api() toasts */ }
}

async function deleteProducto(id) {
  const ok = await confirmAction(
    'Eliminar Producto',
    '¿Estás seguro de que deseas eliminar este producto? Esta acción no se puede deshacer.'
  );
  if (!ok) return;
  try {
    showLoading();
    await api('/api/productos/' + id, { method: 'DELETE' });
    toast('Producto eliminado', 'success');
    loadProductos();
  } catch (e) { /* api() toasts */ }
  finally { hideLoading(); }
}

// ============ VENTAS ============
let productosCache = [];
let allVentas = [];

async function loadVentas() {
  try {
    allVentas = await api('/api/ventas');
    renderVentas(allVentas);
  } catch (e) { /* api() already toasts */ }
}

function renderVentas(ventas) {
  const tbody = document.getElementById('ventas-table');
  tbody.innerHTML = ventas.length ? ventas.map(v => `
    <tr data-clickable onclick="verVenta(${v.id})">
      <td><span style="color:var(--gray-500);font-weight:500">#${v.id}</span></td>
      <td><strong>${esc(v.cliente_nombre)}</strong></td>
      <td>${formatDate(v.fecha)}</td>
      <td class="text-right"><strong>${formatMoney(v.total)}</strong></td>
      <td class="text-right">${formatMoney(v.pagado)}</td>
      <td>
        <span class="badge ${v.estado === 'pagada' ? 'badge-paid' : 'badge-pending'}">
          <span class="badge-dot"></span>
          ${v.estado === 'pagada' ? 'Pagada' : 'Pendiente'}
        </span>
      </td>
      <td class="text-right">
        <div class="td-actions">
          <button class="btn-icon" onclick="event.stopPropagation();verVenta(${v.id})" title="Ver detalle">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button class="btn-icon danger" onclick="event.stopPropagation();deleteVenta(${v.id})" title="Eliminar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('') : `
    <tr><td colspan="7">
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
        </div>
        <div class="empty-state-title">Sin ventas</div>
        <div class="empty-state-desc">Registra tu primera venta para comenzar</div>
      </div>
    </td></tr>`;
}

function filterVentas(q) {
  const term = q.toLowerCase();
  renderVentas(allVentas.filter(v =>
    v.cliente_nombre.toLowerCase().includes(term) ||
    v.estado.toLowerCase().includes(term) ||
    ('#' + v.id).includes(term)
  ));
}

async function showNuevaVenta() {
  try {
    const [clientes, productos] = await Promise.all([api('/api/clientes'), api('/api/productos')]);
    productosCache = productos;

    if (!clientes.length) return toast('Primero registra al menos un cliente', 'error');
    if (!productos.length) return toast('Primero registra al menos un producto', 'error');

    document.getElementById('venta-form-container').innerHTML = `
      <div class="form-card">
        <h3>Nueva Venta</h3>
        <div class="form-row">
          <div class="form-group">
            <label>Cliente *</label>
            <select id="vf-cliente">
              <option value="">Seleccionar cliente...</option>
              ${clientes.map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Notas</label>
            <input id="vf-notas" placeholder="Notas adicionales (opcional)">
          </div>
        </div>
        <div class="venta-items" id="venta-items">
          <label>Productos</label>
        </div>
        <button class="btn btn-outline btn-sm" style="margin-bottom:16px" onclick="addVentaItem()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Agregar producto
        </button>
        <div class="venta-total" id="venta-total">Total: $0.00</div>
        <div class="form-actions">
          <button class="btn btn-primary" onclick="saveVenta()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
            Guardar Venta
          </button>
          <button class="btn btn-outline" onclick="this.closest('.form-card').remove()">Cancelar</button>
        </div>
      </div>
    `;
    addVentaItem();
  } catch (e) { /* api() toasts */ }
}

function addVentaItem() {
  const container = document.getElementById('venta-items');
  const div = document.createElement('div');
  div.className = 'venta-item';
  div.innerHTML = `
    <div>
      <select class="vi-producto" onchange="updateVentaTotal()">
        <option value="">Seleccionar producto...</option>
        ${productosCache.filter(p => p.activo === 1 || p.activo === true).map(p => `<option value="${p.id}" data-precio="${p.precio_unitario}">${esc(p.nombre)} — ${formatMoney(p.precio_unitario)}</option>`).join('')}
      </select>
    </div>
    <div><input class="vi-cantidad" type="number" min="1" step="1" value="1" placeholder="Cant." onchange="updateVentaTotal()" oninput="updateVentaTotal()"></div>
    <div style="line-height:38px;text-align:right;font-weight:600;color:var(--gray-700)" class="vi-subtotal">$0.00</div>
    <div>
      <button class="btn-icon danger" onclick="this.closest('.venta-item').remove();updateVentaTotal()" title="Quitar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
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

  const notas = document.getElementById('vf-notas') ? document.getElementById('vf-notas').value.trim() : '';
  const items = [];
  let valid = true;
  document.querySelectorAll('.venta-item').forEach(row => {
    const producto_id = parseInt(row.querySelector('.vi-producto').value);
    const cantidad = parseFloat(row.querySelector('.vi-cantidad').value);
    if (!producto_id || !cantidad || cantidad <= 0) { valid = false; return; }
    items.push({ producto_id, cantidad });
  });

  if (!valid || !items.length) return toast('Agrega al menos un producto con cantidad válida', 'error');

  try {
    showLoading();
    await api('/api/ventas', { method: 'POST', body: { cliente_id, items, notas } });
    toast('Venta registrada', 'success');
    document.getElementById('venta-form-container').innerHTML = '';
    loadVentas();
  } finally {
    hideLoading();
  }
}

async function verVenta(id) {
  try {
    const v = await api('/api/ventas/' + id);
    const saldo = v.total - v.pagado;

    document.getElementById('modal-content').innerHTML = `
      <h3>Venta #${v.id}</h3>
      <p style="color:var(--gray-500);margin-bottom:20px;font-size:14px">
        <strong>${esc(v.cliente_nombre)}</strong> &middot; ${formatDate(v.fecha)}
        ${v.notas ? `<br><span style="font-style:italic">${esc(v.notas)}</span>` : ''}
      </p>

      <div class="table-container" style="margin-bottom:16px">
        <table>
          <thead><tr><th>Producto</th><th class="text-right">Cant.</th><th class="text-right">P. Unit.</th><th class="text-right">Subtotal</th></tr></thead>
          <tbody>
            ${v.detalles.map(d => `
              <tr>
                <td><strong>${esc(d.producto_nombre)}</strong></td>
                <td class="text-right">${d.cantidad}</td>
                <td class="text-right">${formatMoney(d.precio_unitario)}</td>
                <td class="text-right"><strong>${formatMoney(d.subtotal)}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div style="text-align:right;margin:16px 0;font-size:15px;line-height:2">
        <div><span style="color:var(--gray-500)">Total:</span> <strong style="font-size:18px">${formatMoney(v.total)}</strong></div>
        <div><span style="color:var(--gray-500)">Pagado:</span> <span style="color:var(--success);font-weight:600">${formatMoney(v.pagado)}</span></div>
        ${saldo > 0.01
          ? `<div><span style="color:var(--gray-500)">Saldo:</span> <span style="color:var(--danger);font-weight:700">${formatMoney(saldo)}</span></div>`
          : '<div><span class="badge badge-paid"><span class="badge-dot"></span>PAGADA</span></div>'}
      </div>

      ${v.pagos.length ? `
        <h4 style="margin:20px 0 12px;font-size:14px;font-weight:700;color:var(--gray-700)">Historial de Pagos</h4>
        <div class="table-container">
          <table>
            <thead><tr><th>Fecha</th><th class="text-right">Monto</th><th>Método</th></tr></thead>
            <tbody>
              ${v.pagos.map(p => `
                <tr><td>${formatDate(p.fecha)}</td><td class="text-right"><strong>${formatMoney(p.monto)}</strong></td><td style="text-transform:capitalize">${p.metodo}</td></tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}

      ${saldo > 0.01 ? `
        <h4 style="margin:20px 0 12px;font-size:14px;font-weight:700;color:var(--gray-700)">Registrar Pago</h4>
        <div class="form-row">
          <div class="form-group"><label>Monto *</label><input id="pago-monto" type="number" step="0.01" min="0.01" max="${saldo.toFixed(2)}" value="${saldo.toFixed(2)}"></div>
          <div class="form-group">
            <label>Método</label>
            <select id="pago-metodo">
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="otro">Otro</option>
            </select>
          </div>
        </div>
        <button class="btn btn-success" onclick="registrarPago(${v.id})">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          Registrar Pago
        </button>
      ` : ''}

      <div class="modal-actions">
        <button class="btn btn-outline" onclick="closeModal()">Cerrar</button>
      </div>
    `;
    document.getElementById('modal-overlay').style.display = 'flex';
  } catch (e) { /* api() toasts */ }
}

async function registrarPago(ventaId) {
  const monto = parseFloat(document.getElementById('pago-monto').value);
  const metodo = document.getElementById('pago-metodo').value;
  if (!monto || monto <= 0) return toast('Ingresa un monto válido', 'error');

  try {
    showLoading();
    await api('/api/pagos', { method: 'POST', body: { venta_id: ventaId, monto, metodo } });
    toast('Pago registrado', 'success');
    verVenta(ventaId);
    loadVentas();
  } finally {
    hideLoading();
  }
}

async function deleteVenta(id) {
  const ok = await confirmAction(
    'Eliminar Venta',
    '¿Estás seguro de que deseas eliminar esta venta y todos sus pagos asociados? Esta acción no se puede deshacer.'
  );
  if (!ok) return;
  try {
    showLoading();
    await api('/api/ventas/' + id, { method: 'DELETE' });
    toast('Venta eliminada', 'success');
    loadVentas();
  } catch (e) { /* api() toasts */ }
  finally { hideLoading(); }
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
}

// ============ CARTERA VENCIDA ============
async function loadCartera() {
  try {
    const data = await api('/api/ventas/reportes/cartera-vencida');

    document.getElementById('cartera-stats').innerHTML = `
      <div class="stat-card card-warning">
        <div class="label">Cuentas Pendientes</div>
        <div class="value warning">${data.cartera.length}</div>
      </div>
      <div class="stat-card card-danger">
        <div class="label">Total por Cobrar</div>
        <div class="value danger">${formatMoney(data.totalPendiente)}</div>
      </div>
      <div class="stat-card card-primary">
        <div class="label">Promedio por Cuenta</div>
        <div class="value">${data.cartera.length ? formatMoney(data.totalPendiente / data.cartera.length) : '$0.00'}</div>
      </div>
    `;

    const tbody = document.getElementById('cartera-table');
    tbody.innerHTML = data.cartera.length ? data.cartera.map(r => `
      <tr data-clickable onclick="verVenta(${r.venta_id})">
        <td><strong>${esc(r.cliente_nombre)}</strong></td>
        <td>${esc(r.cliente_telefono || '-')}</td>
        <td>${formatDate(r.fecha)}</td>
        <td class="text-right">${formatMoney(r.total)}</td>
        <td class="text-right">${formatMoney(r.pagado)}</td>
        <td class="text-right" style="color:var(--danger);font-weight:700">${formatMoney(r.saldo_pendiente)}</td>
        <td>
          <span class="badge ${r.dias_transcurridos > 30 ? 'badge-overdue' : 'badge-pending'}">
            <span class="badge-dot"></span>${r.dias_transcurridos} días
          </span>
        </td>
        <td class="text-right">
          <button class="btn btn-success btn-sm" onclick="event.stopPropagation();verVenta(${r.venta_id})">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            Cobrar
          </button>
        </td>
      </tr>
    `).join('') : `
      <tr><td colspan="8">
        <div class="empty-state">
          <div class="empty-state-icon" style="background:var(--success-light);color:var(--success)">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
          <div class="empty-state-title">Todo al día</div>
          <div class="empty-state-desc">No hay cuentas pendientes de cobro</div>
        </div>
      </td></tr>`;
  } catch (e) { /* api() already toasts */ }
}

// ============ HELPERS ============
function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// Set date in topbar
function updateTopbarDate() {
  const now = new Date();
  const opts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  const dateStr = now.toLocaleDateString('es-MX', opts);
  document.getElementById('topbar-date').textContent = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
}

// Keyboard shortcut: ESC to close modal
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// Init
updateTopbarDate();
loadDashboard();
