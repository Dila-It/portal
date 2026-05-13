// Portal index page logic

const RECAPTCHA_SITE_KEY = '6LeSJeYsAAAAALzQNOREX0fJ7AObrQZsv66j-a1Y';

const SYSTEMS = [
  {
    id:          'zhihui-todo',
    name:        '智慧待辦',
    desc:        'Gmail 整合、AI 分析、工作四象限儀表板',
    icon:        '✦',
    color:       'linear-gradient(135deg, #4f8ef7, #7c3aed)',
    accentColor: '#6366F1',
    url:         'https://dila-it.github.io/todo-app/',
  },
  // 未來系統在此新增
];

let currentUser = null;

function initPortal() {
  initAuth({
    onLogin:  handleLogin,
    onLogout: showLoginView,
  });

  document.getElementById('loginForm').addEventListener('submit', handleLoginSubmit);
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const btn      = document.getElementById('loginBtn');
  const errEl    = document.getElementById('loginError');

  btn.disabled    = true;
  btn.textContent = '登入中...';
  errEl.style.display = 'none';

  const recaptchaToken = grecaptcha.getResponse();
  if (!recaptchaToken) {
    errEl.textContent   = '請先完成「我不是機器人」驗證';
    errEl.style.display = 'block';
    btn.disabled        = false;
    btn.textContent     = '登入';
    return;
  }

  try {
    await signIn(email, password);
  } catch (err) {
    errEl.textContent    = translateAuthError(err.code);
    errEl.style.display  = 'block';
    btn.disabled         = false;
    btn.textContent      = '登入';
    grecaptcha.reset();
  }
}

async function handleLogout() {
  await signOut();
}

function handleLogin(user) {
  currentUser = user;
  document.getElementById('navUserEmail').textContent = user.email;
  document.getElementById('loginView').style.display  = 'none';
  document.getElementById('appShell').style.display   = 'block';
  loadPortalData();
}

function showLoginView() {
  currentUser = null;
  document.getElementById('loginView').style.display  = '';
  document.getElementById('appShell').style.display   = 'none';
}

async function loadPortalData() {
  const [statuses, todoStats] = await Promise.all([
    loadSystemStatuses(),
    loadTodoStats(currentUser.uid),
    loadAnnouncement(),
    loadBulletins(),
    loadAndApplyPortalTheme(),
  ]);
  renderCards(statuses, { 'zhihui-todo': todoStats });
}

async function loadAndApplyPortalTheme() {
  try {
    const doc = await db.collection('portalConfig').doc('portalTheme').get();
    if (doc.exists) applyTheme(doc.data());
  } catch (_) {}
}

function applyTheme(theme) {
  const mode   = theme?.mode   || 'dark';
  const accent = theme?.accent || '#4f8ef7';
  document.documentElement.setAttribute('data-theme', mode);
  document.documentElement.style.setProperty('--accent', accent);
  const r = parseInt(accent.slice(1, 3), 16);
  const g = parseInt(accent.slice(3, 5), 16);
  const b = parseInt(accent.slice(5, 7), 16);
  const glowOpacity = mode === 'high-contrast' ? 0 : (mode === 'light' ? 0.1 : 0.12);
  document.documentElement.style.setProperty('--accent-glow', `rgba(${r},${g},${b},${glowOpacity})`);
}

async function loadBulletins() {
  try {
    const snap = await db.collection('portalConfig').doc('bulletinBoard')
      .collection('items').orderBy('pinned', 'desc').orderBy('createdAt', 'desc').get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderBulletins(items);
  } catch (_) {
    renderBulletins([]);
  }
}

