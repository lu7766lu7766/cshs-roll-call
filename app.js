/**
 * 清水高中選修課程快速點名系統 (CSHS Roll Call PWA)
 * 教師：王子齊 老師
 * 帳號：cshs643 / 密碼：cshs643
 */

const COURSES_CACHE_KEY = 'cshs_courses_cache';
const COURSES_CACHE_VERSION = 1;
const MAX_ERROR_ENTRIES = 5;

// 常駐錯誤面板狀態（在 DOMContentLoaded 前即可累積早期錯誤）
const errorEntries = [];
let errorSeq = 0;

// ==========================================================================
// 全域錯誤攔截（必須在最上方註冊，早於 DOMContentLoaded）
// ==========================================================================
window.addEventListener('error', (event) => {
  if (!event) return;
  if (!event.error && !event.message) return;

  const baseErr = event.error instanceof Error
    ? event.error
    : new Error(event.message || '未預期執行期錯誤');

  const wrapped = new Error(baseErr.message || String(event.message || '未預期執行期錯誤'));
  wrapped.name = baseErr.name || 'Error';
  if (event.filename) {
    const line = event.lineno || 0;
    const col = event.colno || 0;
    wrapped.location = `${event.filename}:${line}:${col}`;
  }
  reportError('程式發生未預期錯誤', wrapped, 'error');
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event && event.reason !== undefined ? event.reason : '未知的非同步拒絕 (Promise rejection)';
  reportError('未處理的非同步錯誤', reason, 'error');
});

// 1. 預設寫死之帳號密碼（免登入直接使用）
const DEFAULT_CONFIG = {
  account: 'cshs643',
  password: 'cshs643',
  teacherName: '王子齊 老師',
  apiUrl: 'https://script.google.com/macros/s/AKfycbyYvKw5AoGJv-7P7ofv0YO_h627vOOm-NtYjhb47lo4AdAcfO2md0G2FYXp6Gg0U33I/exec',
  submitMode: 'iframe' // 'iframe' | 'fetch' | 'local_test'
};

// 狀態管理
const state = {
  config: { ...DEFAULT_CONFIG },
  teacherName: null,
  cacheSavedAt: null,
  hasLoadedFromCache: false,
  activeGradeFilter: 'all',
  currentCourse: null,
  token: 'UA8ZqVRdZMrYyk6Gg35oikDZ9qSSGX8m', // 會話憑證，即時同步時會動態更新
  availablePeriods: [3, 4], // 目前課程實際擁有的課堂節次
  selectedPeriods: [3, 4], // 預設節次 (進入課程後會自動對應)
  courses: [],
  students: [],
  history: [],
  searchKeyword: '',
  sortOrder: 'seat_asc'
};

// ==========================================================================
// 初始化與 DOM 綁定
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  renderErrorPanel();
  try {
    loadSavedConfig();
    loadSavedHistory();
    initDateDisplay();
    initTheme();
    initPwa();
    loadCachedCourses();
    renderCourseTabs();
    renderCourses();
    bindEvents();
    syncCoursesFromBackend(); // 背景向 Hono 後端檢查並同步最新資料
  } catch (e) {
    reportError('頁面初始化失敗', e, 'error');
  }
});

// HTML 跳脫工具函式（防止 XSS 與破版）
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 格式化時間為 HH:MM:SS（供錯誤面板使用）
function formatTimeHHMMSS(dateInput = new Date()) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '--:--:--';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

// 格式化錯誤詳細內容（不附長 stack，包含 Error name/message、HTTP status、後端 detail、檔案行號）
function formatErrorDetail(err) {
  if (err === null || err === undefined) return '未知錯誤';
  if (typeof err === 'string') return err;

  if (err instanceof Error || (typeof err === 'object' && ('message' in err || 'name' in err))) {
    const name = err.name || 'Error';
    const msg = err.message ? String(err.message) : '發生未知錯誤';
    const parts = [`${name}: ${msg}`];

    if (err.status !== undefined && err.status !== null && err.status !== '') {
      const statusStr = `HTTP ${err.status}`;
      if (!msg.includes(statusStr)) {
        parts.push(statusStr);
      }
    }

    if (typeof err.detail === 'string' && err.detail.trim()) {
      const detailTrimmed = err.detail.trim();
      if (!msg.includes(detailTrimmed)) {
        parts.push(detailTrimmed);
      }
    }

    if (typeof err.location === 'string' && err.location.trim()) {
      parts.push(err.location.trim());
    }

    return parts.join('\n');
  }

  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

// 前台常駐錯誤回報 API
function reportError(title, err, level = 'error') {
  const normalizedLevel = level === 'warning' ? 'warning' : 'error';
  if (normalizedLevel === 'warning') {
    console.warn(title, err);
  } else {
    console.error(title, err);
  }

  const safeTitle = String(title || '系統發生錯誤');
  const detail = formatErrorDetail(err);
  const nowStr = formatTimeHHMMSS();

  const existingIdx = errorEntries.findIndex(
    item => item.title === safeTitle && item.detail === detail
  );

  if (existingIdx > -1) {
    const existing = errorEntries.splice(existingIdx, 1)[0];
    existing.count += 1;
    existing.time = nowStr;
    existing.level = normalizedLevel;
    errorEntries.unshift(existing);
  } else {
    errorSeq += 1;
    errorEntries.unshift({
      id: `err-${Date.now()}-${errorSeq}`,
      title: safeTitle,
      detail,
      level: normalizedLevel,
      time: nowStr,
      count: 1
    });
    if (errorEntries.length > MAX_ERROR_ENTRIES) {
      errorEntries.length = MAX_ERROR_ENTRIES;
    }
  }

  renderErrorPanel();
}

// 渲染常駐錯誤面板
function renderErrorPanel() {
  const panel = document.getElementById('errorPanel');
  if (!panel) return;

  if (errorEntries.length === 0) {
    panel.classList.add('hidden');
    panel.innerHTML = '';
    return;
  }

  panel.classList.remove('hidden');

  let html = '';
  if (errorEntries.length > 1) {
    html += `
      <div class="error-panel-toolbar">
        <button type="button" class="error-dismiss-all-btn" id="dismissAllErrorsBtn">全部關閉</button>
      </div>
    `;
  }

  errorEntries.forEach(entry => {
    const levelClass = entry.level === 'warning' ? 'is-warning' : 'is-error';
    const countBadge = entry.count > 1
      ? `<span class="error-card-count">×${escapeHtml(entry.count)}</span>`
      : '';

    html += `
      <div class="error-card ${levelClass}" data-error-id="${escapeHtml(entry.id)}">
        <div class="error-card-header">
          <div class="error-card-title">${escapeHtml(entry.title)}</div>
          <div class="error-card-meta">
            <span>${escapeHtml(entry.time)}</span>
            ${countBadge}
          </div>
        </div>
        <pre class="error-card-detail">${escapeHtml(entry.detail)}</pre>
        <div class="error-card-actions">
          <button type="button" class="error-action-btn error-btn-copy" data-action="copy" data-error-id="${escapeHtml(entry.id)}">複製</button>
          <button type="button" class="error-action-btn error-btn-close" data-action="close" data-error-id="${escapeHtml(entry.id)}">關閉</button>
        </div>
      </div>
    `;
  });

  panel.innerHTML = html;

  const dismissAllBtn = document.getElementById('dismissAllErrorsBtn');
  if (dismissAllBtn) {
    dismissAllBtn.addEventListener('click', () => {
      errorEntries.length = 0;
      renderErrorPanel();
    });
  }

  panel.querySelectorAll('.error-action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.getAttribute('data-action');
      const errId = btn.getAttribute('data-error-id');
      const targetIdx = errorEntries.findIndex(item => item.id === errId);
      if (targetIdx === -1) return;

      if (action === 'close') {
        errorEntries.splice(targetIdx, 1);
        renderErrorPanel();
      } else if (action === 'copy') {
        copyErrorToClipboard(errorEntries[targetIdx]);
      }
    });
  });
}

