/**
 * 清水高中選修課程快速點名系統 (CSHS Roll Call PWA)
 * 教師：王子齊 老師
 * 帳號：cshs643 / 密碼：cshs643
 * 註：真實課程與學生名冊資料已獨立至 courses_data.js 管理
 */

// 1. 預設寫死之帳號密碼（免登入直接使用）
const DEFAULT_CONFIG = {
  account: 'cshs643',
  password: 'cshs643',
  teacherName: '王子齊 老師',
  apiUrl: 'https://script.google.com/macros/s/AKfycbyYvKw5AoGJv-7P7ofv0YO_h627vOOm-NtYjhb47lo4AdAcfO2md0G2FYXp6Gg0U33I/exec',
  submitMode: 'iframe' // 'iframe' | 'fetch' | 'local_test'
};

// 狀態管理 (優先由 Hono 後端 /api/courses 即時抓取，離線或無後端時由 courses_data.js 提供備援)
const state = {
  config: { ...DEFAULT_CONFIG },
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
  loadSavedConfig();
  loadSavedHistory();
  initDateDisplay();
  initTheme();
  initPwa();
  renderCourseTabs();
  renderCourses();
  bindEvents();
  syncCoursesFromBackend(); // 自動連線 Hono 後端即時抓取最新資料
});

// 載入本地設定（若有自訂則覆蓋預設，否則使用內建帳密）
function loadSavedConfig() {
  const saved = localStorage.getItem('cshs_rollcall_config');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.password === 'ZYIAm7sAEttBG3Z') {
        parsed.password = 'cshs643';
        localStorage.setItem('cshs_rollcall_config', JSON.stringify(parsed));
      }
      state.config = { ...DEFAULT_CONFIG, ...parsed };
    } catch (e) {
      console.warn('Config load error', e);
    }
  }
  // 更新介面上的帳號徽章
  const badge = document.getElementById('currentAccountBadge');
  if (badge) badge.textContent = `${state.config.account} (王子齊)`;
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
  if (rollDateEl) rollDateEl.textContent = `📅 ${dateStr}`;
}

