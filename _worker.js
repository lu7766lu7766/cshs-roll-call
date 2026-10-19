import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

// 開啟 API 跨域支援
app.use('/api/*', cors());

const GAS_URL = 'https://script.google.com/macros/s/AKfycbyYvKw5AoGJv-7P7ofv0YO_h627vOOm-NtYjhb47lo4AdAcfO2md0G2FYXp6Gg0U33I/exec';

// 記憶體快取 (在 Cloudflare Worker 或 Node.js Process 中共用，10 分鐘 TTL)
let coursesCache = {
  data: null,
  token: null,
  timestamp: 0
};
const CACHE_TTL_MS = 10 * 60 * 1000;

// 工具函式：從 GAS 回應中解析出乾淨的 HTML 字串
function decodeGasResponse(htmlText) {
  const m = htmlText.match(/goog\.script\.init\("((?:\\x[0-9a-fA-F]{2}|[\s\S])*?)"\s*,\s*""/);
  if (!m) return '';
  const rawStr = m[1];
  const unescaped = rawStr.replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  return unescaped.replace(/\\+/g, '');
}

// 核心爬蟲函式：登入並即時抓取所有真實課程與學生名冊
async function crawlCourses(account = 'cshs643', password = 'cshs643') {
  console.log(`[CRAWLER] 正在爬取清水高中 GAS 後台資料 (帳號: ${account})...`);

  // 1. 登入取得首頁與會話 Token
  const loginBody = new URLSearchParams({
    method: 'write',
    acc: account,
    pwd: password
  });

  const loginRes = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: loginBody
  });
  const loginHtml = await loginRes.text();
  const cleanLogin = decodeGasResponse(loginHtml);

  // 解析 Token
  const tokenMatch = cleanLogin.match(/name="token"\s+value="([a-zA-Z0-9]+)"/);
  const token = tokenMatch ? tokenMatch[1] : '';

  // 解析任課教師
  const teacherMatch = cleanLogin.match(/登入帳號：(.*?)(?:<\/br>|<br>)/);
  const teacherName = teacherMatch ? teacherMatch[1].trim() : '教師';

  // 解析所有可選課程 (e.g. <input type="radio" name="course" value="b04" required>[二34] 進階程式設計</br>)
  const courseRegex = /<input\s+type="radio"\s+name="course"\s+value="(.*?)"[^>]*>(.*?)(?:<\/br>|<br>|<br\/>)/g;
  const courseMatches = [];
  let match;
  while ((match = courseRegex.exec(cleanLogin)) !== null) {
    courseMatches.push({
      code: match[1].trim(),
      rawLabel: match[2].trim()
    });
  }

  // 2. 依序抓取各門課程學生名單
  const courses = [];
  for (const item of courseMatches) {
    const postBody = new URLSearchParams({
      acc: account,
      token: token,
      page: 'attendence',
      course: item.code
    });

    const cRes = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: postBody
    });
    const cHtmlRaw = await cRes.text();
    const cleanC = decodeGasResponse(cHtmlRaw);

    // 解析課程標題與上課星期代碼 (例如 [一34] 為星期一，[二34] 為星期二，[三67] 為星期三)
    const titleMatch = cleanC.match(/課程名稱：\[(.*?)\]\s*(.*?)(?:<br>|<\/br>|<br\s*\/>|\n)/);
    const bracketTag = titleMatch ? titleMatch[1].trim() : '';
    const courseTitle = titleMatch ? titleMatch[2].trim() : item.rawLabel;

    let weekday = 1;
    let weekdayChar = '一';
    if (bracketTag.includes('一')) { weekday = 1; weekdayChar = '一'; }
    else if (bracketTag.includes('二')) { weekday = 2; weekdayChar = '二'; }
    else if (bracketTag.includes('三')) { weekday = 3; weekdayChar = '三'; }
    else if (bracketTag.includes('四')) { weekday = 4; weekdayChar = '四'; }
    else if (bracketTag.includes('五')) { weekday = 5; weekdayChar = '五'; }
    else if (bracketTag.includes('六')) { weekday = 6; weekdayChar = '六'; }
    else if (bracketTag.includes('日')) { weekday = 7; weekdayChar = '日'; }

    // 解析節次
    const lessonRegex = /<input\s+type="radio"\s+name="lesson"\s+value="(.*?)"/g;
    const lessons = [];
    const defaultPeriods = [];
    let lMatch;
    while ((lMatch = lessonRegex.exec(cleanC)) !== null) {
      lessons.push(lMatch[1]);
      const pNum = lMatch[1].match(/\d+/);
      if (pNum) defaultPeriods.push(parseInt(pNum[0], 10));
    }

    // 若 HTML 未包含 radio 節次，則自動從課名代碼標籤提取 (例如 [一34] -> 第3、4節，[三67] -> 第6、7節)
    if (defaultPeriods.length === 0 && bracketTag) {
      const nums = bracketTag.match(/\d/g);
      if (nums) {
        nums.forEach(n => {
          const val = parseInt(n, 10);
          defaultPeriods.push(val);
          lessons.push(`第${val}節`);
        });
      }
    }

    // 解析學生清單
    const rowRegex = /<tr[^>]*align="center"><td>(.*?)<\/td><td>(.*?)<\/td><td>(.*?)<\/td><td>(.*?)<\/td><td>(.*?)<\/td><\/tr>/g;
    const students = [];
    let rMatch;
    while ((rMatch = rowRegex.exec(cleanC)) !== null) {
      const school = rMatch[1].trim();
      const origClass = rMatch[2].trim();
      const seat = rMatch[3].trim().padStart(2, '0');
      const name = rMatch[4].trim();
      const radioTd = rMatch[5];

      if (school === '學校' || radioTd.includes('出席狀況')) continue; // 跳過表頭

      const fieldMatch = radioTd.match(/name="(info\d+)"/);
      const fieldName = fieldMatch ? fieldMatch[1] : `info${students.length}`;

      students.push({
        idx: students.length,
        fieldName: fieldName,
        school: school,
        origClass: origClass,
        seat: seat,
        name: name,
        status: 'present',
        statusCode: '2',
        baseRaw: `${school},${origClass},${rMatch[3].trim()},${name}`
      });
    }

    courses.push({
      id: `cshs-${item.code}`,
      code: item.code,
      weekday: weekday,
      weekdayChar: weekdayChar,
      weekdayLabel: `週${weekdayChar}選修`,
      grade: weekday, // 相容舊版欄位
      gradeLabel: `週${weekdayChar}選修`,
      tag: bracketTag,
      name: bracketTag ? `[${bracketTag}] ${courseTitle}` : courseTitle,
      shortName: courseTitle,
      teacher: `${teacherName} 老師`,
      lessons: lessons,
      defaultPeriods: defaultPeriods,
      studentCount: students.length,
      students: students
    });
  }

  // 3. 嚴格依「週一 (1) ➔ 週二 (2) ➔ 週三 (3)」順序排序
  courses.sort((a, b) => {
    const wa = a.weekday ?? a.grade ?? 0;
    const wb = b.weekday ?? b.grade ?? 0;
    if (wa !== wb) return wa - wb;
    return a.code.localeCompare(b.code);
  });

  return {
    teacherName,
    token,
    courses,
    fetchedAt: new Date().toISOString()
  };
}

