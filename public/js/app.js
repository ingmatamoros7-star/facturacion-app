const API = '';
let currentUser = null;

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
  return '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}
function esc(str) {
  if (str == null) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

async function api(path, opts = {}) {
  try {
    const res = await fetch(API + path, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      ...opts,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    if (res.status === 401) {
      showLogin();
      throw new Error('Sesión expirada. Inicia sesión nuevamente.');
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error del servidor');
    return data;
  } catch (err) {
    if (err.message) toast(err.message, 'error');
    throw err;
  }
}

function showLoading() { document.getElementById('loading-overlay').style.display = 'flex'; }
function hideLoading() { document.getElementById('loading-overlay').style.display = 'none'; }

// ============ ESTADOS / ETIQUETAS ============
const ESTADO_INFO = {
  pagado: { cls: 'badge-paid', label: 'Pagado' },
  pendiente: { cls: 'badge-pending', label: 'Pendiente' },
  parcial: { cls: 'badge-partial', label: 'Pago parcial' },
  vencido: { cls: 'badge-overdue', label: 'Vencido' },
};
function estadoBadge(estado) {
  const i = ESTADO_INFO[estado] || ESTADO_INFO.pendiente;
  return `<span class="badge ${i.cls}"><span class="badge-dot"></span>${i.label}</span>`;
}
const FORMA_PAGO_LABEL = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta', credito: 'Crédito' };

// ============ AUTENTICACIÓN ============
function showLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}
function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
}

async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (!res.ok) { showLogin(); return; }
    currentUser = await res.json();
    renderUser();
    showApp();
    updateTopbarDate();
    navigateTo('dashboard');
  } catch (e) {
    showLogin();
  }
}

function renderUser() {
  if (!currentUser) return;
  const initials = currentUser.nombre.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  document.getElementById('user-avatar').textContent = initials || 'U';
  document.getElementById('user-name').textContent = currentUser.nombre;
  const n2 = document.getElementById('user-name2');
  if (n2) n2.textContent = currentUser.nombre;
  document.getElementById('user-role').textContent = currentUser.rol === 'admin' ? 'Administrador' : 'Usuario';
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  try {
    showLoading();
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error || 'Error al iniciar sesión'; errEl.style.display = 'block'; return; }
    currentUser = data;
    document.getElementById('login-password').value = '';
    renderUser();
    showApp();
    updateTopbarDate();
    navigateTo('dashboard');
  } catch (err) {
    errEl.textContent = 'No se pudo conectar con el servidor';
    errEl.style.display = 'block';
  } finally {
    hideLoading();
  }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }); } catch (e) {}
  currentUser = null;
  showLogin();
});

function showCuenta() {
  document.getElementById('modal-content').innerHTML = `
    <h3>Mi cuenta</h3>
    <p style="color:var(--gray-500);margin-bottom:20px;font-size:14px">${esc(currentUser.nombre)} &middot; ${esc(currentUser.email)}</p>
    <h4 style="margin:0 0 12px;font-size:14px;font-weight:700;color:var(--gray-700)">Cambiar contraseña</h4>
    <div class="form-row">
      <div class="form-group"><label>Contraseña actual</label><input id="cp-actual" type="password"></div>
      <div class="form-group"><label>Nueva contraseña</label><input id="cp-nueva" type="password" placeholder="Mínimo 6 caracteres"></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeModal()">Cerrar</button>
      <button class="btn btn-primary" onclick="cambiarPassword()">Guardar</button>
    </div>`;
  document.getElementById('modal-overlay').style.display = 'flex';
}

async function cambiarPassword() {
  const actual = document.getElementById('cp-actual').value;
  const nueva = document.getElementById('cp-nueva').value;
  if (!actual || !nueva) return toast('Completa ambos campos', 'error');
  try {
    showLoading();
    await api('/api/auth/cambiar-password', { method: 'POST', body: { actual, nueva } });
    toast('Contraseña actualizada', 'success');
    closeModal();
  } catch (e) {} finally { hideLoading(); }
}

// ============ NAVEGACIÓN ============
const pageTitles = {
  dashboard: 'Inicio', ventas: 'Ventas', cobros: '¿A quién cobrar?',
  cuentas: 'Cuentas por cobrar', cartera: 'Cartera vencida',
  clientes: 'Clientes', productos: 'Productos', reportes: 'Reportes',
};

// Submódulos agrupados en el menú "Cobranza"
const COBRANZA_SUBS = ['cobros', 'cuentas', 'cartera'];

function navigateTo(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const sec = document.getElementById('sec-' + name);
  if (sec) sec.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  const navItem = document.querySelector(`.nav-item[data-section="${name}"]`);
  if (navItem) navItem.classList.add('active');
  // Resaltar el menú padre "Cobranza" si el submódulo está activo
  const cobranzaTrigger = document.querySelector('.menu-trigger[data-menu="cobranza"]');
  if (cobranzaTrigger) cobranzaTrigger.classList.toggle('active', COBRANZA_SUBS.includes(name));

  const pt = document.getElementById('page-title');
  if (pt) pt.textContent = pageTitles[name] || name;
  closeMobileMenu();
  closeAllDropdowns();

  if (name === 'dashboard') loadDashboard();
  if (name === 'ventas') loadVentas();
  if (name === 'cobros') loadCobros();
  if (name === 'cuentas') loadCuentas();
  if (name === 'cartera') loadCartera();
  if (name === 'clientes') loadClientes();
  if (name === 'productos') loadProductos();
  if (name === 'reportes') loadReportes();
}

// Navegación: solo los enlaces con data-section navegan
document.querySelectorAll('.nav-item[data-section]').forEach(item => {
  item.addEventListener('click', e => { e.preventDefault(); navigateTo(item.dataset.section); });
});

// Menús desplegables (Cobranza, Usuario)
function closeAllDropdowns() {
  document.querySelectorAll('.menu-dropdown.open').forEach(d => d.classList.remove('open'));
}
document.querySelectorAll('.menu-trigger').forEach(trigger => {
  trigger.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    const parent = trigger.closest('.menu-dropdown');
    const wasOpen = parent.classList.contains('open');
    closeAllDropdowns();
    if (!wasOpen) parent.classList.add('open');
  });
});
document.addEventListener('click', () => closeAllDropdowns());