// 複製錯誤資訊至剪貼簿（含 navigator.clipboard 與 textarea fallback）
async function copyErrorToClipboard(entry) {
  if (!entry) return;
  const countSuffix = entry.count > 1 ? ` (×${entry.count})` : '';
  const ua = typeof navigator !== 'undefined' && navigator.userAgent ? navigator.userAgent : 'unknown';
  const textToCopy = [
    `[${entry.level === 'warning' ? '警告' : '錯誤'}] ${entry.title}${countSuffix}`,
    `時間: ${entry.time}`,
    `內容: ${entry.detail}`,
    `User-Agent: ${ua}`
  ].join('\n');

  let copied = false;
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(textToCopy);
      copied = true;
    } catch {
      copied = false;
    }
  }

  if (!copied) {
    try {
      const ta = document.createElement('textarea');
      ta.value = textToCopy;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-9999px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, textToCopy.length);
      copied = document.execCommand('copy');
      document.body.removeChild(ta);
    } catch (copyErr) {
      reportError('複製錯誤內容失敗', copyErr, 'warning');
      return;
    }
  }

  if (copied) {
    showToast('已複製錯誤內容');
  }
}

// 統一 JSON Fetch 工具（非 2xx 或 JSON 解析失敗皆拋出含 status 與 detail 的 Error）
async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const rawText = await res.text();
  let parsed = null;
  let parseErr = null;

  if (rawText) {
    try {
      parsed = JSON.parse(rawText);
    } catch (e) {
      parseErr = e;
    }
  }

  if (!res.ok) {
    const backendError = parsed && typeof parsed === 'object' && parsed.error
      ? String(parsed.error)
      : '';
    const snippet = rawText ? rawText.slice(0, 300).trim() : '';
    const detail = backendError || snippet || `HTTP ${res.status} ${res.statusText || ''}`.trim();
    const err = new Error(detail || `HTTP ${res.status} 請求失敗`);
    err.status = res.status;
    err.detail = detail;
    err.body = parsed; // 保留後端回應內容（例如 /api/rollcall 的各節 results）
    throw err;
  }

  if (parseErr || !parsed || typeof parsed !== 'object') {
    const snippet = rawText ? rawText.slice(0, 300).trim() : '(空回應)';
    const reason = parseErr ? parseErr.message : '回應格式非有效 JSON 物件';
    const err = new Error(`JSON 解析失敗：${reason}`);
    err.status = res.status;
    err.detail = snippet;
    throw err;
  }

  return parsed;
}

// 驗證並回傳合法 ISO 時間字串（若無效則退回現在時間）
function resolveValidIsoTimestamp(candidate) {
  if (typeof candidate === 'string' && candidate.trim()) {
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) {
      return candidate.trim();
    }
  }
  return new Date().toISOString();
}

// 共用：更新教師名稱與頂部帳號徽章
function applyTeacherName(name) {
  const cleanName = name ? String(name).replace(/\s*老師$/, '').trim() : '';
  if (cleanName) {
    state.teacherName = cleanName;
    state.config.teacherName = `${cleanName} 老師`;
  }
  const fallbackName = String(state.config.teacherName || DEFAULT_CONFIG.teacherName)
    .replace(/\s*老師$/, '')
    .trim() || '王子齊';
  const displayTeacher = state.teacherName || fallbackName;
  const badge = document.getElementById('currentAccountBadge');
  if (badge) {
    badge.textContent = `${state.config.account} (${displayTeacher})`;
  }
}

// 格式化時間為 HH:MM
function formatTimeHHMM(dateInput) {
  if (!dateInput) return '';
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

// 更新同步狀態列（透過狀態 class 控制樣式，不使用 emoji 或 inline 顏色）
function setBannerStatus(mode, text, timeText) {
  const banner = document.getElementById('statusBanner');
  const bannerText = document.getElementById('bannerText');
  const bannerTime = document.getElementById('bannerTime');

  if (banner) {
    banner.classList.remove('is-syncing', 'is-ok', 'is-cached', 'is-error');
    if (mode) {
      banner.classList.add(`is-${mode}`);
    }
  }
  if (bannerText && typeof text === 'string') {
    bannerText.textContent = text;
  }
  if (bannerTime && typeof timeText === 'string') {
    bannerTime.textContent = timeText;
  }
}

// 載入本地設定（若有自訂則覆蓋預設，否則使用內建帳密）
function loadSavedConfig() {
  try {
    const saved = localStorage.getItem('cshs_rollcall_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        if (parsed.password === 'ZYIAm7sAEttBG3Z') {
          parsed.password = 'cshs643';
          try {
            localStorage.setItem('cshs_rollcall_config', JSON.stringify(parsed));
          } catch (err) {
            reportError('本機儲存失敗：無法更新系統設定', err, 'warning');
          }
        }
        state.config = { ...DEFAULT_CONFIG, ...parsed };
      }
    }
  } catch (e) {
    reportError('本機儲存失敗：無法讀取系統設定', e, 'warning');
  }
  applyTeacherName(state.config.teacherName);
}

