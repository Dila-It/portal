// Settings page logic

const THEME_ACCENTS = [
  { name: 'Indigo', value: '#6366F1' },
  { name: 'Blue',   value: '#3B82F6' },
  { name: 'Teal',   value: '#14B8A6' },
  { name: 'Rose',   value: '#F43F5E' },
  { name: 'Amber',  value: '#F59E0B' },
];

const SYSTEM_DEFS = [
  {
    id:    'zhihui-todo',
    name:  '智慧待辦',
    icon:  '✦',
    color: 'linear-gradient(135deg, #4f8ef7, #7c3aed)',
    fields: [
      { key: 'guestEmail',       label: '訪客帳號',    type: 'email',  hint: '訪客示範用帳號',          default: 'guest@itcai.com' },
      { key: 'guestSeedVersion', label: '訪客資料版本', type: 'number', hint: '更新版本號重置示範資料',  default: 3 },
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
  await Promise.all([loadPortalThemeSettings(), loadAnnouncementSettings(), loadSystemSettings(), loadBulletinSettings()]);
}

// ── Portal Theme ─────────────────────────────────────────────

async function loadPortalThemeSettings() {
  let theme = {};
  try {
    const doc = await db.collection('portalConfig').doc('portalTheme').get();
    if (doc.exists) theme = doc.data();
  } catch (_) {}

  const wrap = document.getElementById('portalThemeContainer');
  wrap.innerHTML = buildThemePickerHtml('portal-theme', theme);
  initSwatches(wrap);

  wrap.querySelector('#savePortalThemeBtn').addEventListener('click', savePortalTheme);
}

async function savePortalTheme() {
  const btn    = document.getElementById('savePortalThemeBtn');
  const wrap   = document.getElementById('portalThemeContainer');
  const mode   = wrap.querySelector('.theme-mode-select').value;
  const accent = getSelectedAccent(wrap);
  btn.disabled = true; btn.textContent = '儲存中...';
  try {
    await db.collection('portalConfig').doc('portalTheme').set({ mode, accent });
    applyTheme({ mode, accent });
    showToast('✓ Portal 主題已儲存', 'success');
  } catch (_) { showToast('儲存失敗', 'error'); }
  btn.disabled = false; btn.textContent = '儲存主題';
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
    initSwatches(card);
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
            value="${cfg[f.key] !== undefined ? cfg[f.key] : (f.default !== undefined ? f.default : '')}">
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
      <div style="margin-top:4px;padding-top:14px;border-top:1px solid var(--border)">
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em">UI 主題</div>
        ${buildThemePickerHtml('sys-theme-' + sys.id, cfg.theme || {})}
      </div>
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

  const mode   = card.querySelector('.theme-mode-select')?.value || 'dark';
  const accent = getSelectedAccent(card);
  data.theme = { mode, accent };

  try {
    await db.collection('portalConfig').doc('systems').collection('items').doc(sysId).set(data);
    showToast('✓ 設定已儲存', 'success');
  } catch (e) {
    showToast('儲存失敗', 'error');
  }

  btn.disabled    = false;
  btn.textContent = '儲存設定';
}

// ── Bulletin Board ───────────────────────────────────────────

let bulletinItems = [];

async function loadBulletinSettings() {
  try {
    const snap = await db.collection('portalConfig').doc('bulletinBoard')
      .collection('items').orderBy('pinned', 'desc').orderBy('createdAt', 'desc').get();
    bulletinItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (_) {
    bulletinItems = [];
  }
  renderBulletinMgmt();
  document.getElementById('addBulletinBtn').addEventListener('click', addBulletin);
}

function renderBulletinMgmt() {
  const list = document.getElementById('bulletinMgmtList');
  if (!bulletinItems.length) {
    list.innerHTML = '<div style="color:var(--text-muted);font-size:13px">尚無公告，請從下方新增</div>';
    return;
  }
  list.innerHTML = bulletinItems.map(item => {
    const date = item.createdAt?.toDate
      ? item.createdAt.toDate().toLocaleDateString('zh-TW')
      : '';
    return `
      <div class="bulletin-mgmt-item">
        <div style="flex:1;min-width:0">
          <div class="b-title">${escapeHtml(item.title)}${item.pinned ? ' 📌' : ''}</div>
          ${item.content ? `<div class="b-date" style="margin-top:4px">${escapeHtml(item.content.slice(0, 60))}${item.content.length > 60 ? '…' : ''}</div>` : ''}
          ${date ? `<div class="b-date">${date}</div>` : ''}
        </div>
        <div class="b-actions">
          <button class="btn-icon${item.pinned ? ' active' : ''}" title="${item.pinned ? '取消置頂' : '置頂'}"
            onclick="togglePin('${item.id}')">📌</button>
          <button class="btn-icon del" title="刪除"
            onclick="deleteBulletin('${item.id}')">✕</button>
        </div>
      </div>`;
  }).join('');
}

async function addBulletin() {
  const title   = document.getElementById('newBulletinTitle').value.trim();
  const content = document.getElementById('newBulletinContent').value.trim();
  const pinned  = document.getElementById('newBulletinPin').checked;
  if (!title) { showToast('請輸入標題', 'error'); return; }

  const btn = document.getElementById('addBulletinBtn');
  btn.disabled = true; btn.textContent = '新增中...';
  try {
    await db.collection('portalConfig').doc('bulletinBoard').collection('items').add({
      title, content, pinned,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    document.getElementById('newBulletinTitle').value   = '';
    document.getElementById('newBulletinContent').value = '';
    document.getElementById('newBulletinPin').checked   = false;
    showToast('✓ 公告已新增', 'success');
    await loadBulletinSettings();
  } catch (_) {
    showToast('新增失敗', 'error');
  }
  btn.disabled = false; btn.textContent = '新增公告';
}

async function togglePin(id) {
  const item = bulletinItems.find(i => i.id === id);
  if (!item) return;
  try {
    await db.collection('portalConfig').doc('bulletinBoard').collection('items')
      .doc(id).update({ pinned: !item.pinned });
    showToast('✓ 已更新', 'success');
    await loadBulletinSettings();
  } catch (_) { showToast('操作失敗', 'error'); }
}

async function deleteBulletin(id) {
  if (!confirm('確定刪除這則公告？')) return;
  try {
    await db.collection('portalConfig').doc('bulletinBoard').collection('items').doc(id).delete();
    showToast('✓ 已刪除', 'success');
    await loadBulletinSettings();
  } catch (_) { showToast('刪除失敗', 'error'); }
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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

// ── Theme Helpers ─────────────────────────────────────────────

function buildThemePickerHtml(id, theme = {}) {
  const currentMode   = theme.mode   || 'dark';
  const currentAccent = (theme.accent || '#4f8ef7').toLowerCase();
  const isCustom = !THEME_ACCENTS.some(a => a.value.toLowerCase() === currentAccent);

  const swatchesHtml = THEME_ACCENTS.map(a =>
    `<button type="button" class="swatch${a.value.toLowerCase() === currentAccent ? ' selected' : ''}"
      data-accent="${a.value}" style="background:${a.value}" title="${a.name}"></button>`
  ).join('');

  return `
    <div class="settings-row">
      <div class="settings-label">模式<small>套用至此系統</small></div>
      <select class="theme-mode-select" style="flex:1;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px 12px;color:var(--text);font-size:13px;outline:none;">
        <option value="dark"          ${currentMode === 'dark'          ? 'selected' : ''}>🌙 深色</option>
        <option value="light"         ${currentMode === 'light'         ? 'selected' : ''}>☀️ 淺色</option>
        <option value="system"        ${currentMode === 'system'        ? 'selected' : ''}>🖥 跟隨系統</option>
        <option value="high-contrast" ${currentMode === 'high-contrast' ? 'selected' : ''}>♿ 高對比</option>
      </select>
    </div>
    <div class="settings-row">
      <div class="settings-label">主題色</div>
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <div class="theme-swatches">${swatchesHtml}</div>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-muted);cursor:pointer">
          自訂
          <input type="color" class="custom-accent-picker"
            value="${isCustom ? currentAccent : '#6366f1'}"
            style="width:28px;height:28px;border:none;border-radius:50%;cursor:pointer;padding:0;background:none;">
        </label>
      </div>
    </div>
    ${id === 'portal-theme' ? '<div class="settings-actions"><button class="btn btn-primary" id="savePortalThemeBtn">儲存主題</button></div>' : ''}
  `;
}

function initSwatches(container) {
  container.querySelectorAll('.swatch').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.theme-swatches').querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });
  container.querySelectorAll('.custom-accent-picker').forEach(picker => {
    picker.addEventListener('input', () => {
      picker.closest('.settings-row').querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
    });
  });
}

function getSelectedAccent(container) {
  const selected = container.querySelector('.swatch.selected');
  if (selected) return selected.dataset.accent;
  const picker = container.querySelector('.custom-accent-picker');
  return picker ? picker.value : '#6366F1';
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

document.addEventListener('DOMContentLoaded', initSettings);