// Menú móvil
const mainmenu = document.getElementById('mainmenu');
const menuOverlay = document.getElementById('menu-overlay');
document.getElementById('menu-toggle').addEventListener('click', e => {
  e.stopPropagation();
  const open = mainmenu.classList.toggle('open');
  menuOverlay.classList.toggle('active', open);
});
menuOverlay.addEventListener('click', closeMobileMenu);
function closeMobileMenu() {
  mainmenu.classList.remove('open');
  menuOverlay.classList.remove('active');
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

function closeModal() { document.getElementById('modal-overlay').style.display = 'none'; }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ============ WHATSAPP ============
function whatsappLink(telefono, mensaje) {
  const num = (telefono || '').replace(/\D/g, '');
  if (!num) return null;
  return `https://wa.me/${num}?text=${encodeURIComponent(mensaje)}`;
}
function btnWhatsapp(telefono, nombre, saldo) {
  const msg = `Hola ${nombre}, le recordamos que tiene un saldo pendiente de ${formatMoney(saldo)}. Quedamos atentos. ¡Gracias!`;
  const link = whatsappLink(telefono, msg);
  if (!link) return '';
  return `<a class="btn btn-wa btn-sm" href="${link}" target="_blank" rel="noopener" onclick="event.stopPropagation()" title="Contactar por WhatsApp">
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.2-1.7-.8-2-.9-.3-.1-.5-.2-.7.2-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3zM12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2z"/></svg>
    WhatsApp</a>`;
}

// ============ DASHBOARD ============
async function loadDashboard() {
  try {
    const d = await api('/api/dashboard');
    document.getElementById('dash-metrics').innerHTML = `
      ${metricCard('Ventas del día', formatMoney(d.ventas_dia), 'rgba(13,148,136,.12)', '#0d9488', iconSale())}
      ${metricCard('Ventas del mes', formatMoney(d.ventas_mes), 'rgba(15,118,110,.12)', '#0f766e', iconChart())}
      ${metricCard('Total cobrado', formatMoney(d.total_cobrado), 'rgba(16,185,129,.14)', '#059669', iconCash())}
      ${metricCard('Por cobrar', formatMoney(d.por_cobrar), 'rgba(245,158,11,.14)', '#d97706', iconWallet())}
      ${metricCard('Cartera vencida', formatMoney(d.cartera_vencida), 'rgba(239,68,68,.1)', '#dc2626', iconAlert())}
      ${metricCard('Clientes con deuda', String(d.clientes_con_deuda), 'rgba(13,148,136,.12)', '#0d9488', iconUsers())}
    `;

    const badge = document.getElementById('cartera-badge');
    const seg = d.seguimiento || [];
    if (seg.length) { badge.textContent = seg.length; badge.style.display = 'block'; } else { badge.style.display = 'none'; }

    document.getElementById('dash-ventas-recientes').innerHTML = (d.ventas_recientes || []).length
      ? d.ventas_recientes.map(v => `
        <div class="panel-item" style="cursor:pointer" onclick="verVenta(${v.id})">
          <div class="panel-item-left">
            <span class="panel-item-name">${esc(v.cliente_nombre)}</span>
            <span class="panel-item-sub">${esc(v.numero || '#' + v.id)} &middot; ${formatDate(v.fecha)}</span>
          </div>
          <div class="panel-item-right">
            <div class="panel-item-amount">${formatMoney(v.total)}</div>
            ${estadoBadge(v.estado)}
          </div>
        </div>`).join('')
      : '<div class="empty-state-sm">Sin ventas registradas aún</div>';

    document.getElementById('dash-seguimiento').innerHTML = seg.length
      ? seg.map(v => `
        <div class="panel-item" style="cursor:pointer" onclick="verVenta(${v.id})">
          <div class="panel-item-left">
            <span class="panel-item-name">${esc(v.cliente_nombre)}</span>
            <span class="panel-item-sub">${v.dias_vencido} días vencido</span>
          </div>
          <div class="panel-item-right">
            <div class="panel-item-amount" style="color:var(--danger)">${formatMoney(v.saldo)}</div>
          </div>
        </div>`).join('')
      : '<div class="empty-state-sm">No hay clientes por cobrar 🎉</div>';
  } catch (e) {}
}

function metricCard(label, value, bg, color, icon) {
  return `<div class="metric-card">
    <div class="metric-icon" style="background:${bg};color:${color}">${icon}</div>
    <div class="metric-info"><span class="metric-label">${label}</span><span class="metric-value">${value}</span></div>
  </div>`;
}
function iconSale(){return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>';}
function iconChart(){return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>';}
function iconCash(){return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>';}
function iconWallet(){return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>';}
function iconAlert(){return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';}
function iconUsers(){return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';}

// ============ CLIENTES ============
let allClientes = [];
async function loadClientes() {
  try { allClientes = await api('/api/clientes'); renderClientes(allClientes); } catch (e) {}
}
function renderClientes(list) {
  const tbody = document.getElementById('clientes-table');
  tbody.innerHTML = list.length ? list.map(c => `
    <tr data-clickable onclick="verCliente(${c.id})">
      <td>
        <div class="client-name">${esc(c.nombre)}</div>
        ${c.email ? `<div class="client-email">${esc(c.email)}</div>` : ''}
      </td>
      <td>${esc(c.identificacion || '-')}</td>
      <td>${esc(c.telefono || '-')}</td>
      <td class="text-right">${c.saldo_pendiente > 0 ? `<strong style="color:var(--danger)">${formatMoney(c.saldo_pendiente)}</strong>` : '<span style="color:var(--gray-400)">$0.00</span>'}</td>
      <td>${c.activo ? '<span class="badge badge-paid"><span class="badge-dot"></span>Activo</span>' : '<span class="badge badge-off"><span class="badge-dot"></span>Inactivo</span>'}</td>
      <td class="text-right">
        <div class="td-actions">
          <button class="btn-icon" onclick="event.stopPropagation();editCliente(${c.id})" title="Editar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="btn-icon danger" onclick="event.stopPropagation();deleteCliente(${c.id})" title="Eliminar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
        </div>
      </td>
    </tr>`).join('') : emptyRow(6, iconUsers(), 'Sin clientes', 'Agrega tu primer cliente para comenzar');
}
function filterClientes(q) {
  const t = q.toLowerCase();
  renderClientes(allClientes.filter(c =>
    c.nombre.toLowerCase().includes(t) ||
    (c.identificacion || '').toLowerCase().includes(t) ||
    (c.telefono || '').includes(t)));
}
function showClienteForm(c = null) {
  c = c || {};
  document.getElementById('cliente-form-container').innerHTML = `
    <div class="form-card">
      <h3>${c.id ? 'Editar' : 'Nuevo'} cliente</h3>
      <div class="form-row">
        <div class="form-group"><label>Nombre / Razón social *</label><input id="cf-nombre" value="${esc(c.nombre || '')}"></div>
        <div class="form-group"><label>Cédula / RUC</label><input id="cf-ident" value="${esc(c.identificacion || '')}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Teléfono</label><input id="cf-telefono" placeholder="Ej: 0991234567" value="${esc(c.telefono || '')}"></div>
        <div class="form-group"><label>Email</label><input id="cf-email" type="email" value="${esc(c.email || '')}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Dirección</label><input id="cf-direccion" value="${esc(c.direccion || '')}"></div>
        <div class="form-group"><label>Estado</label><select id="cf-activo"><option value="1" ${c.activo === 0 ? '' : 'selected'}>Activo</option><option value="0" ${c.activo === 0 ? 'selected' : ''}>Inactivo</option></select></div>
      </div>
      <div class="form-row"><div class="form-group"><label>Observaciones</label><textarea id="cf-notas">${esc(c.notas || '')}</textarea></div></div>
      <div class="form-actions">
        <button class="btn btn-primary" onclick="saveCliente(${c.id || 0})">Guardar</button>
        <button class="btn btn-outline" onclick="this.closest('.form-card').remove()">Cancelar</button>
      </div>
    </div>`;
  document.getElementById('cf-nombre').focus();
}
async function saveCliente(id) {
  const body = {
    nombre: document.getElementById('cf-nombre').value.trim(),
    identificacion: document.getElementById('cf-ident').value.trim(),
    telefono: document.getElementById('cf-telefono').value.trim(),
    email: document.getElementById('cf-email').value.trim(),
    direccion: document.getElementById('cf-direccion').value.trim(),
    notas: document.getElementById('cf-notas').value.trim(),
    activo: parseInt(document.getElementById('cf-activo').value),
  };
  if (!body.nombre) return toast('El nombre es requerido', 'error');
  try {
    showLoading();
    if (id) await api('/api/clientes/' + id, { method: 'PUT', body });
    else await api('/api/clientes', { method: 'POST', body });
    toast('Cliente guardado', 'success');
    document.getElementById('cliente-form-container').innerHTML = '';
    loadClientes();
  } catch (e) {} finally { hideLoading(); }
}
async function editCliente(id) {
  try { showClienteForm(await api('/api/clientes/' + id)); } catch (e) {}
}
async function deleteCliente(id) {
  if (!await confirmAction('Eliminar cliente', '¿Eliminar este cliente? Esta acción no se puede deshacer.')) return;
  try { showLoading(); await api('/api/clientes/' + id, { method: 'DELETE' }); toast('Cliente eliminado', 'success'); loadClientes(); }
  catch (e) {} finally { hideLoading(); }
}
async function verCliente(id) {
  try {
    const d = await api('/api/clientes/' + id + '/historial');
    const c = d.cliente;
    document.getElementById('modal-content').innerHTML = `
      <h3>${esc(c.nombre)}</h3>
      <p style="color:var(--gray-500);margin-bottom:16px;font-size:14px">
        ${c.identificacion ? esc(c.identificacion) + ' &middot; ' : ''}${esc(c.telefono || 'Sin teléfono')}${c.email ? ' &middot; ' + esc(c.email) : ''}
      </p>
      <div class="stat-cards" style="margin-bottom:16px">
        <div class="stat-card card-warning"><div class="label">Saldo pendiente</div><div class="value warning">${formatMoney(d.saldo_pendiente)}</div></div>
        <div class="stat-card card-danger"><div class="label">Cartera vencida</div><div class="value danger">${formatMoney(d.cartera_vencida)}</div></div>
        <div class="stat-card card-primary"><div class="label">Compras</div><div class="value">${d.ventas.length}</div></div>
      </div>
      <h4 style="margin:16px 0 12px;font-size:14px;font-weight:700;color:var(--gray-700)">Historial de compras</h4>
      <div class="table-container">
        <table><thead><tr><th># Venta</th><th>Fecha</th><th class="text-right">Total</th><th class="text-right">Saldo</th><th>Estado</th></tr></thead>
        <tbody>${d.ventas.length ? d.ventas.map(v => `
          <tr data-clickable onclick="closeModal();verVenta(${v.id})"><td>${esc(v.numero || '#' + v.id)}</td><td>${formatDate(v.fecha)}</td><td class="text-right">${formatMoney(v.total)}</td><td class="text-right">${v.saldo > 0 ? `<strong style="color:var(--danger)">${formatMoney(v.saldo)}</strong>` : '$0.00'}</td><td>${estadoBadge(v.estado)}</td></tr>`).join('')
          : '<tr><td colspan="5" style="text-align:center;color:var(--gray-400);padding:24px">Sin compras registradas</td></tr>'}</tbody></table>
      </div>
      <div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Cerrar</button></div>`;
    document.getElementById('modal-overlay').style.display = 'flex';
  } catch (e) {}
}

// ============ PRODUCTOS ============
let allProductos = [];
async function loadProductos() {
  try { allProductos = await api('/api/productos'); renderProductos(allProductos); } catch (e) {}
}
function renderProductos(list) {
  const tbody = document.getElementById('productos-table');
  tbody.innerHTML = list.length ? list.map(p => `
    <tr>
      <td><span style="color:var(--gray-500);font-weight:500">${esc(p.codigo || '-')}</span></td>
      <td><div class="product-name">${esc(p.nombre)}</div></td>
      <td><span class="product-desc">${esc(p.descripcion || '-')}</span></td>
      <td class="text-right"><strong>${formatMoney(p.precio_unitario)}</strong></td>
      <td>${p.activo ? '<span class="badge badge-paid"><span class="badge-dot"></span>Activo</span>' : '<span class="badge badge-off"><span class="badge-dot"></span>Inactivo</span>'}</td>
      <td class="text-right">
        <div class="td-actions">
          <button class="btn-icon" onclick="editProducto(${p.id})" title="Editar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="btn-icon danger" onclick="deleteProducto(${p.id})" title="Eliminar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
        </div>
      </td>
    </tr>`).join('') : emptyRow(6, iconBox(), 'Sin productos', 'Agrega tu primer producto para comenzar');
}
function iconBox(){return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>';}
function filterProductos(q) {
  const t = q.toLowerCase();
  renderProductos(allProductos.filter(p => p.nombre.toLowerCase().includes(t) || (p.codigo || '').toLowerCase().includes(t) || (p.descripcion || '').toLowerCase().includes(t)));
}
function showProductoForm(p = null) {
  p = p || {};
  document.getElementById('producto-form-container').innerHTML = `
    <div class="form-card">
      <h3>${p.id ? 'Editar' : 'Nuevo'} producto / servicio</h3>
      <div class="form-row">
        <div class="form-group"><label>Código</label><input id="pf-codigo" value="${esc(p.codigo || '')}"></div>
        <div class="form-group"><label>Nombre *</label><input id="pf-nombre" value="${esc(p.nombre || '')}"></div>
        <div class="form-group"><label>Precio unitario *</label><input id="pf-precio" type="number" step="0.01" min="0" value="${p.precio_unitario != null ? p.precio_unitario : ''}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Descripción</label><input id="pf-descripcion" value="${esc(p.descripcion || '')}"></div>
        <div class="form-group"><label>Estado</label><select id="pf-activo"><option value="1" ${p.activo === 0 ? '' : 'selected'}>Activo</option><option value="0" ${p.activo === 0 ? 'selected' : ''}>Inactivo</option></select></div>
      </div>
      <div class="form-actions">
        <button class="btn btn-primary" onclick="saveProducto(${p.id || 0})">Guardar</button>
        <button class="btn btn-outline" onclick="this.closest('.form-card').remove()">Cancelar</button>
      </div>
    </div>`;
  document.getElementById('pf-nombre').focus();
}
async function saveProducto(id) {
  const body = {
    codigo: document.getElementById('pf-codigo').value.trim(),
    nombre: document.getElementById('pf-nombre').value.trim(),
    precio_unitario: parseFloat(document.getElementById('pf-precio').value),
    descripcion: document.getElementById('pf-descripcion').value.trim(),
    activo: parseInt(document.getElementById('pf-activo').value),
  };
  if (!body.nombre || isNaN(body.precio_unitario)) return toast('Nombre y precio son requeridos', 'error');
  if (body.precio_unitario < 0) return toast('El precio no puede ser negativo', 'error');
  try {
    showLoading();
    if (id) await api('/api/productos/' + id, { method: 'PUT', body });
    else await api('/api/productos', { method: 'POST', body });
    toast('Producto guardado', 'success');
    document.getElementById('producto-form-container').innerHTML = '';
    loadProductos();
  } catch (e) {} finally { hideLoading(); }
}
async function editProducto(id) { try { showProductoForm(await api('/api/productos/' + id)); } catch (e) {} }
async function deleteProducto(id) {
  if (!await confirmAction('Eliminar producto', '¿Eliminar este producto? Esta acción no se puede deshacer.')) return;
  try { showLoading(); await api('/api/productos/' + id, { method: 'DELETE' }); toast('Producto eliminado', 'success'); loadProductos(); }
  catch (e) {} finally { hideLoading(); }
}

// ============ VENTAS ============
let productosCache = [];
let allVentas = [];
async function loadVentas() {
  try { allVentas = await api('/api/ventas'); renderVentas(allVentas); } catch (e) {}
}
function renderVentas(ventas) {
  const tbody = document.getElementById('ventas-table');
  tbody.innerHTML = ventas.length ? ventas.map(v => `
    <tr data-clickable onclick="verVenta(${v.id})">
      <td><span style="color:var(--gray-500);font-weight:600">${esc(v.numero || '#' + v.id)}</span></td>
      <td><strong>${esc(v.cliente_nombre)}</strong></td>
      <td>${formatDate(v.fecha)}</td>
      <td class="text-right"><strong>${formatMoney(v.total)}</strong></td>
      <td class="text-right">${formatMoney(v.pagado)}</td>
      <td class="text-right">${v.saldo > 0 ? `<strong style="color:var(--danger)">${formatMoney(v.saldo)}</strong>` : '$0.00'}</td>
      <td>${estadoBadge(v.estado)}</td>
      <td class="text-right">
        <div class="td-actions">
          <button class="btn-icon" onclick="event.stopPropagation();verVenta(${v.id})" title="Ver detalle"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
          <button class="btn-icon danger" onclick="event.stopPropagation();deleteVenta(${v.id})" title="Eliminar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
        </div>
      </td>
    </tr>`).join('') : emptyRow(8, iconSale(), 'Sin ventas', 'Registra tu primera venta para comenzar');
}
function filterVentas(q) {
  const t = q.toLowerCase();
  renderVentas(allVentas.filter(v =>
    v.cliente_nombre.toLowerCase().includes(t) ||
    (v.numero || '').toLowerCase().includes(t) ||
    (ESTADO_INFO[v.estado] ? ESTADO_INFO[v.estado].label.toLowerCase() : '').includes(t)));
}

async function showNuevaVenta() {
  try {
    const [clientes, productos] = await Promise.all([api('/api/clientes'), api('/api/productos')]);
    productosCache = productos.filter(p => p.activo);
    const clientesActivos = clientes.filter(c => c.activo);
    if (!clientesActivos.length) return toast('Primero registra al menos un cliente activo', 'error');
    if (!productosCache.length) return toast('Primero registra al menos un producto activo', 'error');

    document.getElementById('venta-form-container').innerHTML = `
      <div class="form-card">
        <h3>Nueva venta</h3>
        <div class="form-row">
          <div class="form-group"><label>Cliente *</label>
            <select id="vf-cliente"><option value="">Seleccionar cliente...</option>${clientesActivos.map(c => `<option value="${c.id}">${esc(c.nombre)}${c.identificacion ? ' · ' + esc(c.identificacion) : ''}</option>`).join('')}</select>
          </div>
          <div class="form-group"><label>Fecha</label><input id="vf-fecha" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
        </div>
        <label style="margin-bottom:8px">Productos / servicios</label>
        <div class="venta-items" id="venta-items"></div>
        <button class="btn btn-outline btn-sm" style="margin-bottom:16px" onclick="addVentaItem()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Agregar línea
        </button>
        <div class="form-row">
          <div class="form-group"><label>Descuento</label><input id="vf-descuento" type="number" step="0.01" min="0" value="0" oninput="updateVentaTotal()"></div>
          <div class="form-group"><label>Forma de pago *</label>
            <select id="vf-forma" onchange="toggleCredito()">
              <option value="efectivo">Efectivo (contado)</option>
              <option value="transferencia">Transferencia (contado)</option>
              <option value="tarjeta">Tarjeta (contado)</option>
              <option value="credito">Crédito</option>
            </select>
          </div>
        </div>
        <div class="form-row" id="credito-fields" style="display:none">
          <div class="form-group"><label>Fecha de vencimiento *</label><input id="vf-vencimiento" type="date"></div>
          <div class="form-group"><label>Pago inicial (abono)</label><input id="vf-inicial" type="number" step="0.01" min="0" value="0"></div>
        </div>
        <div class="form-row"><div class="form-group"><label>Observaciones</label><input id="vf-notas"></div></div>
        <div class="venta-totales">
          <div><span>Subtotal</span><strong id="vt-subtotal">$0.00</strong></div>
          <div><span>Descuento</span><strong id="vt-descuento">$0.00</strong></div>
          <div class="venta-total-final"><span>Total</span><strong id="vt-total">$0.00</strong></div>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" onclick="saveVenta()">Guardar venta</button>
          <button class="btn btn-outline" onclick="this.closest('.form-card').remove()">Cancelar</button>
        </div>
      </div>`;
    addVentaItem();
  } catch (e) {}
}
function toggleCredito() {
  const esCredito = document.getElementById('vf-forma').value === 'credito';
  document.getElementById('credito-fields').style.display = esCredito ? '' : 'none';
}
function addVentaItem() {
  const container = document.getElementById('venta-items');
  const div = document.createElement('div');
  div.className = 'venta-item';
  div.innerHTML = `
    <select class="vi-producto" onchange="onItemProducto(this)">
      <option value="">Seleccionar...</option>
      ${productosCache.map(p => `<option value="${p.id}" data-precio="${p.precio_unitario}">${esc(p.nombre)} — ${formatMoney(p.precio_unitario)}</option>`).join('')}
    </select>
    <input class="vi-cantidad" type="number" min="0.01" step="1" value="1" placeholder="Cant." oninput="updateVentaTotal()">
    <input class="vi-precio" type="number" min="0" step="0.01" value="0" placeholder="P. Unit." oninput="updateVentaTotal()">
    <div class="vi-subtotal">$0.00</div>
    <button class="btn-icon danger" onclick="this.closest('.venta-item').remove();updateVentaTotal()" title="Quitar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`;
  container.appendChild(div);
}
function onItemProducto(sel) {
  const opt = sel.options[sel.selectedIndex];
  const precio = opt ? parseFloat(opt.dataset.precio) || 0 : 0;
  sel.closest('.venta-item').querySelector('.vi-precio').value = precio;
  updateVentaTotal();
}
function updateVentaTotal() {
  let subtotal = 0;
  document.querySelectorAll('.venta-item').forEach(row => {
    const cant = parseFloat(row.querySelector('.vi-cantidad').value) || 0;
    const precio = parseFloat(row.querySelector('.vi-precio').value) || 0;
    const sub = cant * precio;
    subtotal += sub;
    row.querySelector('.vi-subtotal').textContent = formatMoney(sub);
  });
  let desc = parseFloat(document.getElementById('vf-descuento').value) || 0;
  if (desc < 0) desc = 0;
  if (desc > subtotal) desc = subtotal;
  document.getElementById('vt-subtotal').textContent = formatMoney(subtotal);
  document.getElementById('vt-descuento').textContent = formatMoney(desc);
  document.getElementById('vt-total').textContent = formatMoney(subtotal - desc);
}
async function saveVenta() {
  const cliente_id = parseInt(document.getElementById('vf-cliente').value);
  if (!cliente_id) return toast('Selecciona un cliente', 'error');
  const forma_pago = document.getElementById('vf-forma').value;
  const fecha = document.getElementById('vf-fecha').value || null;
  const descuento = parseFloat(document.getElementById('vf-descuento').value) || 0;
  const notas = document.getElementById('vf-notas').value.trim();

  const items = [];
  let valid = true;
  document.querySelectorAll('.venta-item').forEach(row => {
    const producto_id = parseInt(row.querySelector('.vi-producto').value);
    const cantidad = parseFloat(row.querySelector('.vi-cantidad').value);
    const precio_unitario = parseFloat(row.querySelector('.vi-precio').value);
    if (!producto_id || !cantidad || cantidad <= 0 || isNaN(precio_unitario) || precio_unitario < 0) { valid = false; return; }
    items.push({ producto_id, cantidad, precio_unitario });
  });
  if (!valid || !items.length) return toast('Agrega al menos una línea válida (producto, cantidad y precio)', 'error');

  const body = { cliente_id, items, forma_pago, descuento, fecha, notas };
  if (forma_pago === 'credito') {
    const venc = document.getElementById('vf-vencimiento').value;
    if (!venc) return toast('Las ventas a crédito requieren fecha de vencimiento', 'error');
    body.fecha_vencimiento = venc;
    body.pagado_inicial = parseFloat(document.getElementById('vf-inicial').value) || 0;
  }

  try {
    showLoading();
    await api('/api/ventas', { method: 'POST', body });
    toast('Venta registrada', 'success');
    document.getElementById('venta-form-container').innerHTML = '';
    loadVentas();
  } catch (e) {} finally { hideLoading(); }
}

async function verVenta(id) {
  try {
    const v = await api('/api/ventas/' + id);
    document.getElementById('modal-content').innerHTML = `
      <h3>Venta ${esc(v.numero || '#' + v.id)} ${estadoBadge(v.estado)}</h3>
      <p style="color:var(--gray-500);margin-bottom:16px;font-size:14px">
        <strong>${esc(v.cliente_nombre)}</strong> &middot; ${formatDate(v.fecha)} &middot; ${FORMA_PAGO_LABEL[v.forma_pago] || v.forma_pago}
        ${v.fecha_vencimiento ? `<br>Vence: ${formatDate(v.fecha_vencimiento)}${v.dias_vencido > 0 ? ` · <span style="color:var(--danger)">${v.dias_vencido} días vencido</span>` : ''}` : ''}
        ${v.notas ? `<br><span style="font-style:italic">${esc(v.notas)}</span>` : ''}
      </p>
      <div class="table-container" style="margin-bottom:16px">
        <table><thead><tr><th>Descripción</th><th class="text-right">Cant.</th><th class="text-right">P. Unit.</th><th class="text-right">Subtotal</th></tr></thead>
        <tbody>${v.detalles.map(d => `<tr><td><strong>${esc(d.descripcion || d.producto_nombre || '-')}</strong></td><td class="text-right">${d.cantidad}</td><td class="text-right">${formatMoney(d.precio_unitario)}</td><td class="text-right"><strong>${formatMoney(d.subtotal)}</strong></td></tr>`).join('')}</tbody></table>
      </div>
      <div style="text-align:right;margin:16px 0;font-size:15px;line-height:1.9">
        <div><span style="color:var(--gray-500)">Subtotal:</span> ${formatMoney(v.subtotal)}</div>
        ${v.descuento > 0 ? `<div><span style="color:var(--gray-500)">Descuento:</span> -${formatMoney(v.descuento)}</div>` : ''}
        <div><span style="color:var(--gray-500)">Total:</span> <strong style="font-size:18px">${formatMoney(v.total)}</strong></div>
        <div><span style="color:var(--gray-500)">Pagado:</span> <span style="color:var(--success);font-weight:600">${formatMoney(v.pagado)}</span></div>
        ${v.saldo > 0.005 ? `<div><span style="color:var(--gray-500)">Saldo:</span> <span style="color:var(--danger);font-weight:700">${formatMoney(v.saldo)}</span></div>` : ''}
      </div>
      ${v.pagos.length ? `
        <h4 style="margin:16px 0 12px;font-size:14px;font-weight:700;color:var(--gray-700)">Historial de pagos</h4>
        <div class="table-container"><table><thead><tr><th>Fecha</th><th class="text-right">Monto</th><th>Método</th><th>Nota</th></tr></thead>
        <tbody>${v.pagos.map(p => `<tr><td>${formatDate(p.fecha)}</td><td class="text-right"><strong>${formatMoney(p.monto)}</strong></td><td style="text-transform:capitalize">${esc(p.metodo)}</td><td>${esc(p.notas || '-')}</td></tr>`).join('')}</tbody></table></div>` : ''}
      ${v.saldo > 0.005 ? `
        <h4 style="margin:20px 0 12px;font-size:14px;font-weight:700;color:var(--gray-700)">Registrar pago</h4>
        <div class="form-row">
          <div class="form-group"><label>Monto *</label><input id="pago-monto" type="number" step="0.01" min="0.01" max="${v.saldo.toFixed(2)}" value="${v.saldo.toFixed(2)}"></div>
          <div class="form-group"><label>Método</label><select id="pago-metodo"><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="tarjeta">Tarjeta</option><option value="otro">Otro</option></select></div>
        </div>
        <input id="pago-notas" placeholder="Observación (opcional)" style="margin-bottom:12px">
        <button class="btn btn-success" onclick="registrarPago(${v.id})"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> Registrar pago</button>` : ''}
      <div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Cerrar</button></div>`;
    document.getElementById('modal-overlay').style.display = 'flex';
  } catch (e) {}
}
async function registrarPago(ventaId) {
  const monto = parseFloat(document.getElementById('pago-monto').value);
  const metodo = document.getElementById('pago-metodo').value;
  const notas = document.getElementById('pago-notas') ? document.getElementById('pago-notas').value.trim() : '';
  if (!monto || monto <= 0) return toast('Ingresa un monto válido', 'error');
  try {
    showLoading();
    await api('/api/pagos', { method: 'POST', body: { venta_id: ventaId, monto, metodo, notas } });
    toast('Pago registrado', 'success');
    verVenta(ventaId);
  } catch (e) {} finally { hideLoading(); }
}
async function deleteVenta(id) {
  if (!await confirmAction('Eliminar venta', '¿Eliminar esta venta y todos sus pagos asociados? Esta acción no se puede deshacer.')) return;
  try { showLoading(); await api('/api/ventas/' + id, { method: 'DELETE' }); toast('Venta eliminada', 'success'); loadVentas(); }
  catch (e) {} finally { hideLoading(); }
}

// ============ COBROS (A QUIÉN COBRAR) ============
let cobrosFiltro = 'todos';
function setCobrosFiltro(f) {
  cobrosFiltro = f;
  document.querySelectorAll('#cobros-filtros .chip').forEach(c => c.classList.toggle('active', c.dataset.filtro === f));
  loadCobros();
}
async function loadCobros() {
  try {
    const d = await api('/api/cobranza/cobros?filtro=' + cobrosFiltro);
    const badge = document.getElementById('cobros-badge');
    if (d.cantidad) { badge.textContent = d.cantidad; badge.style.display = 'block'; } else { badge.style.display = 'none'; }
    const cont = document.getElementById('cobros-list');
    if (!d.lista.length) {
      cont.innerHTML = `<div class="empty-state"><div class="empty-state-icon" style="background:var(--success-light);color:var(--success)"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg></div><div class="empty-state-title">Nada por cobrar</div><div class="empty-state-desc">No hay cuentas en esta categoría</div></div>`;
      return;
    }
    const dot = { vencido: '🔴', hoy: '🟠', proximo: '🟡', pendiente: '🔵' };
    const sub = v => v.urgencia === 'vencido' ? `${v.dias_vencido} días vencido`
      : v.urgencia === 'hoy' ? 'Vence hoy'
      : v.urgencia === 'proximo' ? `Vence en ${v.dias_para_vencer} día(s)`
      : (v.fecha_vencimiento ? 'Vence ' + formatDate(v.fecha_vencimiento) : 'Sin vencimiento');
    cont.innerHTML = `<div class="cobros-total">Total mostrado: <strong>${formatMoney(d.total)}</strong> · ${d.cantidad} cuenta(s)</div>` +
      d.lista.map(v => `
      <div class="cobro-card cobro-${v.urgencia}">
        <div class="cobro-main" onclick="verVenta(${v.id})">
          <div class="cobro-dot">${dot[v.urgencia]}</div>
          <div class="cobro-info">
            <div class="cobro-name">${esc(v.cliente_nombre)}</div>
            <div class="cobro-sub">${esc(v.numero || '#' + v.id)} · ${sub(v)}</div>
          </div>
          <div class="cobro-amount">${formatMoney(v.saldo)}</div>
        </div>
        <div class="cobro-actions">
          ${btnWhatsapp(v.cliente_telefono, v.cliente_nombre, v.saldo)}
          <button class="btn btn-success btn-sm" onclick="verVenta(${v.id})">Registrar pago</button>
        </div>
      </div>`).join('');
  } catch (e) {}
}

// ============ CUENTAS POR COBRAR ============
async function loadCuentas() {
  try {
    const d = await api('/api/cobranza/cuentas-por-cobrar');
    document.getElementById('cuentas-stats').innerHTML = `
      <div class="stat-card card-primary"><div class="label">Cuentas pendientes</div><div class="value">${d.cantidad}</div></div>
      <div class="stat-card card-warning"><div class="label">Total por cobrar</div><div class="value warning">${formatMoney(d.total)}</div></div>
      <div class="stat-card card-danger"><div class="label">Total vencido</div><div class="value danger">${formatMoney(d.total_vencido)}</div></div>`;
    const tbody = document.getElementById('cuentas-table');
    tbody.innerHTML = d.lista.length ? d.lista.map(v => `
      <tr data-clickable onclick="verVenta(${v.id})">
        <td><strong>${esc(v.cliente_nombre)}</strong></td>
        <td>${esc(v.numero || '#' + v.id)}</td>
        <td>${formatDate(v.fecha)}</td>
        <td>${v.fecha_vencimiento ? formatDate(v.fecha_vencimiento) : '-'}</td>
        <td class="text-right">${formatMoney(v.total)}</td>
        <td class="text-right">${formatMoney(v.pagado)}</td>
        <td class="text-right"><strong style="color:var(--danger)">${formatMoney(v.saldo)}</strong></td>
        <td>${v.dias_vencido > 0 ? `<span style="color:var(--danger);font-weight:600">${v.dias_vencido}</span>` : '-'}</td>
        <td>${estadoBadge(v.estado)}</td>
        <td class="text-right"><button class="btn btn-success btn-sm" onclick="event.stopPropagation();verVenta(${v.id})">Cobrar</button></td>
      </tr>`).join('') : emptyRow(10, iconWallet(), 'Todo al día', 'No hay cuentas por cobrar');
  } catch (e) {}
}

// ============ CARTERA VENCIDA ============
async function loadCartera() {
  try {
    const d = await api('/api/cobranza/cartera-vencida');
    document.getElementById('cartera-stats').innerHTML = `
      <div class="stat-card card-danger"><div class="label">Total cartera vencida</div><div class="value danger">${formatMoney(d.total)}</div></div>
      <div class="stat-card card-warning"><div class="label">Cuentas vencidas</div><div class="value warning">${d.cantidad}</div></div>
      <div class="stat-card card-primary"><div class="label">Promedio por cuenta</div><div class="value">${d.cantidad ? formatMoney(d.total / d.cantidad) : '$0.00'}</div></div>`;
    const badge = document.getElementById('cartera-badge');
    if (d.cantidad) { badge.textContent = d.cantidad; badge.style.display = 'block'; } else { badge.style.display = 'none'; }
    const tbody = document.getElementById('cartera-table');
    tbody.innerHTML = d.lista.length ? d.lista.map(v => `
      <tr data-clickable onclick="verVenta(${v.id})">
        <td><strong>${esc(v.cliente_nombre)}</strong></td>
        <td>${esc(v.cliente_telefono || '-')}</td>
        <td>${formatDate(v.fecha)}</td>
        <td>${formatDate(v.fecha_vencimiento)}</td>
        <td class="text-right">${formatMoney(v.total)}</td>
        <td class="text-right">${formatMoney(v.pagado)}</td>
        <td class="text-right"><strong style="color:var(--danger)">${formatMoney(v.saldo)}</strong></td>
        <td><span class="badge badge-overdue"><span class="badge-dot"></span>${v.dias_vencido} días</span></td>
        <td class="text-right"><div class="td-actions" style="gap:6px">${btnWhatsapp(v.cliente_telefono, v.cliente_nombre, v.saldo)}<button class="btn btn-success btn-sm" onclick="event.stopPropagation();verVenta(${v.id})">Cobrar</button></div></td>
      </tr>`).join('') : emptyRowSuccess(9, 'Todo al día', 'No hay cartera vencida');
  } catch (e) {}
}

// ============ REPORTES ============
let repVentasData = [];
let repCarteraData = [];
async function loadReportes() {
  try {
    const clientes = await api('/api/clientes');
    const sel = document.getElementById('rv-cliente');
    sel.innerHTML = '<option value="">Todos</option>' + clientes.map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('');
  } catch (e) {}
  runReporteVentas();
}
function setReporte(r) {
  document.querySelectorAll('.report-tab').forEach(t => t.classList.toggle('active', t.dataset.rep === r));
  document.getElementById('rep-ventas').style.display = r === 'ventas' ? '' : 'none';
  document.getElementById('rep-cartera').style.display = r === 'cartera' ? '' : 'none';
  if (r === 'cartera') runReporteCartera();
}
async function runReporteVentas() {
  const p = new URLSearchParams();
  const desde = document.getElementById('rv-desde').value;
  const hasta = document.getElementById('rv-hasta').value;
  const cliente = document.getElementById('rv-cliente').value;
  const estado = document.getElementById('rv-estado').value;
  if (desde) p.set('desde', desde);
  if (hasta) p.set('hasta', hasta);
  if (cliente) p.set('cliente_id', cliente);
  if (estado) p.set('estado', estado);
  try {
    const d = await api('/api/reportes/ventas?' + p.toString());
    repVentasData = d.ventas;
    document.getElementById('rv-resumen').innerHTML = `
      <div class="stat-card card-primary"><div class="label">Ventas</div><div class="value">${d.resumen.cantidad}</div></div>
      <div class="stat-card card-primary"><div class="label">Total</div><div class="value">${formatMoney(d.resumen.total)}</div></div>
      <div class="stat-card card-success"><div class="label">Cobrado</div><div class="value success">${formatMoney(d.resumen.pagado)}</div></div>
      <div class="stat-card card-danger"><div class="label">Saldo</div><div class="value danger">${formatMoney(d.resumen.saldo)}</div></div>`;
    document.getElementById('rv-table').innerHTML = d.ventas.length ? d.ventas.map(v => `
      <tr><td>${esc(v.numero || '#' + v.id)}</td><td>${formatDate(v.fecha)}</td><td>${esc(v.cliente_nombre)}</td><td class="text-right">${formatMoney(v.total)}</td><td class="text-right">${formatMoney(v.pagado)}</td><td class="text-right">${formatMoney(v.saldo)}</td><td>${estadoBadge(v.estado)}</td></tr>`).join('')
      : '<tr><td colspan="7" style="text-align:center;color:var(--gray-400);padding:32px">Sin resultados</td></tr>';
  } catch (e) {}
}
async function runReporteCartera() {
  try {
    const d = await api('/api/reportes/cartera');
    repCarteraData = d.lista;
    document.getElementById('rc-resumen').innerHTML = `
      <div class="stat-card card-primary"><div class="label">Clientes</div><div class="value">${d.resumen.clientes}</div></div>
      <div class="stat-card card-warning"><div class="label">Total adeudado</div><div class="value warning">${formatMoney(d.resumen.total_adeudado)}</div></div>
      <div class="stat-card card-danger"><div class="label">Total vencido</div><div class="value danger">${formatMoney(d.resumen.total_vencido)}</div></div>`;
    document.getElementById('rc-table').innerHTML = d.lista.length ? d.lista.map(g => `
      <tr><td><strong>${esc(g.cliente_nombre)}</strong></td><td>${esc(g.cliente_telefono || '-')}</td><td class="text-right">${g.cuentas}</td><td class="text-right">${formatMoney(g.total_adeudado)}</td><td class="text-right"><strong style="color:var(--danger)">${formatMoney(g.total_vencido)}</strong></td><td>${g.dias_max > 0 ? g.dias_max : '-'}</td></tr>`).join('')
      : '<tr><td colspan="6" style="text-align:center;color:var(--gray-400);padding:32px">Sin cartera pendiente</td></tr>';
  } catch (e) {}
}
function downloadCSV(filename, rows) {
  const csv = rows.map(r => r.map(cell => {
    const s = String(cell == null ? '' : cell).replace(/"/g, '""');
    return /[",\n;]/.test(s) ? `"${s}"` : s;
  }).join(';')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
function exportReporteVentasCSV() {
  if (!repVentasData.length) return toast('No hay datos para exportar', 'error');
  const rows = [['# Venta', 'Fecha', 'Cliente', 'Total', 'Pagado', 'Saldo', 'Estado']];
  repVentasData.forEach(v => rows.push([v.numero || '#' + v.id, (v.fecha || '').slice(0,10), v.cliente_nombre, v.total.toFixed(2), v.pagado.toFixed(2), v.saldo.toFixed(2), (ESTADO_INFO[v.estado] || {}).label || v.estado]));
  downloadCSV('reporte-ventas.csv', rows);
  toast('Reporte exportado', 'success');
}
function exportReporteCarteraCSV() {
  if (!repCarteraData.length) return toast('No hay datos para exportar', 'error');
  const rows = [['Cliente', 'Telefono', 'Cuentas', 'Total adeudado', 'Total vencido', 'Dias max']];
  repCarteraData.forEach(g => rows.push([g.cliente_nombre, g.cliente_telefono || '', g.cuentas, g.total_adeudado.toFixed(2), g.total_vencido.toFixed(2), g.dias_max]));
  downloadCSV('reporte-cartera.csv', rows);
  toast('Reporte exportado', 'success');
}
function imprimirReporte(elId, titulo) {
  const el = document.getElementById(elId);
  if (!el) return;
  const w = window.open('', '_blank');
  w.document.write(`<html><head><title>${titulo}</title>
    <style>body{font-family:Arial,sans-serif;padding:24px;color:#111}h1{font-size:20px;margin-bottom:4px}p{color:#666;font-size:13px;margin-bottom:16px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f3f4f6}.text-right{text-align:right}.badge{display:none}</style>
    </head><body><h1>${titulo}</h1><p>Generado el ${new Date().toLocaleString('es-MX')}</p>${el.innerHTML}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 300);
}

// ============ HELPERS ============
function emptyRow(cols, icon, title, desc) {
  return `<tr><td colspan="${cols}"><div class="empty-state"><div class="empty-state-icon">${icon}</div><div class="empty-state-title">${title}</div><div class="empty-state-desc">${desc}</div></div></td></tr>`;
}
function emptyRowSuccess(cols, title, desc) {
  return `<tr><td colspan="${cols}"><div class="empty-state"><div class="empty-state-icon" style="background:var(--success-light);color:var(--success)"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg></div><div class="empty-state-title">${title}</div><div class="empty-state-desc">${desc}</div></div></td></tr>`;
}
function updateTopbarDate() {
  const now = new Date();
  const s = now.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  document.getElementById('topbar-date').textContent = s.charAt(0).toUpperCase() + s.slice(1);
}

// ============ INIT ============
checkAuth();
