// ==UserScript==
// @name         清水高中 iDiary 日誌審查：自動撈取待審日誌
// @namespace    https://github.com/lu7766lu7766/cshs-roll-call
// @version      1.0.0
// @description  進入 iDiary 日誌審查頁時，自動勾選「第 1 週～本週」並一頁列出所有待審日誌；未登入時，登入後自動回到審查頁
// @match        https://web.jhenggao.com/iDiary/*
// @grant        none
// @run-at       document-idle
// @inject-into  page
// ==/UserScript==

(function () {
  'use strict';

  // 原站的下拉選單 / 列表元件狀態都掛在頁面全域變數上，必須在頁面環境執行
  function main() {
    var REVIEW_PATH = '/idiary/dp_diaryreview';
    var RETURN_KEY = 'cshs_idiary_return_to_review';
    var WEEK_DROP_ID = '週次下拉選單';
    var PER_DROP_ID = 'TableList_dp_diaryReview_PerDrop';
    var TABLELIST_CODE = 'dp_diaryReview';
    var PER_PAGE = 100;
    var READY_TIMEOUT_MS = 20000;

    var path = location.pathname.toLowerCase();

    // 未登入時審查頁會回 401 錯誤頁：記下要回來，導向登入頁
    if (path === REVIEW_PATH) {
      if (/Code 401/.test(document.body ? document.body.innerText : '')) {
        sessionStorage.setItem(RETURN_KEY, '1');
        location.replace('/iDiary/login');
      } else {
        autoQueryAllWeeks();
      }
      return;
    }

    // 登入成功後原站會導到其他頁，這裡再轉回審查頁
    if (path !== '/idiary/login' && path !== '/idiary/logout' && sessionStorage.getItem(RETURN_KEY)) {
      sessionStorage.removeItem(RETURN_KEY);
      location.replace('/iDiary/dp_diaryReview');
    }

    function autoQueryAllWeeks() {
      if (window.__cshsAutoWeeksDone) return;
      window.__cshsAutoWeeksDone = true;

      waitUntilIdle(function () {
        var weekDrop = window.DropListTempData[WEEK_DROP_ID];

        // 原站預設只勾選「本週」，以它為上限
        var currentWeek = Math.max.apply(null, weekDrop.Select);
        var weeks = [];
        weekDrop.Data.forEach(function (group) {
          group.Option.forEach(function (option) {
            if (option.Val <= currentWeek) weeks.push(option.Val);
          });
        });

        // 每頁筆數調大，讓所有待審日誌一次列完（OnEnd 會觸發一次查詢）
        var perDrop = window.DropListTempData[PER_DROP_ID];
        if (perDrop && perDrop.Select[0] < PER_PAGE) {
          window.$('#' + PER_DROP_ID).DropSet([PER_PAGE]);
          perDrop.OnEnd([PER_PAGE], PER_DROP_ID);
        }

        waitUntilIdle(function () {
          // DropSet 不會觸發事件，需手動呼叫 OnEnd 讓原站更新週次條件並重新查詢
          window.$('#' + WEEK_DROP_ID).DropSet(weeks);
          weekDrop.OnEnd(window.DropListTempData[WEEK_DROP_ID].Select, WEEK_DROP_ID);

          waitUntilIdle(function () {
            var count = window.TableListTempData[TABLELIST_CODE].Count;
            showNotice('已自動查詢第 1～' + currentWeek + ' 週，共 ' + count + ' 筆');
          });
        });
      });
    }

    // 等原站元件建立完成且沒有讀取遮罩（查詢中）
    function waitUntilIdle(callback) {
      var startedAt = Date.now();
      (function check() {
        var drops = window.DropListTempData;
        var tables = window.TableListTempData;
        var ready = window.$ &&
          drops && drops[WEEK_DROP_ID] && drops[WEEK_DROP_ID].Select && drops[WEEK_DROP_ID].Select.length > 0 &&
          tables && tables[TABLELIST_CODE] && tables[TABLELIST_CODE].DataArray &&
          !document.getElementById('loadingCoverDiv');
        if (ready) {
          // 讀取遮罩淡出期間仍可能有排程中的查詢，稍等再執行
          setTimeout(callback, 300);
          return;
        }
        if (Date.now() - startedAt > READY_TIMEOUT_MS) {
          showNotice('自動查詢失敗：審查頁未在時限內載入完成，請手動勾選週次', true);
          return;
        }
        setTimeout(check, 200);
      })();
    }

    function showNotice(text, isError) {
      var el = document.createElement('div');
      el.textContent = text;
      el.style.cssText = [
        'position:fixed', 'left:50%', 'bottom:24px', 'transform:translateX(-50%)', 'z-index:99999',
        'max-width:calc(100% - 32px)', 'padding:10px 16px', 'border-radius:8px',
        'font-size:14px', 'line-height:1.4', 'color:#fff', 'box-shadow:0 6px 20px rgba(0,0,0,.25)',
        'background:' + (isError ? '#c0392b' : '#1f8f84'), 'transition:opacity .4s'
      ].join(';');
      document.body.appendChild(el);
      setTimeout(function () {
        el.style.opacity = '0';
        setTimeout(function () { el.remove(); }, 500);
      }, isError ? 8000 : 4000);
    }
  }

  // 若被腳本管理器放在隔離環境執行（看不到頁面的 jQuery），改以 inline script 注入頁面
  if (typeof window.jQuery === 'function') {
    main();
  } else {
    var script = document.createElement('script');
    script.textContent = '(' + main.toString() + ')();';
    document.documentElement.appendChild(script);
    script.remove();
  }
})();
