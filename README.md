# 清水高中選修課程快速點名系統 (CSHS Roll Call PWA & Hono API)

專為臺中市立清水高中教師設計之現代化、極速、響應式 (RWD) 選修課程點名系統。

---

## ✨ 核心特色與客製化功能

1. **⚡ 免登入直接開啟**：
   - 帳號密碼預設內建於系統中（帳號：`cshs643`、密碼：`cshs643`，王子齊 老師）。
   - 開啟網頁直接進入點名面板，完全跳過原始 Google Apps Script 緩慢的登入與重載過程。
   - 若學校管理員重設密碼，可點擊右上角「⚙️ 設定」即時更新，並支援記住於本機。

2. **🚀 Hono 後端即時爬蟲（Real-time Crawler）**：
   - 內建 Hono 極速微服務後端（`server.js`），即時向清水高中 GAS 後台爬取最新課堂清單與真實學生名冊。
   - 內建智慧記憶體快取（10 分鐘 TTL），提供毫秒級秒開體驗與即時資料維護。
   - 點名紀錄由後端代理直接打入 Google 試算表（Zero-CORS Direct Submit），即時回傳確認。

3. **📱 PWA 跨平台桌面/手機 App**：
   - 支援完整 Progressive Web App 規範（Web App Manifest + Service Worker 離線快取）。
   - **手機使用**：使用手機瀏覽器打開網址後，點擊「加入主畫面 (Add to Home Screen)」，即可生成手機專用 App 圖示，全螢幕獨立運行！
   - 離線時支援自動切換至本機備援資料庫。

4. **🔢 課程依「高一、高二、高三」嚴格排序**：
   - 自動識別課名標籤（`[一..]`, `[二..]`, `[三..]`），依年級數字（1 ➔ 2 ➔ 3）順序嚴謹排列。
   - 頂部提供年級分類切換按鈕（全部課程 / 高一課程 / 高二課程 / 高三課程）。

5. **🕒 課堂節次動態抓取與「多選批次送出」**：
   - 動態抓取每門課實際授課節次：若該課程只有第 3、4 節，介面僅動態顯示第 3、4 節，不會顯示其他無關節次。
   - 支援多節次同時勾選（例如同時選取第 3、4 節），按下「確認送出點名」即可一次批次寫入後台！

6. **🖐️ 手機單手極速操作點名**：
   - **一鍵全員出席**：預設全到，單鍵瞬間完成。
   - **狀態快捷切換**：出席 (綠) / 遲到 (黃) / 缺席 (紅)，高對比大觸控面積。
   - **即時統計計算**：即時顯示應到、實到、缺席、請假人數。
   - **歷史紀錄檢視**：本機隨時可調閱過去送出的點名名單與缺曠紀錄。

---

## 🚀 啟動與使用方式

### 方式 1：本機運行 Hono 伺服器
```bash
npm install
npm run dev
```
瀏覽器開啟：`http://localhost:3000`

---

## ☁️ 部署至 Cloudflare

本專案原生支援 Cloudflare（具備 `_worker.js` 與 `wrangler.json`），提供兩種極速部署方式：

### 推薦方式 A：Cloudflare Pages（與 GitHub 連動，自動 CI/CD）
1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2. 進入 **Workers & Pages** ➔ **Create application** ➔ **Pages** ➔ **Connect to Git**。
3. 選擇 GitHub 儲存庫 `lu7766lu7766/cshs-roll-call`。
4. 建置設定：
   - **Framework preset**：`None`
   - **Build command**：（留空，或輸入 `npm run build`）
   - **Build output directory**：`.`（或留空代表根目錄）
5. 點擊 **Save and Deploy**，Cloudflare 會自動讀取 `_worker.js`，兼具前端靜態 CDN 與 Hono 即時爬蟲 API！

### 推薦方式 B：Cloudflare Workers（使用 Wrangler CLI 一鍵發布）
在終端機執行：
```bash
npx wrangler login   # 首次登入 Cloudflare
npx wrangler deploy  # 一鍵發布全端專案至 Cloudflare Workers
```

