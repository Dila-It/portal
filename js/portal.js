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
  {
    id:          'project-mgr',
    name:        '專案管理',
    desc:        '里程碑追蹤、任務管理、與智慧待辦整合',
    icon:        '📋',
    color:       'linear-gradient(135deg, #10B981, #059669)',
    accentColor: '#10B981',
    url:         'https://dila-it.github.io/project-mgr/',
  },
  {
    id:          'docs',
    name:        '系統文件',
    desc:        '功能介紹、使用指南、技術架構說明',
    icon:        '📖',
    color:       'linear-gradient(135deg, #6366F1, #4f46e5)',
    accentColor: '#6366F1',
    url:         'docs.html',
    internal:    true,
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
    loadWeeklyNews(),
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
  const section = document.getElementById('bulletinSection');
  const list    = document.getElementById('bulletinList');

  if (!items.length) {
    section.classList.add('hidden');
    return;
  }
  section.classList.remove('hidden');

  if (!section.dataset.toggleInit) {
    section.dataset.toggleInit = '1';
    let collapsed = false;
    document.getElementById('bulletinToggle').addEventListener('click', () => {
      collapsed = !collapsed;
      list.classList.toggle('bulletin-collapsed', collapsed);
      document.getElementById('bulletinChevron').textContent = collapsed ? '▸' : '▾';
    });
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
  if (status === 'online' && !sys.internal) a.target = '_blank';
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

// ── Weekly News ───────────────────────────────────────────────

let newsArticles = [];

async function loadWeeklyNews() {
  try {
    const doc = await db.collection('portalConfig').doc('weeklyNews').get();
    if (!doc.exists || !doc.data().articles?.length) {
      renderNewsEmpty();
    } else {
      const data = doc.data();
      newsArticles = data.articles;
      renderNewsArticles(newsArticles);
      if (data.lastUpdated) {
        const d = data.lastUpdated.toDate().toLocaleDateString('zh-TW');
        document.getElementById('newsLastUpdated').textContent = `上次更新：${d}`;
      }
    }
  } catch (_) {
    renderNewsEmpty();
  }

  document.getElementById('newsTriggerBtn').addEventListener('click', triggerNewsFetch);
  document.getElementById('newsSummarizeBtn').addEventListener('click', summarizeSelected);
}

function renderNewsEmpty() {
  document.getElementById('newsList').innerHTML =
    '<div class="news-empty">尚無文章。請至設定頁填入關鍵字後點「立即更新」觸發抓取。</div>';
}

function renderNewsArticles(articles) {
  const list = document.getElementById('newsList');
  list.innerHTML = articles.map((a, i) => `
    <div class="news-item">
      <label class="news-item-check">
        <input type="checkbox" class="news-cb" data-index="${i}">
      </label>
      <div class="news-item-body">
        <div class="news-item-title">
          <a href="${escapeHtml(a.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(a.title)}</a>
        </div>
        <div class="news-item-meta">
          <span class="news-source">${escapeHtml(a.source)}</span>
          ${a.pubDate ? `<span class="news-date">${formatNewsDate(a.pubDate)}</span>` : ''}
        </div>
        ${a.snippet ? `<div class="news-snippet">${escapeHtml(a.snippet)}</div>` : ''}
      </div>
    </div>`).join('');

  list.querySelectorAll('.news-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      const any = list.querySelectorAll('.news-cb:checked').length > 0;
      document.getElementById('newsSummarizeBtn').disabled = !any;
    });
  });
}

function formatNewsDate(pubDate) {
  try { return new Date(pubDate).toLocaleDateString('zh-TW'); } catch (_) { return ''; }
}

async function summarizeSelected() {
  const checked = [...document.querySelectorAll('.news-cb:checked')];
  if (!checked.length) return;

  let geminiKey = '';
  try {
    const doc = await db.collection('portalConfig').doc('newsSettings').get();
    geminiKey = doc.exists ? (doc.data().geminiKey || '') : '';
  } catch (_) {}
  if (!geminiKey) { alert('請先至設定頁填入 Gemini API Key'); return; }

  const selected = checked.map(cb => newsArticles[parseInt(cb.dataset.index)]);

  const btn = document.getElementById('newsSummarizeBtn');
  btn.disabled = true; btn.textContent = '摘要中...';

  const articlesText = selected.map((a, i) =>
    `${i + 1}. 標題：${a.title}\n來源：${a.source}\n摘要：${a.snippet || '（無）'}`
  ).join('\n\n');

  const prompt = `請用繁體中文為以下 ${selected.length} 篇文章各提供 60-100 字的重點摘要。\n格式：\n1. 【文章標題】\n摘要：...\n\n2. ...\n\n---\n${articlesText}`;

  try {
    const res  = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    const json = await res.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text
      || (json.error ? `API 錯誤：${json.error.message}` : '（無回應）');

    const panel = document.getElementById('newsResultPanel');
    document.getElementById('newsResultBody').textContent = text;
    panel.classList.remove('hidden');
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    alert('Gemini API 呼叫失敗：' + e.message);
  }

  btn.disabled = false; btn.textContent = 'Gemini 摘要';
}

async function triggerNewsFetch() {
  let githubToken = '', githubRepo = '';
  try {
    const doc = await db.collection('portalConfig').doc('newsSettings').get();
    if (doc.exists) { githubToken = doc.data().githubToken || ''; githubRepo = doc.data().githubRepo || ''; }
  } catch (_) {}
  if (!githubToken || !githubRepo) { alert('請先至設定頁填入 GitHub Token 和 Repo'); return; }

  const btn = document.getElementById('newsTriggerBtn');
  btn.disabled = true; btn.textContent = '觸發中...';

  try {
    const res = await fetch(
      `https://api.github.com/repos/${githubRepo}/actions/workflows/fetch-news.yml/dispatches`,
      {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept':        'application/vnd.github+json',
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({ ref: 'main' }),
      }
    );
    if (res.status === 204) {
      alert('✓ 已觸發更新，約 1-2 分鐘後重新整理頁面查看結果');
    } else {
      const err = await res.json().catch(() => ({}));
      alert('觸發失敗：' + (err.message || `HTTP ${res.status}`));
    }
  } catch (e) {
    alert('網路錯誤：' + e.message);
  }

  btn.disabled = false; btn.textContent = '↻ 立即更新';
}

document.addEventListener('DOMContentLoaded', initPortal);