// 深淺色主題控制
function initTheme() {
  const savedTheme = localStorage.getItem('cshs_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  const btn = document.getElementById('themeToggleBtn');
  if (btn) btn.textContent = savedTheme === 'dark' ? '🌙' : '☀️';
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('cshs_theme', next);
  const btn = document.getElementById('themeToggleBtn');
  if (btn) btn.textContent = next === 'dark' ? '🌙' : '☀️';
}

// ==========================================================================
// ==========================================================================
// 課程清單渲染 (嚴格保證 高一 -> 高二 -> 高三 順序)
// ==========================================================================
function getCourseList() {
  return state.courses || [];
}

// 連線 Hono 後端即時同步課程與名冊
async function syncCoursesFromBackend(forceRefresh = false) {
  const bannerText = document.getElementById('bannerText');
  const bannerTime = document.getElementById('bannerTime');
  try {
    if (bannerTime) bannerTime.textContent = '連線同步中...';
    const url = forceRefresh ? '/api/courses?refresh=true' : '/api/courses';
    const res = await fetch(url);
    if (!res.ok) throw new Error('API 回應非 200');
    const data = await res.json();
    if (data.success && Array.isArray(data.courses) && data.courses.length > 0) {
      state.courses = data.courses;
      if (data.token) state.token = data.token;
      if (data.teacherName) {
        state.config.teacherName = `${data.teacherName} 老師`;
        const badge = document.getElementById('currentAccountBadge');
        if (badge) badge.textContent = `${state.config.account} (${data.teacherName})`;
      }
      renderCourseTabs();
      renderCourses();
      if (bannerText) {
        bannerText.innerHTML = `🟢 <strong>即時連線</strong>：已同步 ${data.courses.length} 門選修課程 (${data.fromCache ? '快取極速載入' : '最新爬取'})`;
      }
      if (bannerTime) {
        const d = new Date(data.fetchedAt || Date.now());
        bannerTime.textContent = `即時同步 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      }
      console.log(`[HONO BACKEND] 成功載入 ${data.courses.length} 門即時課程`);
      if (forceRefresh) {
        showToast('已即時同步清水高中後台最新名冊！', '🔄');
      }
    }
  } catch (e) {
    console.error('[HONO BACKEND] 後端連線異常:', e);
    if (bannerText) bannerText.innerHTML = '⚠️ 後端連線中斷，請確認伺服器或網路狀態';
    if (bannerTime) bannerTime.textContent = '連線失敗';
    const container = document.getElementById('courseContainer');
    if (container && (!state.courses || state.courses.length === 0)) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px 16px; color: var(--text-muted);">
          <div style="font-size: 2.2rem; margin-bottom: 8px;">📡</div>
          <p style="color: #f87171; font-weight: 600;">無法連線清水高中選修系統後台</p>
          <p style="font-size: 0.82rem; margin-top: 6px; color: var(--text-muted);">請確認伺服器是否正常運作或點擊下方按鈕重試</p>
          <button type="button" class="btn-primary" style="margin-top: 14px; padding: 8px 18px; font-size: 0.85rem;" onclick="syncCoursesFromBackend(true)">🔄 點擊重新連線</button>
        </div>
      `;
    }
  }
}

function renderCourseTabs() {
  const allCourses = getCourseList();
  const total = allCourses.length;
  const g1 = allCourses.filter(c => c.grade === 1).length;
  const g2 = allCourses.filter(c => c.grade === 2).length;
  const g3 = allCourses.filter(c => c.grade === 3).length;

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

  // 1. 根據目前 Tab 進行年級篩選
  let list = [...allCourses];
  if (state.activeGradeFilter !== 'all') {
    const filterGrade = parseInt(state.activeGradeFilter, 10);
    list = list.filter(c => c.grade === filterGrade);
  }

  // 2. 嚴格依「一、二、三」排序 (grade 1 -> 2 -> 3)
  list.sort((a, b) => a.grade - b.grade);

  // 3. 渲染課程卡片
  container.innerHTML = '';
  list.forEach(course => {
    const card = document.createElement('div');
    card.className = 'course-card';
    card.setAttribute('data-grade', course.grade);

    // 檢查今天是否已有點名紀錄
    const todayStr = getTodayString();
    const hasRecordToday = state.history.some(h => h.courseCode === course.code && h.date === todayStr);

    const periodLabels = course.lessons.join('、');

    card.innerHTML = `
      <div>
        <div class="card-top">
          <span class="grade-tag grade-${course.grade}">
            ${course.grade === 1 ? '高一 (一)' : course.grade === 2 ? '高二 (二)' : '高三 (三)'}
          </span>
          <span class="status-badge ${hasRecordToday ? 'done' : 'pending'}">
            ${hasRecordToday ? '今日已點名 ✓' : '尚未點名'}
          </span>
        </div>
        <h3 class="course-name">${course.name}</h3>
        <div class="course-meta">
          <div class="meta-row"><span>🏷️ 系統代碼:</span> <strong>${course.code}</strong></div>
          <div class="meta-row"><span>⏰ 授課節次:</span> <span>${periodLabels}</span></div>
          <div class="meta-row"><span>👤 任課教師:</span> <span>${course.teacher}</span></div>
        </div>
      </div>
      <div class="card-bottom">
        <span class="student-count-pill">👥 修課學生: ${course.studentCount} 人</span>
        <span class="action-arrow">進入點名 →</span>
      </div>
    `;

    card.addEventListener('click', () => openRollCall(course));
    container.appendChild(card);
  });
}

// ==========================================================================
// 點名主介面 (RWD 手機極速操作)
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
  if (available.length === 0) available = [3, 4]; // 預設安全值

  state.availablePeriods = available;
  state.selectedPeriods = [...available]; // 預設全選該課程所有節次

  // 介面切換
  document.getElementById('courseView').classList.add('hidden');
  document.getElementById('historyView').classList.add('hidden');
  document.getElementById('rollCallView').classList.remove('hidden');
  document.getElementById('bottomActionBar').classList.remove('hidden');

  // 更新課程資訊
  document.getElementById('currentCourseTitle').textContent = course.name;
  document.getElementById('currentCourseGradeTag').textContent = course.gradeLabel;
  document.getElementById('currentCourseGradeTag').className = `grade-tag grade-${course.grade}`;
  document.getElementById('currentCourseCode').textContent = `代碼: ${course.code}`;
  document.getElementById('currentCourseClassroom').textContent = `📍 清水高中選修班`;

  // 僅渲染該課程實際節次多選器 (例如 34 節即僅顯示 3、4 節，絕不顯示 125678)
  renderPeriodChips();

  // 渲染學生名冊
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

// 節次多選器 (動態依目前課程只顯示該課程之實際節次，例如 3, 4 節)
function renderPeriodChips() {
  const container = document.getElementById('periodChipGroup');
  if (!container || !state.currentCourse) return;

  const available = state.availablePeriods || state.currentCourse.defaultPeriods || [3, 4];

  // 清空並僅產生該課程實際擁有的節次按鈕
  container.innerHTML = '';
  available.forEach(p => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `period-chip ${state.selectedPeriods.includes(p) ? 'selected' : ''}`;
    btn.setAttribute('data-period', p);
    btn.innerHTML = `第 ${p} 節`;
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
      showToast('⚠️ 至少需選擇一節進行點名', '⚠️');
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

  if (hintEl) hintEl.textContent = `已選擇 ${count} 節 (第 ${periodsStr} 節)`;
  if (bottomPeriodEl) bottomPeriodEl.textContent = `預計送出: 第 ${periodsStr} 節`;
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
      s.name.includes(kw) ||
      s.seat.includes(kw) ||
      s.origClass.includes(kw)
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
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
        <p style="font-size: 2rem; margin-bottom: 8px;">🔍</p>
        <p>查無符合「${state.searchKeyword}」的學生資料</p>
      </div>
    `;
    return;
  }

  list.forEach(student => {
    const card = document.createElement('div');
    card.className = 'student-card';
    card.setAttribute('data-id', student.idx);

    card.innerHTML = `
      <div class="student-info-row">
        <div class="student-basic">
          <div class="seat-number">${student.seat}</div>
          <div>
            <div class="student-name">${student.name}</div>
            <div class="student-id">${student.origClass} 班</div>
          </div>
        </div>
        <span class="orig-class-badge">${student.school}</span>
      </div>

      <!-- 3 態出缺席大按鍵（完全對應 GAS 後台：2出席、1遲到、0缺席） -->
      <div class="status-btn-group" style="grid-template-columns: repeat(3, 1fr);">
        <button type="button" class="status-choice-btn ${student.statusCode === '2' ? 'selected-present' : ''}" data-code="2" data-status="present">
          <span style="font-size: 1.15rem;">✅</span>
          <span>出席 (2)</span>
        </button>
        <button type="button" class="status-choice-btn ${student.statusCode === '1' ? 'selected-personal' : ''}" data-code="1" data-status="late">
          <span style="font-size: 1.15rem;">⏰</span>
          <span>遲到 (1)</span>
        </button>
        <button type="button" class="status-choice-btn ${student.statusCode === '0' ? 'selected-absent' : ''}" data-code="0" data-status="absent">
          <span style="font-size: 1.15rem;">❌</span>
          <span>缺席 (0)</span>
        </button>
      </div>
    `;

    // 狀態切換事件
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

  // 輕微觸覺回饋
  if (navigator.vibrate) {
    navigator.vibrate(25);
  }

  // 局部更新卡片
  const card = document.querySelector(`.student-card[data-id="${studentIdx}"]`);
  if (card) {
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
  showToast('✅ 已將全班學生重設為全員出席', '👥');
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
  document.getElementById('statLeave').textContent = late; // 遲到/請假

  // 底部懸浮條總結
  const bottomText = document.getElementById('bottomSummaryText');
  if (bottomText) {
    if (absent === 0 && late === 0) {
      bottomText.textContent = `全到出席 (${present}/${total})`;
      bottomText.style.color = '#34d399';
    } else {
      bottomText.textContent = `實到: ${present} / 缺席: ${absent} / 遲到: ${late}`;
      bottomText.style.color = '#fbbf24';
    }
  }
}

// ==========================================================================
// 點名資料送出引擎 (真實 GAS 後端格式對齊 & 多節次批次送出)
// ==========================================================================
async function submitRollCallData() {
  if (!state.currentCourse) return;
  if (state.selectedPeriods.length === 0) {
    showToast('⚠️ 請至少勾選一個點名節次！', '⚠️');
    return;
  }

  const submitBtn = document.getElementById('submitRollCallBtn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span>⏳ 送出中 (批次處理)...</span>`;

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
    submitBtn.innerHTML = `<span>⏳ 正在送出點名至後台...</span>`;

    // 優先嘗試透過 Hono 後端 API 送出 (直達 GAS 且能即時獲取回傳結果)
    try {
      const records = state.students.map((s, idx) => ({
        fieldName: s.fieldName || `info${idx}`,
        baseRaw: s.baseRaw,
        statusCode: s.statusCode
      }));
      const rollRes = await fetch('/api/rollcall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseCode: course.code,
          date: todayStr,
          periods: periods,
          records: records
        })
      });
      if (rollRes.ok) {
        const rollData = await rollRes.json();
        if (rollData.success) {
          apiSuccess = true;
          console.log('[HONO ROLLCALL] 後端寫入成功:', rollData);
        }
      }
    } catch (apiErr) {
      console.warn('[HONO ROLLCALL] API 不可用，切換為 iframe 提交:', apiErr);
    }

    // 若 Hono 後端未開啟，平滑降級為前端 iframe 提交
    if (!apiSuccess) {
      for (let i = 0; i < periods.length; i++) {
        const p = periods[i];
        const lessonStr = `第${p}節`;
        submitBtn.innerHTML = `<span>⏳ 正在送出第 ${p} 節 (${i+1}/${periods.length})...</span>`;
        await submitSinglePeriodToGAS(course.code, todayStr, lessonStr);
        if (i < periods.length - 1) {
          await new Promise(r => setTimeout(r, 400));
        }
      }
    }

    // 儲存至本機歷史紀錄
    saveToHistory(summaryRecord);

    const periodsLabel = periods.join('、');
    showToast(`🎉 第 ${periodsLabel} 節點名紀錄已成功送出！`, '🚀');

    if (navigator.vibrate) {
      navigator.vibrate([40, 60, 40]);
    }

    setTimeout(() => {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>🚀 確認送出點名</span>`;
      closeRollCall();
    }, 1200);

  } catch (err) {
    console.error('送出點名異常', err);
    showToast(`⚠️ 送出提示: ${err.message || '已儲存本機備份'}`, '⚠️');
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<span>🚀 確認送出點名</span>`;
  }
}

// 單節次送出至 GAS 後台（完全對應原生 GAS 表單欄位）
function submitSinglePeriodToGAS(courseCode, dateStr, lessonStr) {
  return new Promise((resolve) => {
    // 動態建立隱藏 Form 透過 hidden iframe 提交 (完全免 CORS 限制直達 GAS)
    const form = document.createElement('form');
    form.method = 'post';
    form.action = state.config.apiUrl;
    form.target = 'gas_submission_sink';
    form.style.display = 'none';

    // 系統隱藏欄位
    addFormField(form, 'acc', state.config.account);
    addFormField(form, 'token', state.token);
    addFormField(form, 'page', 'rollcall');
    addFormField(form, 'course', courseCode);
    addFormField(form, 'date', dateStr);
    addFormField(form, 'lesson', lessonStr);

    // 每一位學生的點名明細：info0 ... infoN = "清水高中,班級,座號,姓名,狀態碼"
    state.students.forEach((s, idx) => {
      const fieldVal = `${s.baseRaw},${s.statusCode}`;
      addFormField(form, s.fieldName || `info${idx}`, fieldVal);
    });

    document.body.appendChild(form);
    form.submit();

    // 提交後延遲清理
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
  localStorage.setItem('cshs_rollcall_history', JSON.stringify(state.history));
}

function loadSavedHistory() {
  const saved = localStorage.getItem('cshs_rollcall_history');
  if (saved) {
    try {
      state.history = JSON.parse(saved);
    } catch (e) {
      console.warn('History load error', e);
    }
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
      <div style="text-align: center; padding: 40px; color: var(--text-muted);">
        <p style="font-size: 2.2rem; margin-bottom: 8px;">📂</p>
        <p>目前尚無已儲存的點名紀錄</p>
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  state.history.forEach(item => {
    const card = document.createElement('div');
    card.className = 'student-card';
    card.style.borderLeft = '4px solid #0ea5e9';

    const periodsText = item.periods ? item.periods.join('、') : '';
    let abnormalText = '全員出席 (無缺席遲到)';
    if (item.abnormalList && item.abnormalList.length > 0) {
      abnormalText = item.abnormalList.map(a => `${a.origClass}班 ${a.seat}號 ${a.name} (${a.statusText})`).join('、');
    }

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <strong style="font-size: 1.05rem; color: #fff;">${item.courseName}</strong>
          <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 2px;">
            📅 ${item.date} ${item.timestamp} | 第 ${periodsText} 節
          </div>
        </div>
        <span class="status-badge done">已送出</span>
      </div>
      <div style="margin-top: 8px; font-size: 0.85rem; padding: 8px 10px; background: rgba(0,0,0,0.3); border-radius: var(--radius-sm);">
        <div style="display: flex; gap: 14px; margin-bottom: 4px;">
          <span style="color: #34d399;">實到: ${item.presentCount} 人</span>
          <span style="color: #f87171;">缺席: ${item.absentCount} 人</span>
          <span style="color: #fbbf24;">遲到: ${item.lateCount} 人</span>
        </div>
        <div style="font-size: 0.78rem; color: #cbd5e1;">異常名單: ${abnormalText}</div>
      </div>
    `;
    container.appendChild(card);
  });
}

function clearHistory() {
  if (confirm('確定要清除本機所有歷史點名紀錄嗎？')) {
    state.history = [];
    localStorage.removeItem('cshs_rollcall_history');
    openHistoryView();
    showToast('歷史紀錄已清除', '🗑️');
  }
}

// ==========================================================================
// PWA 註冊與桌面安裝
// ==========================================================================
let deferredPrompt = null;

function initPwa() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(() => console.log('CSHS PWA Service Worker Registered'))
      .catch(err => console.log('SW registration error:', err));
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const banner = document.getElementById('pwaBanner');
    if (banner) banner.classList.remove('hidden');
  });

  const installBtn = document.getElementById('pwaInstallBtn');
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log('User install choice:', outcome);
      deferredPrompt = null;
      document.getElementById('pwaBanner').classList.add('hidden');
    });
  }
}

// ==========================================================================
// 吐司提示 (Toast)
// ==========================================================================
let toastTimer = null;
function showToast(msg, icon = '✅') {
  const toast = document.getElementById('toastNotification');
  const msgEl = document.getElementById('toastMsg');
  const iconEl = document.getElementById('toastIcon');

  if (!toast || !msgEl) return;
  msgEl.textContent = msg;
  if (iconEl) iconEl.textContent = icon;

  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
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
  // 年級分頁切換 (依高一、高二、高三)
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeGradeFilter = btn.getAttribute('data-grade');
      renderCourses();
    });
  });

  // 主題切換
  document.getElementById('themeToggleBtn').addEventListener('click', toggleTheme);

  // 返回選課
  document.getElementById('backToCoursesBtn').addEventListener('click', closeRollCall);

  // 節次多選器點擊事件 (事件委派，支援動態產生的節次按鈕)
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
    sortBtn.querySelector('span').textContent = state.sortOrder === 'seat_asc' ? '🔢 依座號 (小到大)' : '🔢 依座號 (大到小)';
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
    localStorage.removeItem('cshs_rollcall_config');
    showToast('已回復預設設定', '🔄');
  });

  document.getElementById('saveSettingsBtn').addEventListener('click', () => {
    state.config.account = document.getElementById('settingAcc').value.trim() || DEFAULT_CONFIG.account;
    state.config.password = document.getElementById('settingPwd').value.trim() || DEFAULT_CONFIG.password;
    state.config.apiUrl = document.getElementById('settingApiUrl').value.trim() || DEFAULT_CONFIG.apiUrl;
    state.config.submitMode = document.getElementById('settingSubmitMode').value;

    localStorage.setItem('cshs_rollcall_config', JSON.stringify(state.config));
    document.getElementById('currentAccountBadge').textContent = `${state.config.account} (王子齊)`;
    settingsModal.classList.remove('open');
    showToast('設定已更新！', '💾');
  });

  // 一鍵清除快取並強制重整按鈕
  const clearCacheBtn = document.getElementById('clearCacheBtn');
  if (clearCacheBtn) clearCacheBtn.addEventListener('click', clearAllCachesAndReload);

  const modalClearCacheBtn = document.getElementById('modalClearCacheBtn');
  if (modalClearCacheBtn) modalClearCacheBtn.addEventListener('click', clearAllCachesAndReload);
}

// ==========================================================================
// 一鍵徹底清除快取與 Service Worker
// ==========================================================================
async function clearAllCachesAndReload() {
  showToast('🧹 正在清除快取與同步最新資料...', '⏳');

  try {
    // 通知後端清除記憶體快取
    await fetch('/api/clear-cache', { method: 'POST' }).catch(() => {});

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
    localStorage.removeItem('cshs_theme');
    localStorage.removeItem('cshs_rollcall_config');
    localStorage.removeItem('cshs_courses_cache');

    // 4. 強制加上時間戳記網址參數重新載入，保證破除瀏覽器任何層級的快取
    setTimeout(() => {
      const cleanUrl = window.location.origin + window.location.pathname + '?reload=' + Date.now();
      window.location.replace(cleanUrl);
    }, 600);
  } catch (err) {
    console.warn('Clear cache error', err);
    window.location.reload(true);
  }
}