function renderBulletins(items) {
  const list = document.getElementById('bulletinList');
  if (!items.length) {
    list.innerHTML = '<div class="bulletin-empty">目前沒有公告</div>';
    return;
  }
  list.innerHTML = items.map(item => {
    const date = item.createdAt?.toDate
      ? item.createdAt.toDate().toLocaleDateString('zh-TW')
      : '';
    const pin = item.pinned
      ? '<span class="bulletin-pin-badge">📌 置頂</span>'
      : '';
    return `
      <div class="bulletin-item${item.pinned ? ' pinned' : ''}">
        <div class="bulletin-item-header">
          <div class="bulletin-title">${escapeHtml(item.title)}</div>
          ${pin}
        </div>
        ${item.content ? `<div class="bulletin-content">${escapeHtml(item.content)}</div>` : ''}
        ${date ? `<div class="bulletin-date">${date}</div>` : ''}
      </div>`;
  }).join('');
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function loadAnnouncement() {
  try {
    const doc = await db.collection('portalConfig').doc('announcement').get();
    if (doc.exists) {
      const data = doc.data();
      if (data.enabled && data.text) {
        const bar = document.getElementById('announcementBar');
        document.getElementById('announcementText').textContent = data.text;
        bar.classList.remove('hidden');
      }
    }
  } catch (_) {}
}

async function loadSystemStatuses() {
  const statuses = {};
  try {
    const docs = await db.collection('portalConfig').doc('systems').collection('items').get();
    docs.forEach(doc => { statuses[doc.id] = doc.data(); });
  } catch (_) {}
  return statuses;
}

async function loadTodoStats(uid) {
  try {
    const snap = await db.collection('users').doc(uid).collection('todos')
      .where('status', 'in', ['pending', 'in-progress', 'scheduled']).get();
    const todos = snap.docs.map(d => d.data()).filter(t => !t.isDailyLog);
    const pending = todos.filter(t => t.status === 'pending').length;
    const q1 = todos.filter(t => {
      const urgency    = t.urgency    || 3;
      const importance = t.importance || urgency;
      return urgency >= 4 && importance >= 4;
    }).length;
    return { total: todos.length, pending, q1 };
  } catch (_) {
    return null;
  }
}

function renderCards(statuses, allStats = {}) {
  const grid = document.getElementById('cardsGrid');
  grid.innerHTML = '';

  SYSTEMS.forEach(sys => {
    const cfg    = statuses[sys.id] || {};
    const status = cfg.status || 'online';
    const stats  = allStats[sys.id] || null;
    const card   = buildCard(sys, status, stats);
    grid.appendChild(card);
  });
}

function buildCard(sys, status, stats) {
  const statusMap = {
    online:      { label: '線上',  cls: 'status-online' },
    maintenance: { label: '維護中', cls: 'status-maintenance' },
    offline:     { label: '離線',  cls: 'status-offline' },
  };
  const s = statusMap[status] || statusMap.online;

  const a = document.createElement('a');
  a.className = 'app-card';
  a.href      = status === 'online' ? sys.url : '#';
  if (status === 'online') a.target = '_blank';
  if (status !== 'online') a.addEventListener('click', e => e.preventDefault());

  if (sys.accentColor) {
    a.classList.add('has-accent');
    a.style.setProperty('--card-accent', sys.accentColor);
  }

  const badge = (stats && stats.total > 0)
    ? `<span class="card-badge">${stats.total > 99 ? '99+' : stats.total}</span>`
    : '';

  const statsRow = stats
    ? `<div class="card-stats">
        <span class="card-stat-item">待處理 <strong>${stats.pending}</strong></span>
        <span class="card-stat-sep">·</span>
        <span class="card-stat-item">Q1急件 <strong>${stats.q1}</strong></span>
       </div>`
    : '';

  a.innerHTML = `
    <div class="card-header">
      <div class="card-icon" style="background:${sys.color}">${sys.icon}</div>
      <div class="card-header-right">
        ${badge}
        <span class="card-status ${s.cls}">${s.label}</span>
      </div>
    </div>
    <div class="card-name">${sys.name}</div>
    <div class="card-desc">${sys.desc}</div>
    ${statsRow}
    <div class="card-footer">
      <span>${sys.url.replace('https://', '')}</span>
      <span class="card-link-icon">→</span>
    </div>
  `;
  return a;
}

function translateAuthError(code) {
  const map = {
    'auth/user-not-found':    '查無此帳號',
    'auth/wrong-password':    '密碼錯誤',
    'auth/invalid-email':     'Email 格式不正確',
    'auth/too-many-requests': '嘗試次數過多，請稍後再試',
    'auth/invalid-credential':'帳號或密碼錯誤',
    'recaptcha/failed':       '驗證失敗，請重新整理後再試',
  };
  return map[code] || '登入失敗，請再試一次';
}

document.addEventListener('DOMContentLoaded', initPortal);
