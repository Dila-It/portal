// Settings page logic

const SYSTEM_DEFS = [
  {
    id:    'zhihui-todo',
    name:  '智慧待辦',
    icon:  '✦',
    color: 'linear-gradient(135deg, #4f8ef7, #7c3aed)',
    fields: [
      { key: 'guestEmail',       label: '訪客帳號',      type: 'email',  hint: '訪客示範用帳號' },
      { key: 'guestSeedVersion', label: '訪客資料版本',   type: 'number', hint: '更新版本號重置示範資料' },
    ],
    flags: [
      { key: 'pwa',           label: 'PWA 離線功能' },
      { key: 'audioAnalysis', label: '音檔分析功能' },
    ],
  },
];

let currentUser = null;

function initSettings() {
  initAuth({
    onLogin:  handleLogin,
    onLogout: () => { window.location.href = 'index.html'; },
  });

  document.getElementById('logoutBtn').addEventListener('click', () => signOut());
  document.getElementById('backBtn').addEventListener('click', () => { window.location.href = 'index.html'; });
}

async function handleLogin(user) {
  currentUser = user;
  document.getElementById('navUserEmail').textContent = user.email;
  document.getElementById('appShell').style.display   = 'block';
  await Promise.all([loadAnnouncementSettings(), loadSystemSettings()]);
}

// ── Announcement ────────────────────────────────────────────

async function loadAnnouncementSettings() {
  try {
    const doc  = await db.collection('portalConfig').doc('announcement').get();
    const data = doc.exists ? doc.data() : {};
    document.getElementById('annEnabled').checked   = !!data.enabled;
    document.getElementById('annText').value        = data.text || '';
    updateAnnPreview();
  } catch (_) {}

  document.getElementById('annEnabled').addEventListener('change', updateAnnPreview);
  document.getElementById('annText').addEventListener('input', updateAnnPreview);
  document.getElementById('saveAnnBtn').addEventListener('click', saveAnnouncement);
}

function updateAnnPreview() {
  const enabled = document.getElementById('annEnabled').checked;
  const text    = document.getElementById('annText').value.trim();
  const preview = document.getElementById('annPreview');
  if (enabled && text) {
    preview.textContent = '📢 ' + text;
    preview.classList.add('show');
  } else {
    preview.classList.remove('show');
  }
}

async function saveAnnouncement() {
  const btn  = document.getElementById('saveAnnBtn');
  const data = {
    enabled: document.getElementById('annEnabled').checked,
    text:    document.getElementById('annText').value.trim(),
  };
  btn.disabled    = true;
  btn.textContent = '儲存中...';
  try {
    await db.collection('portalConfig').doc('announcement').set(data);
    showToast('✓ 公告已儲存', 'success');
  } catch (e) {
    showToast('儲存失敗', 'error');
  }
  btn.disabled    = false;
  btn.textContent = '儲存公告';
}

// ── System Settings ─────────────────────────────────────────

async function loadSystemSettings() {
  const container = document.getElementById('systemsContainer');
  container.innerHTML = '';

  for (const sys of SYSTEM_DEFS) {
    let cfg = {};
    try {
      const doc = await db.collection('portalConfig').doc('systems').collection('items').doc(sys.id).get();
      if (doc.exists) cfg = doc.data();
    } catch (_) {}

    const card = buildSystemCard(sys, cfg);
    container.appendChild(card);
  }
}

function buildSystemCard(sys, cfg) {
  const flags = cfg.featureFlags || {};

  const card = document.createElement('div');
  card.className = 'settings-card';

  const statusOptions = ['online', 'maintenance', 'offline'];
  const statusLabels  = { online: '線上', maintenance: '維護中', offline: '離線' };
  const currentStatus = cfg.status || 'online';

  card.innerHTML = `
    <div class="settings-card-header">
      <div class="s-icon" style="background:${sys.color}">${sys.icon}</div>
      <div>
        <h3>${sys.name}</h3>
        <p>系統參數設定</p>
      </div>
    </div>
    <div class="settings-card-body">
      <div class="settings-row">
        <div class="settings-label">
          卡片狀態
          <small>顯示於入口卡片右上角</small>
        </div>
        <select class="sys-field" data-key="status" style="
          flex:1;background:var(--bg3);border:1px solid var(--border);
          border-radius:var(--radius-sm);padding:8px 12px;color:var(--text);
          font-size:13px;outline:none;">
          ${statusOptions.map(s => `<option value="${s}" ${s === currentStatus ? 'selected' : ''}>${statusLabels[s]}</option>`).join('')}
        </select>
      </div>
      ${sys.fields.map(f => `
        <div class="settings-row">
          <div class="settings-label">
            ${f.label}
            <small>${f.hint}</small>
          </div>
          <input type="${f.type}" class="sys-field" data-key="${f.key}"
            value="${cfg[f.key] !== undefined ? cfg[f.key] : ''}">
        </div>
      `).join('')}
      ${sys.flags.length ? `
        <div style="margin-top:4px;padding-top:14px;border-top:1px solid var(--border)">
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em">功能開關</div>
          ${sys.flags.map(fl => `
            <div class="settings-row">
              <div class="settings-label">${fl.label}</div>
              <label class="toggle">
                <input type="checkbox" class="sys-flag" data-key="${fl.key}" ${flags[fl.key] ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </div>
          `).join('')}
        </div>
      ` : ''}
      <div class="settings-actions">
        <button class="btn btn-primary save-sys-btn" data-id="${sys.id}">儲存設定</button>
      </div>
    </div>
  `;

  card.querySelector('.save-sys-btn').addEventListener('click', () => saveSystemConfig(sys.id, card));
  return card;
}

async function saveSystemConfig(sysId, card) {
  const btn = card.querySelector('.save-sys-btn');
  btn.disabled    = true;
  btn.textContent = '儲存中...';

  const data = {};

  card.querySelectorAll('.sys-field').forEach(el => {
    const key = el.dataset.key;
    if (el.tagName === 'SELECT') {
      data[key] = el.value;
    } else if (el.type === 'number') {
      data[key] = Number(el.value);
    } else {
      data[key] = el.value.trim();
    }
  });

  const featureFlags = {};
  card.querySelectorAll('.sys-flag').forEach(el => {
    featureFlags[el.dataset.key] = el.checked;
  });
  data.featureFlags = featureFlags;

  try {
    await db.collection('portalConfig').doc('systems').collection('items').doc(sysId).set(data);
    showToast('✓ 設定已儲存', 'success');
  } catch (e) {
    showToast('儲存失敗', 'error');
  }

  btn.disabled    = false;
  btn.textContent = '儲存設定';
}

// ── Toast ────────────────────────────────────────────────────

function showToast(msg, type = 'success') {
  const wrap  = document.getElementById('toastWrap');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  wrap.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

document.addEventListener('DOMContentLoaded', initSettings);