// 讀取本機快取名冊 (stale-while-revalidate)
function loadCachedCourses() {
  try {
    const raw = localStorage.getItem(COURSES_CACHE_KEY);
    if (!raw) return false;

    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      parsed.version !== COURSES_CACHE_VERSION ||
      !Array.isArray(parsed.courses) ||
      parsed.courses.length === 0
    ) {
      try {
        localStorage.removeItem(COURSES_CACHE_KEY);
      } catch (removeErr) {
        reportError('本機儲存失敗：無法移除無效的名冊快取', removeErr, 'warning');
      }
      return false;
    }

    state.courses = parsed.courses;
    if (parsed.token) {
      state.token = parsed.token;
    }
    state.teacherName = typeof parsed.teacherName === 'string' && parsed.teacherName.trim()
      ? parsed.teacherName.replace(/\s*老師$/, '').trim()
      : null;
    state.cacheSavedAt = typeof parsed.savedAt === 'string' ? parsed.savedAt : null;
    state.hasLoadedFromCache = true;

    if (state.teacherName) {
      applyTeacherName(state.teacherName);
    }

    const lastTime = formatTimeHHMM(state.cacheSavedAt) || '--:--';
    setBannerStatus(
      'cached',
      `已載入本機名冊（${state.courses.length} 門課程），背景檢查更新中…`,
      lastTime
    );
    return true;
  } catch (e) {
    reportError('本機名冊快取損毀，已清除並重新同步', e, 'warning');
    try {
      localStorage.removeItem(COURSES_CACHE_KEY);
    } catch (removeErr) {
      reportError('本機儲存失敗：無法移除損毀的名冊快取', removeErr, 'warning');
    }
    return false;
  }
}

// 寫入本機快取名冊
function saveCoursesCache(courses, teacherName, token, savedAt = new Date().toISOString()) {
  try {
    const cleanTeacher = teacherName ? String(teacherName).replace(/\s*老師$/, '').trim() : null;
    const payload = {
      version: COURSES_CACHE_VERSION,
      savedAt,
      teacherName: cleanTeacher || null,
      token: token || null,
      courses
    };
    localStorage.setItem(COURSES_CACHE_KEY, JSON.stringify(payload));
    state.cacheSavedAt = savedAt;
  } catch (e) {
    reportError('本機儲存失敗：課程名冊快取未保存', e, 'warning');
  }
}

// 計算名冊內容簽章（不含 token、fetchedAt、fromCache、cacheAgeSec、stale）
function getCoursesSignature(teacherName, courses) {
  const cleanTeacher = teacherName ? String(teacherName).replace(/\s*老師$/, '').trim() : null;
  return JSON.stringify({
    teacherName: cleanTeacher || null,
    courses: Array.isArray(courses) ? courses : []
  });
}

// 計算單一課程學生名單簽章（比對每位學生的 fieldName + baseRaw）
function getStudentRosterSignature(students) {
  if (!Array.isArray(students)) return '';
  return JSON.stringify(
    students.map((s, idx) => ({
      fieldName: s.fieldName || `info${idx}`,
      baseRaw: s.baseRaw || ''
    }))
  );
}

// 日期與星期計算 (對齊後台 chineseDay / javaDay 邏輯)
function initDateDisplay() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const date = String(now.getDate()).padStart(2, '0');
  const dayIndex = now.getDay();
  const chineseDays = ['日', '一', '二', '三', '四', '五', '六'];
  const dayStr = `週${chineseDays[dayIndex]}`;

  const dateStr = `${year}/${month}/${date} (${dayStr})`;
  const el = document.getElementById('currentDateDisplay');
  if (el) el.textContent = dateStr;

  const rollDateEl = document.getElementById('currentRollCallDate');
  if (rollDateEl) rollDateEl.textContent = dateStr;
}

// 主題控制 (固定深色模式)
function initTheme() {
  document.documentElement.setAttribute('data-theme', 'dark');
  try {
    localStorage.setItem('cshs_theme', 'dark');
  } catch (e) {
    console.warn('Theme storage error', e);
  }
}

// ==========================================================================
// 課程清單渲染與後端同步
// ==========================================================================
function getCourseList() {
  return state.courses || [];
}

// 同步請求序號：回應只有比「已套用的資料」更新時才更新畫面與快取，避免較舊的回應覆蓋較新的
let syncSeq = 0;
let appliedSyncSeq = 0;