// ==========================================================================
// API 路由
// ==========================================================================

// 1. GET /api/courses - 取得即時課程清單與學生名冊
app.get('/api/courses', async (c) => {
  const refresh = c.req.query('refresh') === 'true';
  const now = Date.now();

  if (!refresh && coursesCache.data && (now - coursesCache.timestamp < CACHE_TTL_MS)) {
    return c.json({
      success: true,
      fromCache: true,
      cacheAgeSec: Math.round((now - coursesCache.timestamp) / 1000),
      ...coursesCache.data
    });
  }

  try {
    const crawled = await crawlCourses();
    coursesCache = {
      data: crawled,
      token: crawled.token,
      timestamp: now
    };
    return c.json({
      success: true,
      fromCache: false,
      ...crawled
    });
  } catch (err) {
    console.error('[API ERROR] 爬取失敗:', err);
    if (coursesCache.data) {
      return c.json({
        success: true,
        fromCache: true,
        stale: true,
        ...coursesCache.data
      });
    }
    return c.json({ success: false, error: err.message }, 500);
  }
});

// 2. POST /api/rollcall - 批次送出點名紀錄至 GAS
app.post('/api/rollcall', async (c) => {
  try {
    const body = await c.req.json();
    const { courseCode, date, periods, records } = body;

    if (!courseCode || !date || !periods || !records) {
      return c.json({ success: false, error: '缺少必要欄位' }, 400);
    }

    // token 與名冊同時取得，超過快取 TTL 就重新登入，避免用過期 token 寫入
    let token = coursesCache.token;
    const tokenExpired = Date.now() - coursesCache.timestamp >= CACHE_TTL_MS;
    if (!token || tokenExpired) {
      const fresh = await crawlCourses();
      token = fresh.token;
      if (token) {
        coursesCache = { data: fresh, token, timestamp: Date.now() };
      }
    }
    if (!token) {
      return c.json({ success: false, error: '無法取得 GAS 登入憑證（token），可能是帳號密碼錯誤或後台登入頁格式變更，未送出任何節次' }, 502);
    }

    const results = [];
    for (const p of periods) {
      const lessonStr = `第${p}節`;
      const formParams = new URLSearchParams({
        acc: 'cshs643',
        token: token,
        page: 'rollcall',
        course: courseCode,
        date: date,
        lesson: lessonStr
      });

      records.forEach(r => {
        formParams.append(r.fieldName, `${r.baseRaw},${r.statusCode}`);
      });

      try {
        const res = await fetch(GAS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formParams
        });
        // GAS 失敗時常仍回 HTTP 200：回應若是登入頁（含密碼欄位），代表 token 已失效、未寫入
        const bodyText = res.ok ? await res.text() : '';
        const decoded = decodeGasResponse(bodyText) || bodyText;
        const isLoginPage = /name=\\*["']?pwd\b/.test(decoded);
        if (res.ok && isLoginPage) {
          coursesCache.token = null;
          results.push({ period: p, ok: false, status: res.status, error: 'GAS 回到登入頁，登入憑證已失效，未寫入' });
        } else if (res.ok) {
          results.push({ period: p, ok: true, status: res.status, error: null });
        } else {
          const errMsg = `HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ''}`;
          results.push({ period: p, ok: false, status: res.status, error: errMsg });
        }
      } catch (fetchErr) {
        results.push({
          period: p,
          ok: false,
          status: 0,
          error: fetchErr && fetchErr.message ? fetchErr.message : String(fetchErr)
        });
      }
    }

    const failed = results.filter(r => !r.ok);
    if (failed.length > 0) {
      const failedPeriods = failed.map(f => f.period).join('、');
      const reasonDetails = failed
        .map(f => `第 ${f.period} 節：${f.error || (f.status ? `HTTP ${f.status}` : '連線失敗')}`)
        .join('；');
      return c.json({
        success: false,
        error: `第 ${failedPeriods} 節寫入失敗（${reasonDetails}）`,
        results
      }, 502);
    }

    return c.json({
      success: true,
      message: `第 ${periods.join('、')} 節點名資料已成功寫入清水高中 Google 試算表！`,
      results
    });
  } catch (err) {
    console.error('[ROLLCALL ERROR]', err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

// 3. POST /api/clear-cache - 手動清除伺服器快取
app.post('/api/clear-cache', (c) => {
  coursesCache = { data: null, token: null, timestamp: 0 };
  return c.json({ success: true, message: '後端快取已清空' });
});

// 4. GET /api/health - 健康檢查
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    cached: !!coursesCache.data,
    time: new Date().toISOString()
  });
});

// ==========================================================================
// 靜態前端資源轉發 (全自動雙環境相容)
// ==========================================================================
app.all('*', async (c) => {
  // 1. 線上環境：Cloudflare Pages / Workers
  if (c.env && c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }

  // 2. 本地環境：Node.js
  try {
    const { serveStatic } = await import('@hono/node-server/serve-static');
    return serveStatic({ root: './' })(c);
  } catch {
    return c.text('Not Found', 404);
  }
});

export default app;

// ==========================================================================
// 本地 Node.js 啟動進入點 (當直接執行 node _worker.js 或 npm run dev 時)
// ==========================================================================
if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].includes('_worker.js')) {
  import('@hono/node-server').then(({ serve }) => {
    const PORT = process.env.PORT || 3000;
    console.log(`\n======================================================`);
    console.log(`🚀 清水高中選修點名伺服器已啟動 (本地模式): http://localhost:${PORT}`);
    console.log(`   (單一檔案 _worker.js：本地 Node 與線上 Cloudflare 100% 共用)`);
    console.log(`======================================================\n`);
    serve({
      fetch: app.fetch,
      port: PORT
    });
  });
}
