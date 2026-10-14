const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
import { isConfigured, auth, db, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, signOut, onAuthStateChanged, collection, doc, setDoc, addDoc, updateDoc, deleteDoc, getDoc, getDocs, onSnapshot, serverTimestamp } from './firebase.js';
const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' });
const fullDateFormatter = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
const today = new Date();
const dayOffset = (days) => { const value = new Date(); value.setDate(value.getDate() + days); return value.toISOString().slice(0, 10); };
const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase();
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const icon = (name, cls = '') => `<i data-lucide="${name}"${cls ? ` class="${cls}"` : ''}></i>`;
const logo = () => '<img class="brand-logo" src="assets/gymtool-logo.png" alt="">';
let state = { members: [], plans: [], classes: [], payments: [], visits: [], gym: {}, workspaces: [], profile: null, gymId: null };
let currentUser = null;
let currentPage = 'inicio';
let memberQuery = '';
let memberStatusFilter = 'Todos los estados';
let paymentFilter = 'Todos los pagos';
let sortMembers = 'name';
let agendaSelectedDate = dayOffset(0);
let stopListeners = [];
let registrationInProgress = false;
const savedTheme = localStorage.getItem('gymtool-theme') || 'light';
document.documentElement.dataset.theme = savedTheme;
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('gymtool-theme', theme);
  const dark = theme === 'dark';
  for (const button of [$('#themeToggle'), $('#authThemeToggle')].filter(Boolean)) {
    button.setAttribute('aria-label', dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro');
    button.title = dark ? 'Usar tema claro' : 'Usar tema oscuro';
    button.innerHTML = icon(dark ? 'sun' : 'moon');
  }
  refreshIcons();
}
function mountAuthThemeToggle() {
  const screen = $('#authScreen');
  screen.querySelector('#authThemeToggle')?.remove();
  const button = document.createElement('button');
  button.id = 'authThemeToggle'; button.type = 'button'; button.className = 'icon-button auth-theme-toggle';
  button.innerHTML = icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon');
  button.setAttribute('aria-label', document.documentElement.dataset.theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro');
  button.title = document.documentElement.dataset.theme === 'dark' ? 'Usar tema claro' : 'Usar tema oscuro';
  screen.append(button);
}
function updateMemberCount() { $('#memberNavCount').textContent = state.members.length; }
const workspaceCollection = (name) => collection(db, 'gyms', state.gymId, name);
const workspaceDocument = (name, id) => doc(db, 'gyms', state.gymId, name, id);
const cloudErrorMessage = (error) => ({ 'auth/email-already-in-use': 'Ya existe una cuenta con ese email.', 'auth/invalid-email': 'Revisá el formato del email.', 'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.', 'auth/invalid-credential': 'El email o la contraseña no son correctos.', 'auth/user-not-found': 'No encontramos una cuenta con ese email.', 'auth/too-many-requests': 'Hubo varios intentos seguidos. Esperá unos minutos y probá de nuevo.', 'permission-denied': 'Tu usuario no tiene permiso para esta acción. Verificá el rol del gimnasio.', 'unavailable': 'No hay conexión con Firebase. Revisá tu internet e intentá de nuevo.' })[error?.code] || error?.message || 'Ocurrió un error. Intentá de nuevo.';
function showAuth(mode = 'login', message = '') {
  $('#appShell').hidden = true; const screen = $('#authScreen'); screen.hidden = false; screen.className = 'auth-screen';
  if (mode === 'setup') {
    screen.innerHTML = `<div class="auth-card config-card"><a class="brand auth-brand" href="#"><span class="brand-mark">${logo()}</span><span>gymtool<span class="brand-dot">.</span><small>GESTIÓN SIMPLE</small></span></a><span class="eyebrow">CONFIGURACIÓN INICIAL</span><h1>Conectá tu proyecto Firebase</h1><p>GymTool ya está listo para consultar datos reales, pero primero necesita la configuración web de un proyecto Firebase nuevo.</p><ol><li>Creá un proyecto nuevo en Firebase Console.</li><li>Activá Authentication con email y contraseña y creá Firestore.</li><li>Copiá la configuración de la aplicación web en <code>firebase-config.js</code>.</li><li>Publicá las reglas de <code>firestore.rules</code>.</li></ol><p class="auth-note">Este prototipo no usa las credenciales del ZIP original ni guarda datos en localStorage.</p></div>`; mountAuthThemeToggle(); refreshIcons(); return;
  }
  const signup = mode === 'signup';
  screen.innerHTML = `<div class="auth-side"><a class="brand auth-brand" href="#"><span class="brand-mark">${logo()}</span><span>gymtool<span class="brand-dot">.</span><small>GESTIÓN SIMPLE</small></span></a><div><span class="auth-kicker">MENOS TAREAS. MÁS ENTRENAMIENTO.</span><h2>Tu gimnasio,<br>en orden.</h2><p>Socios, clases, asistencias y pagos en un solo lugar.</p></div><span class="auth-side-foot">Una herramienta simple para equipos que hacen mucho.</span></div><div class="auth-main"><div class="auth-card"><a class="brand auth-mobile-brand" href="#"><span class="brand-mark">${logo()}</span><span>gymtool<span class="brand-dot">.</span><small>GESTIÓN SIMPLE</small></span></a><span class="eyebrow">${signup ? 'EMPEZÁ EN UNOS PASOS' : 'QUÉ BUENO VERTE'}</span><h1>${signup ? 'Crear tu cuenta' : 'Iniciar sesión'}</h1><p class="auth-lede">${signup ? 'Registrá a la persona administradora. Después vas a crear el espacio de tu gimnasio.' : 'Ingresá para consultar los datos en tiempo real de tu gimnasio.'}</p>${message ? `<div class="auth-error" role="alert">${escapeHtml(message)}</div>` : ''}<form id="authForm" data-mode="${signup ? 'signup' : 'login'}">${signup ? `<div class="field"><label for="authName">Nombre y apellido</label><input id="authName" name="name" autocomplete="name" required maxlength="80" placeholder="Ej. María González"></div>` : ''}<div class="field"><label for="authEmail">Email</label><input id="authEmail" name="email" type="email" autocomplete="email" required placeholder="tu@email.com"></div><div class="field"><label for="authPassword">Contraseña</label><input id="authPassword" name="password" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" minlength="6" required placeholder="Al menos 6 caracteres"></div><button class="button button-primary auth-submit">${signup ? 'Crear cuenta' : 'Entrar a GymTool'}${icon('arrow-right')}</button></form>${!signup ? `<button class="auth-text-button" id="resetPassword">¿Olvidaste tu contraseña?</button>` : ''}<div class="auth-switch">${signup ? '¿Ya tenés una cuenta?' : '¿Primera vez en GymTool?'} <button class="auth-text-button" data-auth-mode="${signup ? 'login' : 'signup'}">${signup ? 'Iniciá sesión' : 'Crear cuenta'}</button></div><p class="auth-privacy">Al continuar, tus datos se guardan en el proyecto Firebase que configures.</p></div></div>`;
  mountAuthThemeToggle(); refreshIcons();
}
function showOnboarding(message = '') {
  $('#appShell').hidden = true; const screen = $('#authScreen'); screen.hidden = false; screen.className = 'auth-screen';
  screen.innerHTML = `<div class="auth-side"><a class="brand auth-brand" href="#"><span class="brand-mark">${logo()}</span><span>gymtool<span class="brand-dot">.</span><small>GESTIÓN SIMPLE</small></span></a><div><span class="auth-kicker">PRIMEROS PASOS</span><h2>Armemos tu<br>espacio de trabajo.</h2><p>Tu gimnasio tendrá sus propios datos y solo su equipo podrá consultarlos.</p></div><span class="auth-side-foot">El espacio se crea bajo tu cuenta como titular.</span></div><div class="auth-main"><form class="auth-card" id="workspaceForm"><a class="brand auth-mobile-brand" href="#"><span class="brand-mark">${logo()}</span><span>gymtool<span class="brand-dot">.</span><small>GESTIÓN SIMPLE</small></span></a><span class="eyebrow">NUEVO ESPACIO</span><h1>Registrá tu gimnasio</h1><p class="auth-lede">Completá los datos básicos. Después podés editar la información general.</p>${message ? `<div class="auth-error" role="alert">${escapeHtml(message)}</div>` : ''}<div class="field"><label for="workspaceInput">Nombre del gimnasio</label><input id="workspaceInput" name="name" required maxlength="80" placeholder="Ej. Power Club"></div><div class="field"><label for="workspaceCity">Ciudad</label><input id="workspaceCity" name="city" required maxlength="80" placeholder="Ej. Buenos Aires"></div><button class="button button-primary auth-submit">Crear gimnasio ${icon('arrow-right')}</button><button type="button" class="auth-text-button" id="workspaceSignout">Cerrar sesión</button></form></div>`; mountAuthThemeToggle(); refreshIcons();
}
async function createWorkspace(user, name, city) {
  const gymRef = doc(collection(db, 'gyms'));
  const gym = { name: name.trim(), city: city.trim(), address: '', email: user.email || '', phone: '', hours: '', ownerId: user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  await setDoc(gymRef, gym);
  await setDoc(doc(db, 'gyms', gymRef.id, 'staff', user.uid), { uid: user.uid, name: state.profile?.name || user.displayName || '', email: user.email || '', role: 'owner', active: true, createdAt: serverTimestamp() });
  await setDoc(doc(db, 'users', user.uid, 'gymAccess', gymRef.id), { gymId: gymRef.id, name: name.trim(), city: city.trim(), role: 'owner', createdAt: serverTimestamp() });
  await loadWorkspaces(user);
}
async function loadWorkspaces(user) {
  stopListeners.forEach(stop => stop()); stopListeners = [];
  const profileSnapshot = await getDocs(collection(db, 'users', user.uid, 'gymAccess'));
  state.workspaces = profileSnapshot.docs.map(item => ({ id: item.id, ...item.data() }));
  if (!state.workspaces.length) { showOnboarding(); return; }
  await selectWorkspace(state.workspaces[0].id, user);
}
async function selectWorkspace(gymId, user = currentUser) {
  stopListeners.forEach(stop => stop()); stopListeners = [];
  currentUser = user; state.gymId = gymId; state.members = []; state.plans = []; state.classes = []; state.payments = []; state.visits = []; state.gym = {};
  const workspace = state.workspaces.find(item => item.id === gymId) || {};
  $('#workspaceName').textContent = workspace.name || 'Mi gimnasio'; $('#workspaceLocation').textContent = workspace.city || 'Espacio de trabajo'; $('#crumbWorkspace').textContent = workspace.name || 'Mi gimnasio'; $('.location-avatar').textContent = initials(workspace.name || 'G');
  const accountName = state.profile?.name || user.displayName || user.email || 'Usuario'; $('#accountButton span:nth-child(2) b').textContent = accountName; $('#accountButton span:nth-child(2) small').textContent = workspace.role === 'owner' ? 'Titular' : workspace.role || 'Equipo'; $$('.avatar-user').forEach(avatar => avatar.textContent = initials(accountName));
  $('#authScreen').hidden = true; $('#appShell').hidden = false;
  const mappings = { members: 'members', plans: 'plans', classes: 'classes', payments: 'payments', visits: 'attendance' };
  for (const [key, path] of Object.entries(mappings)) {
    stopListeners.push(onSnapshot(collection(db, 'gyms', gymId, path), snapshot => {
      state[key] = snapshot.docs.map(item => {
        const data = item.data();
        if (key === 'members') return { ...data, id: item.id, since: data.since || data.joinedAt?.toDate?.().toISOString().slice(0, 10) || '', expires: data.expires || '', status: membershipStatus(data.expires || '') };
        if (key === 'visits') return { ...data, id: item.id, time: data.time || data.createdAt?.toDate?.().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) || '—' };
        return { ...data, id: item.id };
      });
      renderPage(currentPage);
    }, error => toast(cloudErrorMessage(error), 'error')));
  }
  stopListeners.push(onSnapshot(doc(db, 'gyms', gymId), snapshot => {
    if (!snapshot.exists()) { toast('El gimnasio seleccionado no existe o ya no está disponible.', 'error'); return; }
    state.gym = snapshot.data(); $('#workspaceName').textContent = state.gym.name || 'Mi gimnasio'; $('#workspaceLocation').textContent = state.gym.city || 'Espacio de trabajo'; $('.location-avatar').textContent = initials(state.gym.name || 'G');
    renderPage(currentPage);
  }, error => toast(cloudErrorMessage(error), 'error')));
  renderPage('inicio');
}
function membershipStatus(expires) { if (!expires) return 'Activa'; const remaining = Math.ceil((new Date(`${expires}T23:59:59`).getTime() - Date.now()) / 86400000); return remaining < 0 ? 'Vencida' : remaining <= 5 ? 'Por vencer' : 'Activa'; }
async function persistNew(path, data) { return addDoc(workspaceCollection(path), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), createdBy: currentUser.uid }); }
async function persistUpdate(path, id, data) { return updateDoc(workspaceDocument(path, id), { ...data, updatedAt: serverTimestamp() }); }
function startApplication() {
  if (!isConfigured) { showAuth('setup'); return; }
  onAuthStateChanged(auth, async user => {
    currentUser = user;
    if (!user) { stopListeners.forEach(stop => stop()); stopListeners = []; showAuth('login'); return; }
    if (registrationInProgress) return;
    try {
      const profileSnapshot = await getDocs(collection(db, 'users', user.uid, 'gymAccess'));
      const accountSnapshot = await getDoc(doc(db, 'users', user.uid));
      state.profile = accountSnapshot.exists() ? accountSnapshot.data() : { name: user.displayName || '', email: user.email || '' };
      state.workspaces = profileSnapshot.docs.map(item => ({ id: item.id, ...item.data() }));
      if (!state.workspaces.length) showOnboarding(); else await selectWorkspace(state.workspaces[0].id, user);
    } catch (error) { console.error(error); showAuth('login', cloudErrorMessage(error)); }
  }, error => showAuth('login', cloudErrorMessage(error)));
}
function refreshIcons() { if (window.lucide) window.lucide.createIcons(); }
function dateLabel(date, options = {}) {
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? '—' : (options.full ? fullDateFormatter : dateFormatter).format(parsed);
}
function statusPill(status) {
  const cls = status === 'Activa' || status === 'Acreditado' ? 'pill-success' : status === 'Por vencer' || status === 'Pendiente' ? 'pill-warning' : status === 'Vencida' ? 'pill-danger' : 'pill-neutral';
  return `<span class="pill ${cls}">${escapeHtml(status)}</span>`;
}
function avatarClass(index) { return ['', 'pink', 'yellow', 'blue', 'violet'][index % 5]; }
function pageHeading(eyebrow, title, description, action = '') {
  return `<div class="page-heading"><div><span class="eyebrow">${eyebrow}</span><h1>${title}</h1><p>${description}</p></div><div class="heading-actions">${action}</div></div>`;
}
function button(label, action, iconName, cls = 'button-primary') { return `<button class="button ${cls}" data-action="${action}">${icon(iconName)}${label}</button>`; }
function memberRow(member, index, extra = '') {
  return `<tr><td><div class="member-cell"><span class="member-mini ${avatarClass(index)}">${escapeHtml(initials(member.name))}</span><span><span class="member-name">${escapeHtml(member.name)}</span><span class="member-meta">${escapeHtml(member.email)}</span></span></div></td><td>${escapeHtml(member.plan || 'Sin plan')}</td><td>${statusPill(member.status)}</td><td>${dateLabel(member.expires)}</td>${extra}<td><button class="table-action" data-action="edit-member" data-id="${escapeHtml(member.id)}" aria-label="Editar ${escapeHtml(member.name)}">${icon('ellipsis')}</button></td></tr>`;
}
function recentMembersTable() {
  const list = [...state.members].sort((a, b) => b.since.localeCompare(a.since)).slice(0, 5);
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>SOCIO</th><th>MEMBRESÍA</th><th>ESTADO</th><th>VENCE</th><th></th></tr></thead><tbody>${list.map((member, index) => memberRow(member, index)).join('') || `<tr><td colspan="5"><div class="empty-state"><p>Todavía no hay socios registrados.</p></div></td></tr>`}</tbody></table></div>`;
}
function revenueChart() {
  const dates = Array.from({ length: 28 }, (_, index) => dayOffset(index - 27));
  const totals = dates.map(date => state.payments.filter(payment => payment.date === date && payment.status === 'Acreditado').reduce((sum, payment) => sum + Number(payment.amount || 0), 0));
  const max = Math.max(...totals, 1);
  const values = totals.map(value => 8 + value / max * 118);
  const points = values.map((v, i) => `${42 + i * 18},${148 - v}`).join(' ');
  const coords = points.split(' ').map(point => point.split(',').map(Number));
  const area = `M ${coords[0][0]} 150 L ${coords.map(point => point.join(' ')).join(' L ')} L ${coords.at(-1)[0]} 150 Z`;
  const total = totals.reduce((sum, value) => sum + value, 0);
  const maxValue = max;
  return `<div class="chart-wrap"><div style="display:flex;justify-content:space-between;align-items:center;padding:4px 6px 0"><span class="legend"><span class="legend-dot"></span>Ingresos acreditados</span><span style="font-size:9px;color:#8b9691">${money.format(total)} en 28 días</span></div><svg class="chart-svg" viewBox="0 0 560 170" role="img" aria-label="Ingresos acreditados por día durante los últimos 28 días" preserveAspectRatio="none"><defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#83c19e" stop-opacity=".3"/><stop offset="100%" stop-color="#83c19e" stop-opacity="0"/></linearGradient></defs><line class="chart-gridline" x1="35" y1="35" x2="550" y2="35"/><line class="chart-gridline" x1="35" y1="75" x2="550" y2="75"/><line class="chart-gridline" x1="35" y1="115" x2="550" y2="115"/><text x="0" y="38">${money.format(maxValue)}</text><text x="0" y="78">${money.format(maxValue * .66)}</text><text x="8" y="118">${money.format(maxValue * .33)}</text><path class="chart-area" d="${area}"/><polyline class="chart-line" points="${points}"/><circle class="chart-point" cx="${coords.at(-1)[0]}" cy="${coords.at(-1)[1]}" r="4"/><text class="chart-tooltip" x="${coords.at(-1)[0] - 39}" y="${coords.at(-1)[1] - 10}">${money.format(totals.at(-1))}</text></svg><div class="chart-months">${[0, 4, 8, 12, 16, 20, 27].map(index => `<span>${dateLabel(dates[index])}</span>`).join('')}</div></div>`;
}
function activityList() {
  const timestamp = item => item.createdAt?.toDate?.().getTime?.() || new Date(`${item.date || item.since || '1970-01-01'}T12:00:00`).getTime();
  const items = [
    ...state.members.map(item => ({ kind: 'member', label: 'Nuevo socio', text: item.name, date: item.since, createdAt: item.createdAt })),
    ...state.payments.map(item => ({ kind: 'payment', label: item.status === 'Acreditado' ? 'Pago acreditado' : 'Pago pendiente', text: `${item.member} · ${money.format(item.amount)}`, date: item.date, createdAt: item.createdAt })),
    ...state.visits.map(item => ({ kind: 'visit', label: 'Ingreso registrado', text: `${item.member} · ${item.kind || 'Acceso general'}`, date: item.date, createdAt: item.createdAt }))
  ].sort((a, b) => timestamp(b) - timestamp(a)).slice(0, 4);
  return items.length ? `<div class="activity-list">${items.map(item => `<div class="activity-item"><span class="activity-icon ${item.kind === 'payment' ? 'orange' : item.kind === 'visit' ? 'blue' : ''}">${icon(item.kind === 'payment' ? 'wallet' : item.kind === 'visit' ? 'scan-line' : 'user-round-plus')}</span><span class="activity-copy"><b>${escapeHtml(item.label)}</b><p>${escapeHtml(item.text)}</p></span><span class="activity-time">${item.date ? dateLabel(item.date) : 'reciente'}</span></div>`).join('')}</div>` : `<div class="empty-state">${icon('activity')}<h3>Tu actividad aparecerá acá</h3><p>Cuando agregues socios, pagos o ingresos, vas a verlos en este resumen.</p></div>`;
}
function dueList() {
  const expiring = state.members.filter(m => m.status === 'Por vencer' || m.status === 'Vencida').slice(0, 4);
  if (!expiring.length) return `<div class="empty-state"><p>No hay membresías próximas a vencer.</p></div>`;
  return `<div class="due-list">${expiring.map(member => `<div class="due-item"><span class="due-avatar">${escapeHtml(initials(member.name))}</span><span class="due-copy"><b>${escapeHtml(member.name)}</b><small>${member.status === 'Vencida' ? 'Venció' : 'Vence'} ${dateLabel(member.expires)}</small></span><span class="due-amount">${money.format(state.plans.find(plan => plan.name === member.plan)?.price || 0)}</span></div>`).join('')}</div>`;
}
function renderDashboard() {
  const active = state.members.filter(member => member.status === 'Activa').length;
  const due = state.members.filter(member => member.status === 'Por vencer' || member.status === 'Vencida').length;
  const monthKey = dayOffset(0).slice(0, 7);
  const income = state.payments.filter(payment => payment.status === 'Acreditado' && payment.date?.startsWith(monthKey)).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buen día' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  const accountName = (state.profile?.name || currentUser?.displayName || currentUser?.email?.split('@')[0] || '').trim() || 'ahí';
  const firstName = accountName.trim().split(/\s+/)[0];
  return `${pageHeading(new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).format(today).toLocaleUpperCase('es-AR'), `${greeting}, ${escapeHtml(firstName)}`, 'Acá tenés el resumen de lo que pasa hoy en tu gimnasio.', button('Registrar socio', 'add-member', 'user-round-plus'))}
    <section class="stats-grid" aria-label="Indicadores del gimnasio"><article class="stat-card"><div class="stat-top"><span>Socios activos</span><span class="stat-icon">${icon('users-round')}</span></div><div class="stat-value">${active.toLocaleString('es-AR')}</div><div class="stat-foot"><span>Según fecha de vencimiento</span></div></article><article class="stat-card"><div class="stat-top"><span>Ingresos del mes</span><span class="stat-icon amber">${icon('wallet')}</span></div><div class="stat-value">${money.format(income)}</div><div class="stat-foot"><span>Cobros acreditados este mes</span></div></article><article class="stat-card"><div class="stat-top"><span>Asistencias hoy</span><span class="stat-icon blue">${icon('scan-line')}</span></div><div class="stat-value">${state.visits.filter(visit => visit.date === dayOffset(0)).length}</div><div class="stat-foot"><span>Visitas registradas hoy</span></div></article><article class="stat-card"><div class="stat-top"><span>Cuotas por revisar</span><span class="stat-icon red">${icon('calendar-clock')}</span></div><div class="stat-value">${due}</div><div class="stat-foot"><span>Requieren seguimiento</span></div></article></section>
    <section class="dashboard-grid"><article class="panel chart-panel"><div class="panel-header"><div><h2 class="panel-title">Ingresos</h2><p class="panel-subtitle">Un vistazo a la evolución de tu gimnasio</p></div><button class="select-control" data-action="chart-period">Últimos 28 días⌄</button></div>${revenueChart()}</article><article class="panel activity-panel"><div class="panel-header"><div><h2 class="panel-title">Actividad reciente</h2><p class="panel-subtitle">Lo último que pasó en tu gimnasio</p></div><button class="text-link" data-page="asistencia">Ver actividad ${icon('arrow-right')}</button></div>${activityList()}</article></section>
    <section class="bottom-grid"><article class="panel"><div class="panel-header"><div><h2 class="panel-title">Socios recientes</h2><p class="panel-subtitle">Tus últimas incorporaciones</p></div><button class="text-link" data-page="socios">Ver todos ${icon('arrow-right')}</button></div>${recentMembersTable()}</article><article class="panel"><div class="panel-header"><div><h2 class="panel-title">Membresías por vencer</h2><p class="panel-subtitle">No pierdas de vista estas renovaciones</p></div>${icon('calendar-days')}</div>${dueList()}</article></section>`;
}
function renderMembers() {
  const filtered = state.members.filter(member => `${member.name} ${member.email} ${member.plan}`.toLowerCase().includes(memberQuery.toLowerCase()) && (memberStatusFilter === 'Todos los estados' || member.status === memberStatusFilter)).sort((a, b) => sortMembers === 'name' ? a.name.localeCompare(b.name, 'es') : a.expires.localeCompare(b.expires));
  return `${pageHeading('TU COMUNIDAD', 'Socios', `Administrá la información y las membresías de ${state.members.length} socios.`, button('Agregar socio', 'add-member', 'user-round-plus'))}<section class="page-panel"><div class="toolbar"><div class="toolbar-left"><label class="search-box">${icon('search')}<input id="memberSearch" type="search" placeholder="Buscar por nombre, email o plan" value="${escapeHtml(memberQuery)}" aria-label="Buscar socios"></label></div><div class="toolbar-right"><select class="select-control" id="memberStatusFilter" aria-label="Filtrar por estado">${['Todos los estados', 'Activa', 'Por vencer', 'Vencida'].map(item => `<option${memberStatusFilter === item ? ' selected' : ''}>${item}</option>`).join('')}</select><select class="select-control" id="memberSort" aria-label="Ordenar socios"><option value="name"${sortMembers === 'name' ? ' selected' : ''}>Orden: nombre</option><option value="expires"${sortMembers === 'expires' ? ' selected' : ''}>Orden: vencimiento</option></select></div></div>${filtered.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>SOCIO</th><th>MEMBRESÍA</th><th>ESTADO</th><th>VENCIMIENTO</th><th>ALTA</th><th></th></tr></thead><tbody>${filtered.map((m, i) => memberRow(m, i, `<td>${dateLabel(m.since)}</td>`)).join('')}</tbody></table></div><div class="table-footer"><span>Mostrando ${filtered.length} de ${state.members.length} socios</span><span>Los datos se guardan en este navegador</span></div>` : `<div class="empty-state">${icon('search')}<h3>No encontramos socios</h3><p>Probá con otro nombre o cambiá el filtro seleccionado.</p><button class="button button-quiet" data-action="clear-member-filters">Limpiar filtros</button></div>`}</section>`;
}
function renderPlans() {
  return `${pageHeading('SERVICIOS DEL GIMNASIO', 'Membresías', 'Organizá tus planes y consultá cuántos socios tiene cada uno.', button('Crear plan', 'add-plan', 'plus'))}<div class="membership-grid">${state.plans.map((plan, i) => { const count = state.members.filter(member => member.plan === plan.name).length; return `<article class="plan-card ${escapeHtml(plan.color || '')}"><div class="plan-top"><span class="plan-symbol">${icon(['zap', 'dumbbell', 'sun'][i % 3])}</span><span class="pill ${plan.active ? 'pill-success' : 'pill-neutral'}">${plan.active ? 'Activo' : 'Pausado'}</span></div><h2 class="plan-name">${escapeHtml(plan.name)}</h2><p class="plan-description">${escapeHtml(plan.access)}</p><div class="plan-price">${money.format(plan.price)}<small> / ${escapeHtml(plan.period)}</small></div><div class="plan-meta">${icon('users-round')}<span>${count} ${count === 1 ? 'socio adherido' : 'socios adheridos'}</span></div><div class="plan-footer"><span class="field-hint">${plan.active ? 'Disponible para nuevos socios' : 'No disponible para altas'}</span><button class="small-link" data-action="edit-plan" data-id="${escapeHtml(plan.id)}">Editar</button></div></article>`; }).join('')}${button('Nuevo plan', 'add-plan', 'plus', 'button button-quiet')}</div><section class="panel section-gap"><div class="panel-header"><div><h2 class="panel-title">Consejo para tus planes</h2><p class="panel-subtitle">Un buen nombre y condiciones claras ayudan a que cada socio encuentre su opción.</p></div>${icon('lightbulb')}</div><div style="padding:15px 17px;color:#75827c;font-size:11px;line-height:1.7">Revisá periódicamente tus precios y dejá siempre visible qué incluye cada membresía. Los cambios se sincronizan con las cuentas autorizadas de este gimnasio.</div></section>`;
}
function renderAgenda() {
  agendaSelectedDate = dayOffset(0);
  const days = Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() + index); const key = date.toISOString().slice(0, 10); return { key, day: new Intl.DateTimeFormat('es-AR', { weekday: 'short' }).format(date).replace('.', ''), number: date.getDate(), name: index === 0 ? 'Hoy' : index === 1 ? 'Mañana' : new Intl.DateTimeFormat('es-AR', { weekday: 'long' }).format(date) }; });
  return `${pageHeading('ORGANIZÁ LAS CLASES', 'Agenda', 'Consultá las actividades y los cupos de los próximos 7 días.', button('Agregar clase', 'add-class', 'plus'))}<section class="page-panel"><div class="week-strip">${days.map((day, index) => `<button class="week-day ${index === 0 ? 'selected' : ''}" data-action="select-day" data-date="${day.key}"><span>${escapeHtml(day.day)}</span><b>${day.number}</b><small>${escapeHtml(day.name)}</small></button>`).join('')}</div><div class="panel-header"><div><h2 class="panel-title" id="agendaDayTitle">Clases programadas</h2><p class="panel-subtitle" id="agendaDaySubtitle">${dateLabel(days[0].key, { full: true })}</p></div><span class="pill pill-success">${state.classes.filter(item => item.date === days[0].key).length} clases</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>HORARIO</th><th>CLASE</th><th>ENTRENADOR/A</th><th>ESPACIO</th><th>CUPOS</th><th></th></tr></thead><tbody id="agendaRows">${agendaRows(days[0].key)}</tbody></table></div><div class="table-footer"><span>Los cupos y horarios son editables.</span><span>Semana del ${dateLabel(days[0].key)}</span></div></section><section class="panel section-gap"><div class="panel-header"><div><h2 class="panel-title">Resumen de clases</h2><p class="panel-subtitle">Capacidad y actividad para organizar al equipo</p></div>${icon('chart-no-axes-column-increasing')}</div><div class="report-grid" style="padding:13px"><article class="report-card"><span>Clases programadas</span><strong>${state.classes.length}</strong><small>En los próximos 7 días</small></article><article class="report-card"><span>Inscripciones</span><strong>${state.classes.reduce((sum, item) => sum + Number(item.enrolled || 0), 0)}</strong><small>Reservas registradas</small></article><article class="report-card"><span>Ocupación promedio</span><strong>${state.classes.length ? Math.round(state.classes.reduce((sum, item) => sum + Number(item.enrolled || 0) / Math.max(Number(item.capacity || 0), 1), 0) / state.classes.length * 100) : 0}%</strong><small>Sobre la capacidad disponible</small></article></div></section>`;
}
function agendaRows(date) {
  const classes = state.classes.filter(item => item.date === date).sort((a, b) => a.time.localeCompare(b.time));
  if (!classes.length) return `<tr><td colspan="6"><div class="empty-state">${icon('calendar-check')}<h3>Día libre de clases</h3><p>No hay actividades agendadas para esta fecha.</p><button class="button button-quiet" data-action="add-class">Agregar clase</button></div></td></tr>`;
  return classes.map((item, index) => `<tr><td class="member-name">${escapeHtml(item.time)}<span class="member-meta">${item.duration} min</span></td><td><div class="member-cell"><span class="class-color color-${index % 4}"></span><span class="member-name">${escapeHtml(item.title)}</span></div></td><td>${escapeHtml(item.coach)}</td><td>${escapeHtml(item.room)}</td><td><div class="capacity-meter"><span>${item.enrolled} / ${item.capacity}</span><span class="meter-track"><i style="width:${Math.min(100, Math.round(item.enrolled / Math.max(item.capacity, 1) * 100))}%"></i></span></div></td><td><button class="table-action" data-action="edit-class" data-id="${escapeHtml(item.id)}" aria-label="Editar clase ${escapeHtml(item.title)}">${icon('ellipsis')}</button></td></tr>`).join('');
}
function renderPayments() {
  const filtered = state.payments.filter(payment => paymentFilter === 'Todos los pagos' || payment.status === paymentFilter).sort((a, b) => b.date.localeCompare(a.date));
  const earned = state.payments.filter(payment => payment.status === 'Acreditado').reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const pending = state.payments.filter(payment => payment.status === 'Pendiente').reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const methods = state.payments.reduce((counts, payment) => { counts[payment.method] = (counts[payment.method] || 0) + 1; return counts; }, {});
  const mostUsedMethod = Object.entries(methods).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
  return `${pageHeading('ADMINISTRACIÓN', 'Pagos', 'Seguí los cobros y mantené las cuentas de tu gimnasio al día.', button('Registrar pago', 'add-payment', 'plus'))}<div class="stats-grid"><article class="stat-card"><div class="stat-top"><span>Ingresos registrados</span><span class="stat-icon">${icon('circle-dollar-sign')}</span></div><div class="stat-value payment-total">${money.format(earned)}</div><div class="stat-foot">Total de pagos acreditados</div></article><article class="stat-card"><div class="stat-top"><span>Pagos pendientes</span><span class="stat-icon amber">${icon('clock-3')}</span></div><div class="stat-value payment-total">${money.format(pending)}</div><div class="stat-foot">${state.payments.filter(p => p.status === 'Pendiente').length} movimiento${state.payments.filter(p => p.status === 'Pendiente').length === 1 ? '' : 's'} por revisar</div></article><article class="stat-card"><div class="stat-top"><span>Movimientos</span><span class="stat-icon blue">${icon('receipt-text')}</span></div><div class="stat-value payment-total">${state.payments.length}</div><div class="stat-foot">Todos los movimientos cargados</div></article><article class="stat-card"><div class="stat-top"><span>Medio más usado</span><span class="stat-icon">${icon('landmark')}</span></div><div class="stat-value payment-total">${escapeHtml(mostUsedMethod)}</div><div class="stat-foot">Según los movimientos registrados</div></article></div><section class="page-panel section-gap"><div class="toolbar"><div><h2 class="panel-title">Movimientos recientes</h2><p class="panel-subtitle">Registrá pagos y consultá su estado</p></div><select class="select-control" id="paymentFilter" aria-label="Filtrar pagos">${['Todos los pagos', 'Acreditado', 'Pendiente'].map(item => `<option${paymentFilter === item ? ' selected' : ''}>${item}</option>`).join('')}</select></div>${filtered.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>SOCIO</th><th>CONCEPTO</th><th>FECHA</th><th>MEDIO</th><th>ESTADO</th><th>IMPORTE</th><th></th></tr></thead><tbody>${filtered.map((payment, i) => `<tr><td><div class="member-cell"><span class="member-mini ${avatarClass(i)}">${escapeHtml(initials(payment.member))}</span><span class="member-name">${escapeHtml(payment.member)}</span></div></td><td>${escapeHtml(payment.concept)}</td><td>${dateLabel(payment.date)}</td><td>${escapeHtml(payment.method)}</td><td>${statusPill(payment.status)}</td><td class="member-name">${money.format(payment.amount)}</td><td>${payment.status === 'Pendiente' ? `<button class="small-link" data-action="settle-payment" data-id="${escapeHtml(payment.id)}">Acreditar</button>` : '—'}</td></tr>`).join('')}</tbody></table></div><div class="table-footer"><span>${filtered.length} movimientos</span><span>Moneda: pesos argentinos (ARS)</span></div>` : `<div class="empty-state"><h3>Sin movimientos para mostrar</h3><p>Probá con otro filtro.</p></div>`}</section>`;
}
function renderAttendance() {
  const todaysVisits = state.visits.filter(visit => visit.date === dayOffset(0));
  return `${pageHeading('MOVIMIENTO DEL GIMNASIO', 'Asistencia', 'Registrá ingresos y consultá la actividad reciente de hoy.', '')}<div class="attendance-layout"><div><section class="checkin-box"><span class="checkin-icon">${icon('scan-line')}</span><h2>Registrar un ingreso</h2><p>Buscá a un socio para registrar su visita de hoy.</p><form id="checkinForm" class="checkin-search"><div style="display:flex;gap:8px"><label class="search-box">${icon('search')}<input id="checkinSearch" type="search" placeholder="Nombre o email del socio" aria-label="Buscar socio para asistencia"></label><button class="button button-primary">${icon('arrow-right')}Registrar</button></div><div id="checkinMatches" class="checkin-matches"></div></form></section><section class="page-panel section-gap"><div class="panel-header"><div><h2 class="panel-title">Ingresos recientes</h2><p class="panel-subtitle">Movimientos cargados para el día de hoy</p></div><span class="pill pill-success">${todaysVisits.length} visitas</span></div>${todaysVisits.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>SOCIO</th><th>HORA</th><th>TIPO DE ACCESO</th></tr></thead><tbody>${todaysVisits.map((visit, i) => `<tr><td><div class="member-cell"><span class="member-mini ${avatarClass(i)}">${escapeHtml(initials(visit.member))}</span><span class="member-name">${escapeHtml(visit.member)}</span></div></td><td>${escapeHtml(visit.time)}</td><td>${escapeHtml(visit.kind)}</td></tr>`).join('')}</tbody></table></div>` : `<div class="empty-state"><p>Todavía no hay visitas. Registrá el primer ingreso.</p></div>`}</section></div><aside class="panel"><div class="panel-header"><div><h2 class="panel-title">Hoy en ${escapeHtml(state.gym.name || 'tu gimnasio')}</h2><p class="panel-subtitle">Resumen de actividad</p></div>${icon('activity')}</div><div class="attendance-stat"><span>Ingresos registrados hoy</span><strong>${todaysVisits.length}</strong><small>Visitas de hoy</small></div><div class="attendance-stat"><span>Horario de atención</span><strong style="font-size:15px">${escapeHtml(state.gym.hours || 'Sin configurar')}</strong><small>Actualizalo en Configuración</small></div><div class="attendance-stat"><span>Socios activos</span><strong>${state.members.filter(m => m.status === 'Activa').length}</strong><small>Según fecha de vencimiento</small></div></aside></div>`;
}
function renderReports() {
  const active = state.members.filter(m => m.status === 'Activa').length;
  const gross = state.payments.filter(p => p.status === 'Acreditado').reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const months = Array.from({ length: 6 }, (_, index) => { const date = new Date(today.getFullYear(), today.getMonth() - 5 + index, 1, 12); const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; return { key, label: new Intl.DateTimeFormat('es-AR', { month: 'short' }).format(date).replace('.', ''), total: state.payments.filter(payment => payment.status === 'Acreditado' && payment.date?.startsWith(key)).reduce((sum, payment) => sum + Number(payment.amount || 0), 0) }; });
  const maxMonthly = Math.max(...months.map(month => month.total), 1);
  return `${pageHeading('UNA MIRADA MÁS AMPLIA', 'Reportes', 'Consultá indicadores calculados con los datos de tu gimnasio.', `<button class="button button-quiet" data-action="export-report">${icon('download')}Exportar socios</button>`)}<div class="report-grid"><article class="report-card"><span class="report-icon">${icon('users-round')}</span><span>Socios activos</span><strong>${active}</strong><small>De ${state.members.length} perfiles registrados</small></article><article class="report-card"><span class="report-icon">${icon('badge-dollar-sign')}</span><span>Ingresos acreditados</span><strong style="font-size:20px">${money.format(gross)}</strong><small>Total de pagos acreditados</small></article><article class="report-card"><span class="report-icon">${icon('scan-line')}</span><span>Visitas registradas</span><strong>${state.visits.length}</strong><small>Todos los registros de asistencia</small></article></div><section class="panel section-gap"><div class="panel-header"><div><h2 class="panel-title">Ingresos mensuales</h2><p class="panel-subtitle">Pagos acreditados en los últimos seis meses</p></div><span class="legend"><span class="legend-dot"></span>Ingresos acreditados</span></div><div class="bar-chart">${months.map(month => `<div class="bar-group"><div class="bar-pair"><span class="bar alt" title="${escapeHtml(month.label)}: ${money.format(month.total)}" style="height:${Math.max(3, month.total / maxMonthly * 100)}%"></span></div><span>${escapeHtml(month.label)}</span></div>`).join('')}</div><div style="padding:15px 18px;color:#929d97;font-size:9px">El gráfico se actualiza al registrar o modificar pagos.</div></section><section class="panel section-gap"><div class="panel-header"><div><h2 class="panel-title">Indicadores para revisar</h2><p class="panel-subtitle">Seguimiento operativo</p></div></div><div style="padding:14px 18px;display:grid;grid-template-columns:repeat(3,1fr);gap:14px"><div><span class="field-hint">Membresías por vencer</span><strong style="display:block;font:700 17px Manrope;margin-top:5px">${state.members.filter(m => m.status === 'Por vencer').length}</strong></div><div><span class="field-hint">Membresías vencidas</span><strong style="display:block;font:700 17px Manrope;margin-top:5px">${state.members.filter(m => m.status === 'Vencida').length}</strong></div><div><span class="field-hint">Pagos pendientes</span><strong style="display:block;font:700 17px Manrope;margin-top:5px">${state.payments.filter(p => p.status === 'Pendiente').length}</strong></div></div></section>`;
}
function renderSettings() {
  return `${pageHeading('PERSONALIZÁ TU ESPACIO', 'Configuración', 'Mantené actualizada la información de tu gimnasio.', '')}<div class="settings-layout"><nav class="settings-tabs" aria-label="Secciones de configuración"><button class="settings-tab active">Información general</button><button class="settings-tab" data-action="settings-coming">Preferencias</button><button class="settings-tab" data-action="settings-coming">Equipo y permisos</button></nav><form id="settingsForm" class="settings-form"><h2>Información del gimnasio</h2><p>Estos datos sirven para identificar a tu espacio de trabajo.</p><div class="form-section"><div class="form-grid"><div class="field"><label for="gymName">Nombre del gimnasio</label><input id="gymName" name="name" value="${escapeHtml(state.gym.name)}" required maxlength="80"></div><div class="field"><label for="gymCity">Ciudad</label><input id="gymCity" name="city" value="${escapeHtml(state.gym.city)}" required maxlength="80"></div><div class="field"><label for="gymAddress">Dirección</label><input id="gymAddress" name="address" value="${escapeHtml(state.gym.address)}" maxlength="120"></div><div class="field"><label for="gymEmail">Email de contacto</label><input id="gymEmail" name="email" type="email" value="${escapeHtml(state.gym.email)}" maxlength="120"></div><div class="field"><label for="gymPhone">Teléfono</label><input id="gymPhone" name="phone" value="${escapeHtml(state.gym.phone)}" maxlength="40"></div><div class="field"><label for="gymHours">Horario de atención</label><input id="gymHours" name="hours" value="${escapeHtml(state.gym.hours)}" maxlength="100"></div></div><span class="field-hint" style="display:block;margin-top:13px">Los cambios se guardan en Firestore y se sincronizan con el equipo.</span></div><button class="button button-primary settings-save">${icon('save')}Guardar cambios</button></form></div>`;
}
const renderers = { inicio: renderDashboard, socios: renderMembers, membresias: renderPlans, agenda: renderAgenda, pagos: renderPayments, asistencia: renderAttendance, reportes: renderReports, ajustes: renderSettings };
const pageTitles = { inicio: 'Resumen', socios: 'Socios', membresias: 'Membresías', agenda: 'Agenda', pagos: 'Pagos', asistencia: 'Asistencia', reportes: 'Reportes', ajustes: 'Configuración' };
function renderPage(page = currentPage) {
  currentPage = renderers[page] ? page : 'inicio';
  $('#pageContent').innerHTML = renderers[currentPage]();
  $('#crumbCurrent').textContent = pageTitles[currentPage];
  $$('.nav-item[data-page]').forEach(item => item.classList.toggle('active', item.dataset.page === currentPage));
  updateMemberCount();
  refreshIcons();
  $('#pageContent').focus({ preventScroll: true });
}
function toast(message, type = '') {
  const node = document.createElement('div'); node.className = `toast ${type}`; node.textContent = message; $('#toastRegion').append(node);
  window.setTimeout(() => node.remove(), 3400);
}
function openDialog({ title, eyebrow = 'GESTIÓN', submit = 'Guardar cambios', fields, onSave }) {
  const dialog = $('#appDialog'); $('#dialogTitle').textContent = title; $('#dialogEyebrow').textContent = eyebrow; $('#dialogSubmit').textContent = submit;
  $('#dialogBody').innerHTML = fields; $('#dialogForm').dataset.action = onSave; dialog.showModal(); refreshIcons();
  window.setTimeout(() => $('input,select,textarea', $('#dialogBody'))?.focus(), 30);
}
function fieldMarkup({ label, name, type = 'text', value = '', required = false, placeholder = '', options = [], hint = '', min = '', step = '' }) {
  const req = required ? ' required' : ''; const escapedValue = escapeHtml(value); const safeName = escapeHtml(name);
  let control;
  if (type === 'select') control = `<select id="field-${safeName}" name="${safeName}"${req}>${options.map(option => { const optionValue = typeof option === 'object' ? option.value : option; const optionLabel = typeof option === 'object' ? option.label : option; return `<option value="${escapeHtml(optionValue)}"${String(optionValue) === String(value) ? ' selected' : ''}>${escapeHtml(optionLabel)}</option>`; }).join('')}</select>`;
  else if (type === 'textarea') control = `<textarea id="field-${safeName}" name="${safeName}" placeholder="${escapeHtml(placeholder)}"${req}>${escapedValue}</textarea>`;
  else control = `<input id="field-${safeName}" name="${safeName}" type="${type}" value="${escapedValue}" placeholder="${escapeHtml(placeholder)}"${required ? ' required' : ''}${min !== '' ? ` min="${min}"` : ''}${step !== '' ? ` step="${step}"` : ''}>`;
  return `<div class="field"><label for="field-${safeName}">${escapeHtml(label)}${required ? ' *' : ''}</label>${control}${hint ? `<span class="field-hint">${escapeHtml(hint)}</span>` : ''}</div>`;
}
function memberFields(member = {}) {
  const plans = state.plans.map(plan => plan.name); if (member.plan && !plans.includes(member.plan)) plans.push(member.plan);
  return `<div class="form-grid">${fieldMarkup({ label: 'Nombre y apellido', name: 'name', value: member.name || '', required: true, placeholder: 'Ej. Ana Pérez' })}${fieldMarkup({ label: 'Email', name: 'email', type: 'email', value: member.email || '', required: true, placeholder: 'ana@email.com' })}${fieldMarkup({ label: 'Teléfono', name: 'phone', value: member.phone || '', placeholder: '+54 9 11 1234-5678' })}${fieldMarkup({ label: 'Membresía', name: 'plan', type: 'select', value: member.plan || plans[0] || '', options: plans.length ? plans : ['Sin plan'] })}${fieldMarkup({ label: 'Vencimiento', name: 'expires', type: 'date', value: member.expires || dayOffset(30), required: true, hint: 'El estado se calcula a partir de esta fecha.' })}</div>`;
}
function addMember(member = null) {
  const editing = Boolean(member); openDialog({ title: editing ? 'Editar socio' : 'Agregar socio', eyebrow: 'SOCIOS', submit: editing ? 'Guardar cambios' : 'Agregar socio', fields: memberFields(member || {}), onSave: editing ? `save-member:${member.id}` : 'save-member:new' });
  if (editing) $('#dialogBody').insertAdjacentHTML('beforeend', `<button type="button" class="danger-link" data-action="remove-member" data-id="${escapeHtml(member.id)}">${icon('trash-2')}Eliminar socio</button>`);
}
function addPlan(plan = null) {
  const editing = Boolean(plan); openDialog({ title: editing ? 'Editar plan' : 'Crear plan', eyebrow: 'MEMBRESÍAS', submit: editing ? 'Guardar cambios' : 'Crear plan', fields: `<div class="form-grid">${fieldMarkup({ label: 'Nombre del plan', name: 'name', value: plan?.name || '', required: true, placeholder: 'Ej. Plan Tarde' })}${fieldMarkup({ label: 'Precio por período (ARS)', name: 'price', type: 'number', value: plan?.price || '', required: true, min: '0', step: '500' })}${fieldMarkup({ label: 'Período', name: 'period', type: 'select', value: plan?.period || 'mes', options: ['mes', 'semana', 'año'] })}${fieldMarkup({ label: 'Acceso incluido', name: 'access', value: plan?.access || '', required: true, placeholder: 'Ej. Sala de musculación' })}${fieldMarkup({ label: 'Disponibilidad', name: 'active', type: 'select', value: plan?.active === false ? 'Pausado' : 'Activo', options: ['Activo', 'Pausado'] })}</div>`, onSave: editing ? `save-plan:${plan.id}` : 'save-plan:new' });
}
function addPayment() {
  const members = state.members.map(member => member.name);
  if (!members.length) { toast('Agregá un socio antes de registrar un pago.', 'error'); return; }
  const memberOptions = [{ value: '', label: 'Elegí un socio' }, ...state.members.map(member => ({ value: member.id, label: member.name }))];
  openDialog({ title: 'Registrar pago', eyebrow: 'PAGOS', submit: 'Guardar pago', fields: `<div class="form-grid">${fieldMarkup({ label: 'Socio', name: 'memberId', type: 'select', value: '', required: true, options: memberOptions })}${fieldMarkup({ label: 'Concepto', name: 'concept', required: true, placeholder: 'Ej. Plan Integral · Octubre' })}${fieldMarkup({ label: 'Importe (ARS)', name: 'amount', type: 'number', required: true, min: '1', step: '100' })}${fieldMarkup({ label: 'Medio de pago', name: 'method', type: 'select', value: 'Transferencia', options: ['Transferencia', 'Efectivo', 'Débito', 'Crédito', 'Otro'] })}${fieldMarkup({ label: 'Estado', name: 'status', type: 'select', value: 'Acreditado', options: ['Acreditado', 'Pendiente'] })}</div>`, onSave: 'save-payment' });
}
function addClass(item = null, date = dayOffset(0)) {
  const editing = Boolean(item);
  openDialog({ title: editing ? 'Editar clase' : 'Agregar clase', eyebrow: 'AGENDA', submit: editing ? 'Guardar cambios' : 'Agregar clase', fields: `<div class="form-grid">${fieldMarkup({ label: 'Nombre de la clase', name: 'title', value: item?.title || '', required: true, placeholder: 'Ej. Entrenamiento funcional' })}${fieldMarkup({ label: 'Entrenador/a', name: 'coach', value: item?.coach || '', required: true, placeholder: 'Nombre y apellido' })}${fieldMarkup({ label: 'Fecha', name: 'date', type: 'date', value: item?.date || date, required: true })}${fieldMarkup({ label: 'Horario', name: 'time', type: 'time', value: item?.time || '18:00', required: true })}${fieldMarkup({ label: 'Duración (minutos)', name: 'duration', type: 'number', value: item?.duration || 50, required: true, min: '15', step: '5' })}${fieldMarkup({ label: 'Cupo máximo', name: 'capacity', type: 'number', value: item?.capacity || 16, required: true, min: '1', step: '1' })}${fieldMarkup({ label: 'Espacio', name: 'room', value: item?.room || 'Sala principal', required: true, placeholder: 'Ej. Sala principal' })}</div>`, onSave: editing ? `save-class:${item.id}` : 'save-class:new' });
}
function todayTime() { return new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()); }
function showCheckinMatches() {
  const input = $('#checkinSearch'); const holder = $('#checkinMatches'); if (!input || !holder) return;
  const query = input.value.trim().toLowerCase(); if (!query) { holder.innerHTML = ''; return; }
  const matches = state.members.filter(member => `${member.name} ${member.email}`.toLowerCase().includes(query)).slice(0, 5);
  holder.innerHTML = matches.length ? `<div class="match-list">${matches.map(member => `<button type="button" class="match-item" data-action="select-checkin" data-id="${escapeHtml(member.id)}"><span class="member-mini">${escapeHtml(initials(member.name))}</span><span>${escapeHtml(member.name)}<small>${escapeHtml(member.email)}</small></span>${statusPill(member.status)}</button>`).join('')}</div>` : `<div class="match-empty">No encontramos socios con ese dato.</div>`;
}
function exportCsv() {
  const rows = [['Nombre', 'Email', 'Plan', 'Estado', 'Vencimiento'], ...state.members.map(member => [member.name, member.email, member.plan, member.status, member.expires])];
  const csv = '\ufeff' + rows.map(row => row.map(cell => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(';')).join('\r\n');
  const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); link.download = 'gymtool-socios.csv'; link.click(); URL.revokeObjectURL(link.href); toast('Descargamos el listado de socios.');
}

document.addEventListener('click', async event => {
  const pageButton = event.target.closest('[data-page]');
  if (pageButton) { renderPage(pageButton.dataset.page); closeMobileNav(); return; }
  const actionButton = event.target.closest('[data-action]'); if (!actionButton) return;
  const { action, id } = actionButton.dataset;
  if (action === 'add-member') addMember();
  else if (action === 'edit-member') { const member = state.members.find(item => item.id === id); if (member) addMember(member); }
  else if (action === 'add-plan') addPlan();
  else if (action === 'edit-plan') { const plan = state.plans.find(item => item.id === id); if (plan) addPlan(plan); }
  else if (action === 'add-class') addClass(null, agendaSelectedDate);
  else if (action === 'edit-class') { const item = state.classes.find(classItem => classItem.id === id); if (item) addClass(item); }
  else if (action === 'select-day') { agendaSelectedDate = actionButton.dataset.date; $$('.week-day').forEach(day => day.classList.toggle('selected', day.dataset.date === actionButton.dataset.date)); $('#agendaDaySubtitle').textContent = dateLabel(actionButton.dataset.date, { full: true }); $('#agendaDayTitle').textContent = actionButton.dataset.date === dayOffset(0) ? 'Clases programadas' : `Clases · ${actionButton.querySelector('small').textContent}`; $('#agendaRows').innerHTML = agendaRows(actionButton.dataset.date); actionButton.closest('.page-panel').querySelector('.panel-header .pill').textContent = `${state.classes.filter(item => item.date === actionButton.dataset.date).length} clases`; refreshIcons(); }
  else if (action === 'add-payment') addPayment();
  else if (action === 'settle-payment') { const payment = state.payments.find(item => item.id === id); if (payment) { try { await persistUpdate('payments', id, { status: 'Acreditado', method: payment.method === 'Pendiente' ? 'Transferencia' : payment.method }); const member = state.members.find(item => item.id === payment.memberId); if (member) await persistUpdate('members', member.id, { status: 'Activa', expires: member.expires < dayOffset(1) ? dayOffset(30) : member.expires }); toast('El pago quedó marcado como acreditado.'); } catch (error) { toast(cloudErrorMessage(error), 'error'); } } }
  else if (action === 'clear-member-filters') { memberQuery = ''; memberStatusFilter = 'Todos los estados'; renderPage('socios'); }
  else if (action === 'export-report') exportCsv();
  else if (action === 'settings-coming') toast('Esta sección estará disponible en una próxima versión.');
  else if (action === 'select-checkin') { const member = state.members.find(item => item.id === id); if (member) { $('#checkinSearch').value = member.name; $('#checkinSearch').dataset.selectedId = member.id; $('#checkinMatches').innerHTML = `<div class="selected-member">Socio seleccionado: <b>${escapeHtml(member.name)}</b></div>`; } }
  else if (action === 'chart-period') toast('El gráfico muestra los últimos 28 días de pagos acreditados.');
  else if (action === 'remove-member') { if (window.confirm('¿Querés eliminar este socio de este gimnasio?')) { try { await deleteDoc(workspaceDocument('members', id)); $('#appDialog').close(); toast('El socio se eliminó.'); } catch (error) { toast(cloudErrorMessage(error), 'error'); } } }
});
function closeMobileNav() { $('#sidebar').classList.remove('open'); $('.mobile-scrim')?.classList.remove('visible'); }
document.addEventListener('input', event => {
  if (event.target.id === 'memberSearch') { memberQuery = event.target.value; const cursor = event.target.selectionStart; renderPage('socios'); const input = $('#memberSearch'); input.focus(); input.setSelectionRange(cursor, cursor); }
  if (event.target.id === 'checkinSearch') { delete event.target.dataset.selectedId; showCheckinMatches(); }
});
document.addEventListener('change', event => {
  if (event.target.id === 'memberStatusFilter') { memberStatusFilter = event.target.value; renderPage('socios'); }
  if (event.target.id === 'memberSort') { sortMembers = event.target.value; renderPage('socios'); }
  if (event.target.id === 'paymentFilter') { paymentFilter = event.target.value; renderPage('pagos'); }
});
$('#dialogForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget; const values = Object.fromEntries(new FormData(form).entries()); const action = form.dataset.action;
  if (action.startsWith('save-member:')) {
    const id = action.split(':')[1]; const current = id === 'new' ? null : state.members.find(member => member.id === id);
    const member = { name: values.name.trim(), email: values.email.trim(), phone: values.phone.trim(), plan: values.plan === 'Sin plan' ? '' : values.plan, expires: values.expires };
    try { if (current) await persistUpdate('members', id, member); else await persistNew('members', { ...member, joinedAt: serverTimestamp() }); $('#appDialog').close(); toast(current ? 'Los datos del socio se actualizaron.' : 'El socio se agregó correctamente.'); }
    catch (error) { toast(cloudErrorMessage(error), 'error'); }
  } else if (action.startsWith('save-plan:')) {
    const id = action.split(':')[1]; const current = id === 'new' ? null : state.plans.find(plan => plan.id === id); const previousName = current?.name;
    const plan = { name: values.name.trim(), price: Number(values.price), period: values.period, access: values.access.trim(), active: values.active === 'Activo', color: current?.color || '' };
    try { if (current) await persistUpdate('plans', id, plan); else await persistNew('plans', plan); if (current && previousName !== plan.name) { const linked = state.members.filter(member => member.plan === previousName); await Promise.all(linked.map(member => persistUpdate('members', member.id, { plan: plan.name }))); } $('#appDialog').close(); toast(current ? 'El plan se actualizó.' : 'El plan se creó correctamente.'); }
    catch (error) { toast(cloudErrorMessage(error), 'error'); }
  } else if (action.startsWith('save-class:')) {
    const id = action.split(':')[1]; const current = id === 'new' ? null : state.classes.find(item => item.id === id); const item = { title: values.title.trim(), coach: values.coach.trim(), date: values.date, time: values.time, duration: Number(values.duration), capacity: Number(values.capacity), room: values.room.trim(), enrolled: current?.enrolled || 0 };
    try { if (current) await persistUpdate('classes', id, item); else await persistNew('classes', item); $('#appDialog').close(); toast(current ? 'La clase se actualizó.' : 'La clase se agregó a la agenda.'); }
    catch (error) { toast(cloudErrorMessage(error), 'error'); }
  } else if (action === 'save-payment') {
    const member = state.members.find(item => item.id === values.memberId); if (!member) { toast('Elegí un socio de la lista.', 'error'); return; }
    try { await persistNew('payments', { memberId: member.id, member: member.name, concept: values.concept.trim(), amount: Number(values.amount), method: values.method, date: dayOffset(0), status: values.status }); if (values.status === 'Acreditado') await persistUpdate('members', member.id, { status: 'Activa', expires: member.expires < dayOffset(1) ? dayOffset(30) : member.expires }); $('#appDialog').close(); toast('El pago quedó registrado.'); }
    catch (error) { toast(cloudErrorMessage(error), 'error'); }
  }
});
$$('#dialogForm [value="cancel"]').forEach(button => button.addEventListener('click', event => { event.preventDefault(); $('#appDialog').close(); }));
$('#pageContent').addEventListener('submit', async event => {
  if (event.target.id === 'settingsForm') { event.preventDefault(); const values = Object.fromEntries(new FormData(event.target).entries()); try { await updateDoc(doc(db, 'gyms', state.gymId), { ...values, updatedAt: serverTimestamp() }); toast('La información del gimnasio se guardó.'); } catch (error) { toast(cloudErrorMessage(error), 'error'); } }
  if (event.target.id === 'checkinForm') { event.preventDefault(); const search = $('#checkinSearch'); const member = state.members.find(item => item.id === search.dataset.selectedId) || state.members.find(item => item.name.toLowerCase() === search.value.trim().toLowerCase() || item.email.toLowerCase() === search.value.trim().toLowerCase()); if (!member) { toast('Elegí un socio de la lista antes de registrar el ingreso.', 'error'); showCheckinMatches(); return; } if (member.status === 'Vencida' && !window.confirm(`La membresía de ${member.name} está vencida. ¿Querés registrar el ingreso de todos modos?`)) return; try { await persistNew('attendance', { memberId: member.id, member: member.name, date: dayOffset(0), time: todayTime(), kind: 'Acceso general' }); toast(`Ingreso registrado para ${member.name}.`); } catch (error) { toast(cloudErrorMessage(error), 'error'); } }
});
$('#mobileMenu').addEventListener('click', () => { $('#sidebar').classList.add('open'); const scrim = $('.mobile-scrim') || document.createElement('div'); scrim.className = 'mobile-scrim visible'; if (!scrim.isConnected) { document.body.append(scrim); scrim.addEventListener('click', closeMobileNav); } });
$('#locationPicker').addEventListener('click', () => {
  if (state.workspaces.length < 2) { toast('Este usuario tiene un único gimnasio asociado.'); return; }
  const options = state.workspaces.map((workspace, index) => `${index + 1}. ${workspace.name} · ${workspace.city || 'Sin ciudad'}`).join('\n');
  const selection = Number(window.prompt(`Elegí un gimnasio escribiendo su número:\n${options}`, '1'));
  if (Number.isInteger(selection) && state.workspaces[selection - 1]) selectWorkspace(state.workspaces[selection - 1].id);
});
$('#notificationsButton').addEventListener('click', () => toast('No tenés notificaciones nuevas.'));
$('#themeToggle').addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
$('#helpButton').addEventListener('click', () => toast('El centro de ayuda estará disponible próximamente.'));
$('#accountButton').addEventListener('click', async () => { try { await signOut(auth); } catch (error) { toast(cloudErrorMessage(error), 'error'); } });
$('#todayLabel').textContent = new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(today);
$('#currentYear').textContent = String(today.getFullYear());
setTheme(savedTheme);
$('#authScreen').addEventListener('click', async event => {
  if (event.target.closest('#authThemeToggle')) { setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); return; }
  const modeButton = event.target.closest('[data-auth-mode]'); if (modeButton) { showAuth(modeButton.dataset.authMode); return; }
  if (event.target.closest('#resetPassword')) {
    const email = $('#authEmail').value.trim(); if (!email) { showAuth('login', 'Escribí tu email y después elegí recuperar contraseña.'); return; }
    try { await sendPasswordResetEmail(auth, email); showAuth('login', 'Te enviamos un enlace para recuperar la contraseña.'); } catch (error) { showAuth('login', cloudErrorMessage(error)); }
  }
  if (event.target.closest('#workspaceSignout')) await signOut(auth);
});
$('#authScreen').addEventListener('submit', async event => {
  event.preventDefault(); const form = event.target; const submit = $('button[type="submit"]', form); if (submit) submit.disabled = true;
  try {
    if (form.id === 'authForm') {
      const values = Object.fromEntries(new FormData(form).entries());
      if (form.dataset.mode === 'signup') {
        registrationInProgress = true;
        const credential = await createUserWithEmailAndPassword(auth, values.email.trim(), values.password);
        state.profile = { uid: credential.user.uid, name: values.name.trim(), email: values.email.trim(), createdAt: serverTimestamp() };
        await setDoc(doc(db, 'users', credential.user.uid), state.profile);
        registrationInProgress = false; await loadWorkspaces(credential.user);
      } else await signInWithEmailAndPassword(auth, values.email.trim(), values.password);
    } else if (form.id === 'workspaceForm') {
      await createWorkspace(currentUser, new FormData(form).get('name'), new FormData(form).get('city'));
    }
  } catch (error) {
    registrationInProgress = false; console.error(error);
    if (form.id === 'workspaceForm') showOnboarding(cloudErrorMessage(error));
    else showAuth(form.dataset.mode || 'login', cloudErrorMessage(error));
  } finally { if (submit) submit.disabled = false; }
});
startApplication();