// 連線 Hono 後端即時同步課程與名冊 (stale-while-revalidate)
async function syncCoursesFromBackend(forceRefresh = false) {
  const seq = ++syncSeq;
  const hadCourses = Array.isArray(state.courses) && state.courses.length > 0;
  const wasLoadedFromCache = Boolean(state.hasLoadedFromCache || hadCourses);

  if (!hadCourses) {
    setBannerStatus('syncing', '正在連線後台同步課程與名冊…', '同步中');
    const container = document.getElementById('courseContainer');
    if (container && !document.getElementById('courseLoadingIndicator')) {
      container.innerHTML = `
        <div id="courseLoadingIndicator" class="empty-state">
          <div class="spinner" aria-hidden="true"></div>
          <p class="empty-state-title">正在連線清水高中後台同步課程與名冊…</p>
          <span class="empty-state-sub">初次連線約需 3–5 秒，完成後將自動快取於本機</span>
        </div>
      `;
    }
  } else if (forceRefresh) {
    const lastTime = formatTimeHHMM(state.cacheSavedAt) || '同步中';
    setBannerStatus('syncing', '正在重新同步最新名冊…', lastTime);
  }

  try {
    const url = forceRefresh ? '/api/courses?refresh=true' : '/api/courses';
    const data = await fetchJson(url);
    if (!data.success || !Array.isArray(data.courses) || data.courses.length === 0) {
      const err = new Error(data.error || '無有效課程資料');
      if (data.error) err.detail = String(data.error);
      throw err;
    }

    if (seq < appliedSyncSeq) return; // 已套用較新的同步結果
    appliedSyncSeq = seq;

    const incomingTeacher = data.teacherName
      ? String(data.teacherName).replace(/\s*老師$/, '').trim()
      : (state.teacherName || null);

    const prevSig = hadCourses ? getCoursesSignature(state.teacherName, state.courses) : null;
    const nextSig = getCoursesSignature(incomingTeacher, data.courses);
    const hasChanged = !hadCourses || prevSig !== nextSig;

    // token 一律更新為最新值（token 變動不算名冊異動）
    if (data.token) {
      state.token = data.token;
    }

    // 時間來源統一：savedAt 優先使用合法的 data.fetchedAt，否則用現在時間
    const savedAt = resolveValidIsoTimestamp(data.fetchedAt);
    const syncTimeStr = formatTimeHHMM(savedAt);

    // 若後端回傳 stale: true，狀態列顯示 cached 狀態與對應提示
    const isStale = Boolean(data.stale);
    const bannerMode = isStale ? 'cached' : 'ok';
    const bannerMsg = isStale ? '後台暫時無法更新，顯示最近一次名冊' : '名冊已是最新';

    if (hasChanged) {
      // 檢查使用者是否正在點名畫面中
      const rollCallView = document.getElementById('rollCallView');
      const isInRollCall = Boolean(
        rollCallView &&
        !rollCallView.classList.contains('hidden') &&
        state.currentCourse
      );

      let currentCourseMissing = false;
      let currentCourseRosterChanged = false;
      if (isInRollCall) {
        const updatedCourse = data.courses.find(c => c.code === state.currentCourse.code);
        if (!updatedCourse) {
          currentCourseMissing = true;
        } else if (
          getStudentRosterSignature(state.currentCourse.students) !== getStudentRosterSignature(updatedCourse.students)
        ) {
          currentCourseRosterChanged = true;
        }
      }

      state.courses = data.courses;
      state.teacherName = incomingTeacher;
      if (incomingTeacher) {
        applyTeacherName(incomingTeacher);
      }

      saveCoursesCache(state.courses, state.teacherName, state.token, savedAt);
      renderCourseTabs();
      renderCourses();

      setBannerStatus(bannerMode, bannerMsg, syncTimeStr);

      if (isInRollCall && currentCourseMissing) {
        showToast('此課程已不在最新名冊中，請確認後再送出');
      } else if (isInRollCall && currentCourseRosterChanged) {
        showToast('此課程名冊已更新，返回後重新進入即可套用');
      } else if (forceRefresh) {
        showToast('已即時同步最新名冊');
      } else if (wasLoadedFromCache) {
        showToast('名冊已有異動，已自動更新');
      }
    } else {
      // 無異動：只寫回最新 token 與時間，不重繪課程清單
      saveCoursesCache(state.courses, state.teacherName, state.token, savedAt);
      setBannerStatus(bannerMode, bannerMsg, syncTimeStr);

      if (forceRefresh) {
        showToast('已即時同步最新名冊');
      }
    }
  } catch (e) {
    reportError('無法同步課程名冊', e, 'error');
    // 已有較新的同步成功套用，畫面維持最新資料
    if (seq < appliedSyncSeq) return;

    if (state.courses && state.courses.length > 0) {
      const lastTime = formatTimeHHMM(state.cacheSavedAt) || '--:--';
      setBannerStatus(
        'error',
        `無法連線後台，顯示本機名冊（上次同步 ${lastTime}）`,
        lastTime
      );
      if (forceRefresh) {
        showToast('無法連線後台，目前顯示本機名冊');
      }
      return;
    }

    setBannerStatus('error', '無法連線清水高中選修系統後台', '連線失敗');
    const container = document.getElementById('courseContainer');
    if (container) {
      const safeErrorDetail = escapeHtml(formatErrorDetail(e));
      container.innerHTML = `
        <div class="empty-state is-error">
          <p class="empty-state-title">無法連線清水高中選修系統後台</p>
          <p class="empty-state-sub">請確認伺服器是否正常運作或網路狀態，再點擊下方按鈕重試</p>
          <code class="empty-state-code">${safeErrorDetail}</code>
          <button type="button" class="btn-primary empty-state-action" id="retrySyncBtn">重新連線</button>
        </div>
      `;
      const retryBtn = document.getElementById('retrySyncBtn');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => syncCoursesFromBackend(true));
      }
    }
  }
}

function renderCourseTabs() {
  const allCourses = getCourseList();
  const total = allCourses.length;
  const g1 = allCourses.filter(c => (c.weekday === 1 || c.grade === 1)).length;
  const g2 = allCourses.filter(c => (c.weekday === 2 || c.grade === 2)).length;
  const g3 = allCourses.filter(c => (c.weekday === 3 || c.grade === 3)).length;

  const bAll = document.getElementById('badgeAll');
  const bG1 = document.getElementById('badgeGrade1');
  const bG2 = document.getElementById('badgeGrade2');
  const bG3 = document.getElementById('badgeGrade3');

  if (bAll) bAll.textContent = total;
  if (bG1) bG1.textContent = g1;
  if (bG2) bG2.textContent = g2;
  if (bG3) bG3.textContent = g3;
}

