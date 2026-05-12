// Portal index page logic

const RECAPTCHA_SITE_KEY = '6LeSJeYsAAAAALzQNOREX0fJ7AObrQZsv66j-a1Y';

const SYSTEMS = [
  {
    id:    'zhihui-todo',
    name:  '智慧待辦',
    desc:  'Gmail 整合、AI 分析、工作四象限儀表板',
    icon:  '✦',
    color: 'linear-gradient(135deg, #4f8ef7, #7c3aed)',
    url:   'https://dila-it.github.io/todo-app/',
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
    console.error('Login error:', err.code, err.message);
    errEl.textContent    = translateAuthError(err.code) + (err.code ? ` (${err.code})` : '');
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
  await Promise.all([loadAnnouncement(), loadSystemStatuses()]);
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
  renderCards(statuses);
}

function renderCards(statuses) {
  const grid = document.getElementById('cardsGrid');
  grid.innerHTML = '';

  SYSTEMS.forEach(sys => {
    const cfg    = statuses[sys.id] || {};
    const status = cfg.status || 'online';
    const card   = buildCard(sys, status);
    grid.appendChild(card);
  });
}

function buildCard(sys, status) {
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

  a.innerHTML = `
    <div class="card-header">
      <div class="card-icon" style="background:${sys.color}">${sys.icon}</div>
      <span class="card-status ${s.cls}">${s.label}</span>
    </div>
    <div class="card-name">${sys.name}</div>
    <div class="card-desc">${sys.desc}</div>
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