function renderCourses() {
  const container = document.getElementById('courseContainer');
  if (!container) return;

  const allCourses = getCourseList();
  // 尚未載入任何課程時保留載入指示器或錯誤狀態
  if (allCourses.length === 0) {
    return;
  }

  // 1. 根據目前 Tab 進行上課星期篩選
  let list = [...allCourses];
  if (state.activeGradeFilter !== 'all') {
    const filterDay = parseInt(state.activeGradeFilter, 10);
    list = list.filter(c => (c.weekday === filterDay || c.grade === filterDay));
  }

  // 2. 嚴格依「週一 (1) ➔ 週二 (2) ➔ 週三 (3)」排序
  list.sort((a, b) => {
    const wa = a.weekday ?? a.grade ?? 0;
    const wb = b.weekday ?? b.grade ?? 0;
    return wa - wb;
  });

  // 3. 渲染課程卡片
  container.innerHTML = '';

  if (list.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p class="empty-state-title">此星期目前無選修課程</p>
      </div>
    `;
    return;
  }

  const todayStr = getTodayString();
  const weekdayMap = { 1: '週一', 2: '週二', 3: '週三', 4: '週四', 5: '週五' };

  list.forEach(course => {
    const dayNum = course.weekday || course.grade || 1;
    const card = document.createElement('div');
    card.className = 'course-card';
    card.setAttribute('data-grade', dayNum);
    card.setAttribute('data-weekday', dayNum);
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', String(course.name ?? ''));

    const todayRecords = state.history.filter(h => h.courseCode === course.code && h.date === todayStr);
    const hasRecordToday = todayRecords.length > 0;
    // 舊紀錄沒有 deliveryMode，視為已確認
    const hasConfirmedToday = todayRecords.some(h => h.deliveryMode !== 'fallback');
    const badgeClass = !hasRecordToday ? 'pending' : (hasConfirmedToday ? 'done' : 'unconfirmed');
    const badgeText = !hasRecordToday ? '未點名' : (hasConfirmedToday ? '已點名' : '已點名・待確認');
    const wShort = weekdayMap[dayNum] || `週${dayNum}`;

    let periodText = '';
    if (Array.isArray(course.defaultPeriods) && course.defaultPeriods.length > 0) {
      periodText = `第 ${course.defaultPeriods.join('、')} 節`;
    } else if (Array.isArray(course.lessons) && course.lessons.length > 0) {
      periodText = course.lessons.join('、');
    } else {
      periodText = '第 3、4 節';
    }

    const safeDayNum = escapeHtml(dayNum);
    const safeWShort = escapeHtml(wShort);
    const safeName = escapeHtml(course.name);
    const safeCode = escapeHtml(course.code);
    const safePeriodText = escapeHtml(periodText);
    const safeTeacher = escapeHtml(course.teacher);
    const safeStudentCount = escapeHtml(course.studentCount);

    card.innerHTML = `
      <div>
        <div class="card-top">
          <span class="grade-tag grade-${safeDayNum}">${safeWShort}</span>
          <span class="status-badge ${badgeClass}">${badgeText}</span>
        </div>
        <h3 class="course-name">${safeName}</h3>
        <div class="course-meta">
          <span>代碼 ${safeCode}</span>
          <span class="meta-sep">·</span>
          <span>${safePeriodText}</span>
          <span class="meta-sep">·</span>
          <span>${safeTeacher}</span>
        </div>
      </div>
      <div class="card-bottom">
        <span class="student-count-pill">修課 ${safeStudentCount} 人</span>
        <span class="action-arrow">點名 →</span>
      </div>
    `;

    card.addEventListener('click', () => openRollCall(course));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        if (e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
        }
        openRollCall(course);
      }
    });
    container.appendChild(card);
  });
}

// ==========================================================================
// 點名主介面 (手機單手操作最佳化)
// ==========================================================================
function openRollCall(course) {
  state.currentCourse = course;
  state.students = JSON.parse(JSON.stringify(course.students));

  // 取得該課程實際授課之節次 (例如 [3, 4] 或 [6, 7])
  let available = (course.defaultPeriods && course.defaultPeriods.length > 0) ? [...course.defaultPeriods] : [];
  if (available.length === 0 && course.tag) {
    const nums = course.tag.match(/\d/g);
    if (nums) available = nums.map(n => parseInt(n, 10));
  }
  if (available.length === 0) available = [3, 4];

  state.availablePeriods = available;
  state.selectedPeriods = [...available];

  // 介面切換
  document.getElementById('courseView').classList.add('hidden');
  document.getElementById('historyView').classList.add('hidden');
  document.getElementById('rollCallView').classList.remove('hidden');
  document.getElementById('bottomActionBar').classList.remove('hidden');

  // 更新課程資訊
  const dayNum = course.weekday || course.grade || 1;
  const weekdayChar = course.weekdayChar || ['一', '二', '三', '四', '五'][dayNum - 1] || '一';
  document.getElementById('currentCourseTitle').textContent = course.name;
  document.getElementById('currentCourseGradeTag').textContent = course.weekdayLabel || `週${weekdayChar}選修`;
  document.getElementById('currentCourseGradeTag').className = `grade-tag grade-${dayNum}`;
  document.getElementById('currentCourseCode').textContent = `代碼 ${course.code}`;
  document.getElementById('currentCourseClassroom').textContent = '清水高中選修班';

  renderPeriodChips();
  renderStudentList();
  updateSummaryCounters();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function closeRollCall() {
  document.getElementById('rollCallView').classList.add('hidden');
  document.getElementById('bottomActionBar').classList.add('hidden');
  document.getElementById('courseView').classList.remove('hidden');
  renderCourses(); // 刷新點名狀態徽章
}

// 節次多選器
function renderPeriodChips() {
  const container = document.getElementById('periodChipGroup');
  if (!container || !state.currentCourse) return;

  const available = state.availablePeriods || state.currentCourse.defaultPeriods || [3, 4];

  container.innerHTML = '';
  available.forEach(p => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `period-chip ${state.selectedPeriods.includes(p) ? 'selected' : ''}`;
    btn.setAttribute('data-period', p);
    btn.textContent = `第 ${p} 節`;
    container.appendChild(btn);
  });

  updatePeriodHint();
}

function togglePeriod(periodNum) {
  const idx = state.selectedPeriods.indexOf(periodNum);
  if (idx > -1) {
    if (state.selectedPeriods.length > 1) {
      state.selectedPeriods.splice(idx, 1);
    } else {
      showToast('至少需選擇一節進行點名');
      return;
    }
  } else {
    state.selectedPeriods.push(periodNum);
    state.selectedPeriods.sort((a, b) => a - b);
  }
  renderPeriodChips();
  updateSummaryCounters();
}

function updatePeriodHint() {
  const hintEl = document.getElementById('periodCountHint');
  const bottomPeriodEl = document.getElementById('bottomPeriodSummary');
  const count = state.selectedPeriods.length;
  const periodsStr = state.selectedPeriods.join('、');

  if (hintEl) hintEl.textContent = `已選擇 ${count} 節（第 ${periodsStr} 節）`;
  if (bottomPeriodEl) bottomPeriodEl.textContent = `預計送出：第 ${periodsStr} 節`;
}

// 依據 statusCode 取得卡片 data-status 標記
function getStatusNameFromCode(code) {
  if (code === '1') return 'late';
  if (code === '0') return 'absent';
  return 'present';
}

// 學生點名名冊渲染
function renderStudentList() {
  const container = document.getElementById('studentListContainer');
  if (!container) return;

  let list = [...state.students];

  // 關鍵字搜尋過濾
  if (state.searchKeyword) {
    const kw = state.searchKeyword.toLowerCase().trim();
    list = list.filter(s =>
      s.name.toLowerCase().includes(kw) ||
      s.seat.toLowerCase().includes(kw) ||
      s.origClass.toLowerCase().includes(kw)
    );
  }

  // 排序
  if (state.sortOrder === 'seat_asc') {
    list.sort((a, b) => parseInt(a.seat, 10) - parseInt(b.seat, 10));
  } else if (state.sortOrder === 'seat_desc') {
    list.sort((a, b) => parseInt(b.seat, 10) - parseInt(a.seat, 10));
  }

  container.innerHTML = '';

  if (list.length === 0) {
    const safeKeyword = escapeHtml(state.searchKeyword);
    container.innerHTML = `
      <div class="empty-state">
        <p class="empty-state-title">查無符合「${safeKeyword}」的學生資料</p>
      </div>
    `;
    return;
  }

  list.forEach(student => {
    const card = document.createElement('div');
    card.className = 'student-card';
    card.setAttribute('data-id', student.idx);
    card.setAttribute('data-status', getStatusNameFromCode(student.statusCode));

    const safeSeat = escapeHtml(student.seat);
    const safeName = escapeHtml(student.name);
    const safeOrigClass = escapeHtml(student.origClass);
    const safeSchool = escapeHtml(student.school);

    card.innerHTML = `
      <div class="student-info-row">
        <div class="student-basic">
          <div class="seat-number">${safeSeat}</div>
          <div class="student-meta">
            <span class="student-name">${safeName}</span>
            <span class="student-id">${safeOrigClass} 班</span>
          </div>
        </div>
        <span class="orig-class-badge">${safeSchool}</span>
      </div>

      <div class="status-btn-group">
        <button type="button" class="status-choice-btn ${student.statusCode === '2' ? 'selected-present' : ''}" data-code="2" data-status="present">出席</button>
        <button type="button" class="status-choice-btn ${student.statusCode === '1' ? 'selected-personal' : ''}" data-code="1" data-status="late">遲到</button>
        <button type="button" class="status-choice-btn ${student.statusCode === '0' ? 'selected-absent' : ''}" data-code="0" data-status="absent">缺席</button>
      </div>
    `;

    const btns = card.querySelectorAll('.status-choice-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const newCode = btn.getAttribute('data-code');
        const newStatus = btn.getAttribute('data-status');
        setStudentStatus(student.idx, newCode, newStatus);
      });
    });

    container.appendChild(card);
  });
}

// 變更單一學生出缺席狀態
function setStudentStatus(studentIdx, newCode, newStatus) {
  const student = state.students.find(s => s.idx === studentIdx);
  if (!student) return;

  student.statusCode = newCode;
  student.status = newStatus;

  if (navigator.vibrate) {
    navigator.vibrate(25);
  }

  const card = document.querySelector(`.student-card[data-id="${studentIdx}"]`);
  if (card) {
    card.setAttribute('data-status', getStatusNameFromCode(newCode));
    const btns = card.querySelectorAll('.status-choice-btn');
    btns.forEach(b => {
      b.className = 'status-choice-btn';
      const code = b.getAttribute('data-code');
      if (code === newCode) {
        if (code === '2') b.classList.add('selected-present');
        else if (code === '1') b.classList.add('selected-personal');
        else if (code === '0') b.classList.add('selected-absent');
      }
    });
  }

  updateSummaryCounters();
}

// 一鍵全員出席 (全部設為 code 2)
function markAllPresent() {
  state.students.forEach(s => {
    s.statusCode = '2';
    s.status = 'present';
  });
  renderStudentList();
  updateSummaryCounters();
  showToast('已將全班重設為全員出席');
}

// 即時計算出缺席數據
function updateSummaryCounters() {
  const total = state.students.length;
  const present = state.students.filter(s => s.statusCode === '2').length;
  const late = state.students.filter(s => s.statusCode === '1').length;
  const absent = state.students.filter(s => s.statusCode === '0').length;

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statPresent').textContent = present;
  document.getElementById('statAbsent').textContent = absent;
  document.getElementById('statLeave').textContent = late;

  // 底部懸浮條總結（由 class 控制顏色，不使用 inline color）
  const bottomText = document.getElementById('bottomSummaryText');
  if (bottomText) {
    bottomText.classList.remove('is-all-present', 'is-has-issue');
    if (absent === 0 && late === 0) {
      bottomText.textContent = `全到出席 (${present}/${total})`;
      bottomText.classList.add('is-all-present');
    } else {
      bottomText.textContent = `出席 ${present} · 缺席 ${absent} · 遲到 ${late}`;
      bottomText.classList.add('is-has-issue');
    }
  }
}

// ==========================================================================
// 點名資料送出引擎 (真實 GAS 後端格式對齊 & 多節次批次送出)
// ==========================================================================
async function submitRollCallData() {
  if (!state.currentCourse) return;
  if (state.selectedPeriods.length === 0) {
    showToast('請至少勾選一個點名節次');
    return;
  }

  const submitBtn = document.getElementById('submitRollCallBtn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span>送出中（批次處理）…</span>';

  const course = state.currentCourse;
  const todayStr = getTodayString();
  const periods = [...state.selectedPeriods];

  // 取得缺席與遲到名單
  const abnormalStudents = state.students
    .filter(s => s.statusCode !== '2')
    .map(s => ({
      seat: s.seat,
      origClass: s.origClass,
      name: s.name,
      statusCode: s.statusCode,
      statusText: s.statusCode === '1' ? '遲到' : '缺席'
    }));

  const summaryRecord = {
    courseCode: course.code,
    courseName: course.name,
    date: todayStr,
    periods: periods,
    totalCount: state.students.length,
    presentCount: state.students.filter(s => s.statusCode === '2').length,
    lateCount: state.students.filter(s => s.statusCode === '1').length,
    absentCount: state.students.filter(s => s.statusCode === '0').length,
    abnormalList: abnormalStudents
  };

  try {
    let apiSuccess = false;
    // 後端已確認寫入的節次；其餘節次才需要走 iframe 備援，避免重複寫入
    let confirmedPeriods = [];
    submitBtn.innerHTML = '<span>正在送出點名至後台…</span>';

    // 優先嘗試透過 Hono 後端 API 送出
    try {
      const records = state.students.map((s, idx) => ({
        fieldName: s.fieldName || `info${idx}`,
        baseRaw: s.baseRaw,
        statusCode: s.statusCode
      }));
      const rollData = await fetchJson('/api/rollcall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseCode: course.code,
          date: todayStr,
          periods: periods,
          records: records
        })
      });
      if (!rollData.success) {
        const err = new Error(rollData.error || '後端回傳寫入失敗');
        if (rollData.error) err.detail = String(rollData.error);
        throw err;
      }
      apiSuccess = true;
      confirmedPeriods = [...periods];
    } catch (apiErr) {
      // 後端部分成功時（502 + results），只把失敗的節次交給備援
      const results = apiErr && apiErr.body && Array.isArray(apiErr.body.results) ? apiErr.body.results : [];
      confirmedPeriods = periods.filter(p => results.some(r => r && r.ok && Number(r.period) === p));
      reportError('後端送出失敗，已改用備援方式送出', apiErr, 'warning');
    }

    const fallbackPeriods = periods.filter(p => !confirmedPeriods.includes(p));

    // 若 Hono 後端未成功，平滑降級為前端 iframe 提交（僅送出未確認的節次）
    if (!apiSuccess) {
      for (let i = 0; i < fallbackPeriods.length; i++) {
        const p = fallbackPeriods[i];
        const lessonStr = `第${p}節`;
        submitBtn.innerHTML = `<span>正在送出第 ${escapeHtml(p)} 節 (${escapeHtml(i + 1)}/${escapeHtml(fallbackPeriods.length)})…</span>`;
        await submitSinglePeriodToGAS(course.code, todayStr, lessonStr);
        if (i < fallbackPeriods.length - 1) {
          await new Promise(r => setTimeout(r, 400));
        }
      }
    }

    summaryRecord.deliveryMode = fallbackPeriods.length > 0 ? 'fallback' : 'api';
    summaryRecord.confirmedPeriods = confirmedPeriods;
    summaryRecord.fallbackPeriods = fallbackPeriods;
    saveToHistory(summaryRecord);

    if (fallbackPeriods.length === 0) {
      showToast(`第 ${periods.join('、')} 節點名紀錄已成功送出`);
    } else if (confirmedPeriods.length > 0) {
      showToast(`第 ${confirmedPeriods.join('、')} 節已送出；第 ${fallbackPeriods.join('、')} 節改用備援送出，請至後台確認`);
    } else {
      showToast(`已用備援方式送出第 ${fallbackPeriods.join('、')} 節，請至後台確認是否寫入`);
    }

    if (navigator.vibrate) {
      navigator.vibrate([40, 60, 40]);
    }

    setTimeout(() => {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>送出點名</span>';
      closeRollCall();
    }, 1200);
  } catch (err) {
    reportError('送出點名失敗', err, 'error');
    showToast(`送出失敗：${err.message || '請檢查錯誤訊息'}`);
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span>送出點名</span>';
  }
}

// 單節次送出至 GAS 後台（完全對應原生 GAS 表單欄位）
function submitSinglePeriodToGAS(courseCode, dateStr, lessonStr) {
  return new Promise((resolve) => {
    const form = document.createElement('form');
    form.method = 'post';
    form.action = state.config.apiUrl;
    form.target = 'gas_submission_sink';
    form.className = 'hidden';

    addFormField(form, 'acc', state.config.account);
    addFormField(form, 'token', state.token);
    addFormField(form, 'page', 'rollcall');
    addFormField(form, 'course', courseCode);
    addFormField(form, 'date', dateStr);
    addFormField(form, 'lesson', lessonStr);

    state.students.forEach((s, idx) => {
      const fieldVal = `${s.baseRaw},${s.statusCode}`;
      addFormField(form, s.fieldName || `info${idx}`, fieldVal);
    });

    document.body.appendChild(form);
    form.submit();

    setTimeout(() => {
      document.body.removeChild(form);
      resolve();
    }, 600);
  });
}

function addFormField(form, name, value) {
  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = name;
  input.value = value;
  form.appendChild(input);
}

// ==========================================================================
// 歷史紀錄儲存與檢視
// ==========================================================================
function saveToHistory(record) {
  const historyItem = {
    id: Date.now().toString(),
    timestamp: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
    ...record
  };
  state.history.unshift(historyItem);
  if (state.history.length > 50) state.history.pop();
  try {
    localStorage.setItem('cshs_rollcall_history', JSON.stringify(state.history));
  } catch (e) {
    reportError('本機儲存失敗：點名歷史紀錄未保存', e, 'warning');
  }
}

function loadSavedHistory() {
  try {
    const saved = localStorage.getItem('cshs_rollcall_history');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        state.history = parsed;
      }
    }
  } catch (e) {
    reportError('本機儲存失敗：無法讀取點名歷史紀錄', e, 'warning');
  }
}

function openHistoryView() {
  document.getElementById('courseView').classList.add('hidden');
  document.getElementById('rollCallView').classList.add('hidden');
  document.getElementById('bottomActionBar').classList.add('hidden');
  document.getElementById('historyView').classList.remove('hidden');

  const container = document.getElementById('historyListContainer');
  if (!container) return;

  if (state.history.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p class="empty-state-title">目前尚無已儲存的點名紀錄</p>
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  state.history.forEach(item => {
    const card = document.createElement('div');
    card.className = 'history-card';

    const periodsText = item.periods ? item.periods.map(p => escapeHtml(p)).join('、') : '';
    let abnormalText = '全員出席（無缺席遲到）';
    if (item.abnormalList && item.abnormalList.length > 0) {
      abnormalText = item.abnormalList
        .map(a => `${escapeHtml(a.origClass)}班 ${escapeHtml(a.seat)}號 ${escapeHtml(a.name)}（${escapeHtml(a.statusText)}）`)
        .join('、');
    }

    const safeCourseName = escapeHtml(item.courseName);
    const safeDate = escapeHtml(item.date);
    const safeTimestamp = escapeHtml(item.timestamp);
    const safePresentCount = escapeHtml(item.presentCount);
    const safeAbsentCount = escapeHtml(item.absentCount);
    const safeLateCount = escapeHtml(item.lateCount);

    card.innerHTML = `
      <div class="history-card-top">
        <div>
          <div class="history-course-name">${safeCourseName}</div>
          <div class="history-meta">${safeDate} ${safeTimestamp} · 第 ${periodsText} 節</div>
        </div>
        ${item.deliveryMode === 'fallback'
          ? '<span class="status-badge unconfirmed">備援送出・待確認</span>'
          : '<span class="status-badge done">已送出</span>'}
      </div>
      <div class="history-stats-box">
        <div class="history-counts">
          <span class="count-ok">出席 ${safePresentCount} 人</span>
          <span class="count-bad">缺席 ${safeAbsentCount} 人</span>
          <span class="count-warn">遲到 ${safeLateCount} 人</span>
        </div>
        <div class="history-abnormal">異常名單：${abnormalText}</div>
      </div>
    `;
    container.appendChild(card);
  });
}

function clearHistory() {
  if (confirm('確定要清除本機所有歷史點名紀錄嗎？')) {
    state.history = [];
    try {
      localStorage.removeItem('cshs_rollcall_history');
    } catch (e) {
      reportError('本機儲存失敗：無法清除點名歷史紀錄', e, 'warning');
    }
    openHistoryView();
    showToast('歷史紀錄已清除');
  }
}

// ==========================================================================
// PWA 註冊
// ==========================================================================
function initPwa() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(() => console.log('CSHS PWA Service Worker Registered'))
      .catch(err => reportError('離線功能啟用失敗', err, 'warning'));
  }
}

// ==========================================================================
// 吐司提示 (Toast)
// ==========================================================================
let toastTimer = null;
function showToast(msg, icon = '') {
  const toast = document.getElementById('toastNotification');
  const msgEl = document.getElementById('toastMsg');
  const iconEl = document.getElementById('toastIcon');

  if (!toast || !msgEl) return;
  msgEl.textContent = msg;
  if (iconEl) iconEl.textContent = icon || '';

  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2600);
}

function getTodayString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ==========================================================================
// 事件綁定 (Event Listeners)
// ==========================================================================
function bindEvents() {
  // 星期分頁切換 (依週一、週二、週三)
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeGradeFilter = btn.getAttribute('data-weekday') || btn.getAttribute('data-grade');
      renderCourses();
    });
  });

  // 返回選課
  document.getElementById('backToCoursesBtn').addEventListener('click', closeRollCall);

  // 節次多選器點擊事件 (事件委派)
  const periodGroup = document.getElementById('periodChipGroup');
  if (periodGroup) {
    periodGroup.addEventListener('click', (e) => {
      const chip = e.target.closest('.period-chip');
      if (chip) {
        const p = parseInt(chip.getAttribute('data-period'), 10);
        togglePeriod(p);
      }
    });
  }

  // 一鍵全員出席
  document.getElementById('allPresentBtn').addEventListener('click', markAllPresent);

  // 學生搜尋
  const searchInput = document.getElementById('studentSearchInput');
  searchInput.addEventListener('input', (e) => {
    state.searchKeyword = e.target.value;
    renderStudentList();
  });

  // 依座號排序切換
  const sortBtn = document.getElementById('sortSeatBtn');
  sortBtn.addEventListener('click', () => {
    state.sortOrder = state.sortOrder === 'seat_asc' ? 'seat_desc' : 'seat_asc';
    const labelSpan = sortBtn.querySelector('span');
    if (labelSpan) {
      labelSpan.textContent = state.sortOrder === 'seat_asc' ? '座號 ↑' : '座號 ↓';
    }
    renderStudentList();
  });

  // 確認送出點名按鈕
  document.getElementById('submitRollCallBtn').addEventListener('click', submitRollCallData);

  // 歷史紀錄檢視
  document.getElementById('historyBtn').addEventListener('click', openHistoryView);
  document.getElementById('backFromHistoryBtn').addEventListener('click', () => {
    document.getElementById('historyView').classList.add('hidden');
    document.getElementById('courseView').classList.remove('hidden');
  });
  document.getElementById('clearHistoryBtn').addEventListener('click', clearHistory);

  // 設定 Modal
  const settingsModal = document.getElementById('settingsModal');
  document.getElementById('settingsBtn').addEventListener('click', () => {
    document.getElementById('settingAcc').value = state.config.account;
    document.getElementById('settingPwd').value = state.config.password;
    document.getElementById('settingApiUrl').value = state.config.apiUrl;
    document.getElementById('settingSubmitMode').value = state.config.submitMode;
    settingsModal.classList.add('open');
  });

  document.getElementById('closeSettingsBtn').addEventListener('click', () => {
    settingsModal.classList.remove('open');
  });

  document.getElementById('resetDefaultBtn').addEventListener('click', () => {
    state.config = { ...DEFAULT_CONFIG };
    document.getElementById('settingAcc').value = state.config.account;
    document.getElementById('settingPwd').value = state.config.password;
    document.getElementById('settingApiUrl').value = state.config.apiUrl;
    document.getElementById('settingSubmitMode').value = state.config.submitMode;
    try {
      localStorage.removeItem('cshs_rollcall_config');
    } catch (e) {
      reportError('本機儲存失敗：無法重設系統設定', e, 'warning');
    }
    applyTeacherName(state.teacherName || DEFAULT_CONFIG.teacherName);
    showToast('已回復預設設定');
  });

  document.getElementById('saveSettingsBtn').addEventListener('click', () => {
    state.config.account = document.getElementById('settingAcc').value.trim() || DEFAULT_CONFIG.account;
    state.config.password = document.getElementById('settingPwd').value.trim() || DEFAULT_CONFIG.password;
    state.config.apiUrl = document.getElementById('settingApiUrl').value.trim() || DEFAULT_CONFIG.apiUrl;
    state.config.submitMode = document.getElementById('settingSubmitMode').value;

    try {
      localStorage.setItem('cshs_rollcall_config', JSON.stringify(state.config));
    } catch (e) {
      reportError('本機儲存失敗：系統設定未保存', e, 'warning');
    }
    applyTeacherName(state.teacherName || state.config.teacherName);
    settingsModal.classList.remove('open');
    showToast('設定已更新');
  });

  // 立即重新同步名冊按鈕
  const modalResyncBtn = document.getElementById('modalResyncBtn');
  if (modalResyncBtn) {
    modalResyncBtn.addEventListener('click', () => {
      settingsModal.classList.remove('open');
      syncCoursesFromBackend(true);
    });
  }

  // 設定內一鍵清除快取並強制重整按鈕
  const modalClearCacheBtn = document.getElementById('modalClearCacheBtn');
  if (modalClearCacheBtn) {
    modalClearCacheBtn.addEventListener('click', clearAllCachesAndReload);
  }
}

// ==========================================================================
// 一鍵徹底清除快取與 Service Worker
// ==========================================================================
async function clearAllCachesAndReload() {
  showToast('正在清除快取與同步最新資料…');

  try {
    // 通知後端清除記憶體快取
    try {
      await fetchJson('/api/clear-cache', { method: 'POST' });
    } catch (clearApiErr) {
      reportError('後端快取清除失敗', clearApiErr, 'warning');
    }

    // 1. 註銷所有已註冊的 Service Worker
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }
    }

    // 2. 清除所有 Cache Storage 快取
    if ('caches' in window) {
      const keys = await caches.keys();
      for (const k of keys) {
        await caches.delete(k);
      }
    }

    // 3. 清理 LocalStorage 中的暫存
    try {
      localStorage.removeItem('cshs_theme');
      localStorage.removeItem('cshs_rollcall_config');
      localStorage.removeItem(COURSES_CACHE_KEY);
    } catch (storageErr) {
      reportError('本機儲存失敗：無法清除本機快取資料', storageErr, 'warning');
    }

    // 4. 強制加上時間戳記網址參數重新載入
    setTimeout(() => {
      const cleanUrl = window.location.origin + window.location.pathname + '?reload=' + Date.now();
      window.location.replace(cleanUrl);
    }, 600);
  } catch (err) {
    reportError('清除快取失敗', err, 'error');
  }
}
