export function generateDevToolsScript(options?: {
  maxPages?: number;
  startPeriod?: string;
  endPeriod?: string;
  period?: string;
  delayMs?: number;
}): string {
  const maxPages = options?.maxPages || 10;
  const startPeriod = options?.startPeriod || options?.period || new Date().toISOString().slice(0, 7);
  const endPeriod = options?.endPeriod || startPeriod;
  const delayMs = options?.delayMs || 120;

  return `/**
 * ==============================================================================
 * 臺南市工業區園區業務管理平臺 - 區間抄錶、前12個月日均量、每日污水量、污自比與異常分析 擷取腳本
 * 適用瀏覽器: Microsoft Edge / Google Chrome (DevTools Console)
 * 網址: https://industrialmgr.tainan.gov.tw/paymentBill/sewageMeter
 * 目標核心欄位:
 *   1. 前12個月平均每日污水水量（m³/日） -> 取區間中最新月數據 (.v-col.v-col-auto.align-self-center.py-2)
 *   2. 本月/區間累積污水排放量 (m³)
 *   3. 本月/區間累積自來水使用量 (m³)
 *   4. 本月/區間污自比 (累積污水/累積自來水)
 *   5. 各水錶名稱每日污水量排放紀錄 (waterBillingDays)
 *   6. 異常排放初步分析初判 (污自比偏差、7日未排放、讀值倒退、單日突增)
 * ==============================================================================
 */
(async function runTainanSewageScraper() {
  console.log('%c[臺南污水資料擷取器] 開始執行...', 'color: #0284c7; font-weight: bold; font-size: 14px;');

  const SYSTEM_NAME = '工業區管理資訊系統─園區業務管理平臺';
  const tokenKey = 'token' + SYSTEM_NAME;
  let rawToken = localStorage.getItem(tokenKey);
  
  let token = null;
  if (rawToken) {
    try {
      token = JSON.parse(rawToken);
    } catch (e) {
      token = rawToken;
    }
  }

  if (!token) {
    alert('❌ 找不到登入 Token！請確認您已在當前分頁登入臺南市工業區管理平臺。');
    console.error('請先登入系統後再執行此腳本。');
    return;
  }

  // 建立浮動進度視窗
  const panel = document.createElement('div');
  panel.id = 'sewage-scraper-panel';
  panel.style.cssText = 'position:fixed;top:20px;right:20px;width:440px;background:#0f172a;color:#f8fafc;padding:18px;border-radius:14px;box-shadow:0 15px 35px rgba(0,0,0,0.6);z-index:999999;font-family:sans-serif;font-size:13px;border:1px solid #38bdf8;';
  panel.innerHTML = \`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
      <strong style="color:#38bdf8;font-size:14px;display:flex;align-items:center;gap:6px;">🌊 臺南經發局工業區廠商水錶檢核擷取器</strong>
      <button id="close-panel-btn" style="background:transparent;border:none;color:#94a3b8;cursor:pointer;font-size:16px;">✕</button>
    </div>
    <div style="font-size:12px;color:#cbd5e1;margin-bottom:8px;">
      目標工業區：<b>柳科工業區 / 新吉工業區</b><br>
      擷取區間：<b>${startPeriod} ~ ${endPeriod}</b> (12M日均取最新月)<br>
      核心標的：<b>最新月日均量、每日污水量、自來水量、污自比、異常檢核</b>
    </div>
    <div style="background:#1e293b;height:8px;border-radius:4px;overflow:hidden;margin-bottom:10px;">
      <div id="scraper-bar" style="background:#38bdf8;width:0%;height:100%;transition:width 0.2s;"></div>
    </div>
    <div id="scraper-status" style="color:#e2e8f0;margin-bottom:10px;font-size:12px;">正在初始化連線...</div>
    <div id="scraper-log" style="height:130px;overflow-y:auto;background:#020617;padding:8px;border-radius:8px;font-family:monospace;font-size:11px;color:#94a3b8;line-height:1.4;"></div>
    <div id="scraper-actions" style="margin-top:12px;display:none;gap:8px;flex-direction:column;">
      <button id="copy-json-btn" style="width:100%;padding:8px 12px;background:#0284c7;color:white;border:none;border-radius:6px;font-weight:bold;cursor:pointer;">📋 複製 JSON 數據 (可直接貼回分析系統)</button>
      <button id="dl-merged-excel-btn" style="width:100%;padding:8px 12px;background:#0d9488;color:white;border:none;border-radius:6px;font-weight:bold;cursor:pointer;">📊 下載水錶檢核成果與每日明細 Excel</button>
    </div>
  \`;
  document.body.appendChild(panel);

  document.getElementById('close-panel-btn').onclick = () => panel.remove();

  const bar = document.getElementById('scraper-bar');
  const statusEl = document.getElementById('scraper-status');
  const logEl = document.getElementById('scraper-log');
  const actionsEl = document.getElementById('scraper-actions');

  function log(msg, color = '#cbd5e1') {
    const item = document.createElement('div');
    item.style.color = color;
    item.textContent = \`[\${new Date().toTimeString().slice(0, 8)}] \${msg}\`;
    logEl.appendChild(item);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function setProgress(pct, text) {
    bar.style.width = \`\${pct}%\`;
    statusEl.textContent = text;
  }

  // 產生日曆月份清單
  function getMonths(start, end) {
    const s = start <= end ? start : end;
    const e = start <= end ? end : start;
    const [sY, sM] = s.split('-').map(Number);
    const [eY, eM] = e.split('-').map(Number);
    const res = [];
    let cY = sY, cM = sM;
    while (cY < eY || (cY === eY && cM <= eM)) {
      res.push(cY + '-' + String(cM).padStart(2, '0'));
      cM++;
      if (cM > 12) { cM = 1; cY++; }
    }
    return res;
  }

  const targetMonths = getMonths('${startPeriod}', '${endPeriod}');
  const newestMonth = targetMonths[targetMonths.length - 1];
  const maxPages = ${maxPages};
  const delay = ${delayMs};
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  try {
    setProgress(5, '正在取得水錶清單第一頁...');
    log('連線目標: /Api/WaterBilling/Query');

    const firstRes = await fetch('/Api/WaterBilling/Query?pageSize=50&currentPage=1&isAdvSearch=true', {
      headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/json, text/plain, */*'
      }
    });

    if (!firstRes.ok) throw new Error(\`查詢廠商失敗 (HTTP \${firstRes.status})\`);
    const firstData = await firstRes.json();
    if (!firstData.success) throw new Error(firstData.message || 'API 查詢失敗');

    const totalPages = Math.min(firstData.totalPages || 1, maxPages);
    const totalCount = firstData.total || 0;
    const vendorList = [...(firstData.data || [])];

    log(\`總計有 \${totalCount} 筆水錶資料，共 \${firstData.totalPages} 頁 (本批預計擷取前 \${totalPages} 頁)\`, '#38bdf8');

    for (let p = 2; p <= totalPages; p++) {
      setProgress(5 + Math.floor((p / totalPages) * 15), \`正在取得第 \${p}/\${totalPages} 頁水錶清單...\`);
      const pRes = await fetch(\`/Api/WaterBilling/Query?pageSize=50&currentPage=\${p}&isAdvSearch=true\`, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const pData = await pRes.json();
      if (pData.success && pData.data) {
        vendorList.push(...pData.data);
      }
      await sleep(80);
    }

    log(\`水錶清單擷取完成，總計 \${vendorList.length} 筆水錶，開始擷取區間（\${targetMonths.join(', ')}）每日污水量、本月累積量、污自比與最新月（\${newestMonth}）12個月日均量...\`, '#4ade80');

    const extractedResults = [];
    for (let i = 0; i < vendorList.length; i++) {
      const v = vendorList[i];
      const pct = 20 + Math.floor(((i + 1) / vendorList.length) * 75);
      setProgress(pct, \`[\${i + 1}/\${vendorList.length}] 擷取中: \${v.name || '未知廠商'} (\${v.waterName || '水錶'})\`);

      try {
        let latestTwelveAvg = null;
        let monthList = [];
        const allDaily = [];
        let totalWw = 0;
        let totalWater = 0;
        let latestBillingId = '';

        for (const mStr of [...targetMonths].reverse()) {
          const detailRes = await fetch(\`/Api/WaterBilling/QueryMonth?waterId=\${v.waterId}&period=\${mStr}&sorting=billingDate&sortingDesc=true\`, {
            headers: { 'Authorization': 'Bearer ' + token }
          });
          const detailData = await detailRes.json();
          if (detailData.success && detailData.data) {
            const d = detailData.data;
            if (!latestBillingId && d.billingId) latestBillingId = d.billingId;
            if (mStr === newestMonth && d.twelveAvg !== undefined && d.twelveAvg !== null) {
              latestTwelveAvg = Number(d.twelveAvg);
            } else if (latestTwelveAvg === null && d.twelveAvg !== undefined && d.twelveAvg !== null) {
              latestTwelveAvg = Number(d.twelveAvg);
            }

            if (monthList.length === 0 && Array.isArray(d.twelveMonthDays)) {
              monthList = d.twelveMonthDays.map(m => ({
                year: m.year,
                month: m.month,
                date: \`\${m.year}/\${String(m.month).padStart(2, '0')}\`,
                avgDayWwVolume: m.avgDayWwVolume !== null ? Number(m.avgDayWwVolume) : 0
              }));
            }

            if (Array.isArray(d.waterBillingDays)) {
              d.waterBillingDays.forEach(day => {
                allDaily.push({
                  dayBillingId: day.dayBillingId,
                  billingDate: day.billingDate || '',
                  dayWwVolume: day.dayWwVolume !== null && day.dayWwVolume !== undefined ? Number(day.dayWwVolume) : null,
                  dayWaterVolume: day.dayWaterVolume !== null && day.dayWaterVolume !== undefined ? Number(day.dayWaterVolume) : null,
                  wwAccumulate: day.wwAccumulate !== null && day.wwAccumulate !== undefined ? Number(day.wwAccumulate) : null,
                  waterAccumulate: day.waterAccumulate !== null && day.waterAccumulate !== undefined ? Number(day.waterAccumulate) : null,
                  remark: day.remark || ''
                });
              });
            }

            if (d.wwVolume !== undefined && d.wwVolume !== null) totalWw += Number(d.wwVolume);
            if (d.waterVolume !== undefined && d.waterVolume !== null) totalWater += Number(d.waterVolume);
          }
          await sleep(delay / 2);
        }

        const dayMap = new Map();
        allDaily.forEach(item => {
          const k = item.billingDate || item.dayBillingId;
          if (k && !dayMap.has(k)) dayMap.set(k, item);
        });
        const deduplicatedDays = Array.from(dayMap.values());

        if (totalWw === 0 && deduplicatedDays.length > 0) {
          totalWw = deduplicatedDays.reduce((acc, cur) => acc + (cur.dayWwVolume || 0), 0);
        }
        if (totalWater === 0 && deduplicatedDays.length > 0) {
          totalWater = deduplicatedDays.reduce((acc, cur) => acc + (cur.dayWaterVolume || 0), 0);
        }

        let ratio = null;
        if (totalWw > 0 && totalWater > 0) {
          ratio = Number((totalWw / totalWater).toFixed(4));
        } else if (v.wwVolume && v.waterVolume && Number(v.waterVolume) > 0) {
          ratio = Number((Number(v.wwVolume) / Number(v.waterVolume)).toFixed(4));
        }

        extractedResults.push({
          waterId: v.waterId,
          parkName: v.parkName || '未指定工業區',
          name: v.name || '未知廠商',
          waterName: v.waterName || '水錶',
          billingDate: newestMonth,
          twelveAvg: latestTwelveAvg,
          wwVolume: totalWw > 0 ? totalWw : (v.wwVolume !== undefined && v.wwVolume !== null ? Number(v.wwVolume) : null),
          waterVolume: totalWater > 0 ? totalWater : (v.waterVolume !== undefined && v.waterVolume !== null ? Number(v.waterVolume) : null),
          ratio,
          approvedWwVolume: v.approvedWwVolume ? Number(v.approvedWwVolume) : null,
          wastewaterVolume: v.wastewaterVolume ? Number(v.wastewaterVolume) : null,
          exWwAccumulate: v.exWwAccumulate ? Number(v.exWwAccumulate) : null,
          exWaterAccumulate: v.exWaterAccumulate ? Number(v.exWaterAccumulate) : null,
          billingId: latestBillingId,
          twelveMonthDays: monthList,
          waterBillingDays: deduplicatedDays,
          extractedAt: new Date().toISOString()
        });

        log(\`✔ [\${v.waterName}] 最新日均量(\${newestMonth}): \${latestTwelveAvg ?? '-'} | 污水: \${totalWw || v.wwVolume || '-'} | 自來水: \${totalWater || v.waterVolume || '-'} | 污自比: \${ratio ? (ratio * 100).toFixed(1) + '%' : '-'}\`, '#93c5fd');
      } catch (err) {
        log(\`✖ \${v.name} 擷取失敗: \${err.message}\`, '#f87171');
        extractedResults.push({
          waterId: v.waterId,
          parkName: v.parkName || '',
          name: v.name || '',
          waterName: v.waterName || '',
          billingDate: v.billingDate || '',
          twelveAvg: null,
          wwVolume: null,
          waterVolume: null,
          ratio: null,
          error: err.message
        });
      }

      await sleep(delay);
    }

    setProgress(100, \`🎉 擷取完成！共 \${extractedResults.length} 筆水錶資料\`);
    log(\`成功擷取 \${extractedResults.length} 筆水錶完整排放數據！\`, '#4ade80');
    actionsEl.style.display = 'flex';

    // 複製 JSON
    document.getElementById('copy-json-btn').onclick = () => {
      navigator.clipboard.writeText(JSON.stringify(extractedResults, null, 2));
      alert('已複製 JSON 數據到剪貼簿！可直接貼上至分析儀表板。');
    };

    // 下載每日明細 Excel
    document.getElementById('dl-merged-excel-btn').onclick = () => {
      const dateSet = new Set();
      extractedResults.forEach(v => {
        (v.waterBillingDays || []).forEach(d => {
          if (d.billingDate) {
            const raw = String(d.billingDate).split('T')[0].split(' ')[0].trim().replace(/-/g, '/');
            dateSet.add(raw);
          }
        });
      });
      const sortedDates = Array.from(dateSet).sort();

      const headers = [
        '工業區',
        '廠商名稱',
        '水錶名稱',
        '前12個月日平均污水量',
        ...sortedDates.map(d => \`"\${d} 每日污水量(m³)"\`),
        '異常初判狀態',
        '異常診斷原因',
        '本月目前累積污水排放量 (m³)',
        '本月累積自來水使用量 (m³)',
        '污自比'
      ];

      const rows = extractedResults.map(v => {
        const dayMap = new Map();
        (v.waterBillingDays || []).forEach(d => {
          if (d.billingDate) {
            const raw = String(d.billingDate).split('T')[0].split(' ')[0].trim().replace(/-/g, '/');
            dayMap.set(raw, d.dayWwVolume !== undefined && d.dayWwVolume !== null ? d.dayWwVolume : '');
          }
        });
        const dailyCols = sortedDates.map(d => {
          const val = dayMap.get(d);
          if (val !== undefined && val !== '') {
            return val;
          }
          return '';
        });

        const ratioStr = v.ratio !== null && v.ratio !== undefined ? (v.ratio * 100).toFixed(1) + '%' : '-';
        const anomalyStatus = v.anomaly?.hasAnomaly
          ? (v.anomaly.severity === 'danger' ? '嚴重異常' : '警戒關注')
          : '正常合格';
        const anomalyReasons = v.anomaly?.reasons?.join('; ') || '無異常';

        return [
          \`"\${(v.parkName || '').replace(/"/g, '""')}"\`,
          \`"\${(v.name || '').replace(/"/g, '""')}"\`,
          \`"\${(v.waterName || '').replace(/"/g, '""')}"\`,
          v.twelveAvg !== null && v.twelveAvg !== undefined ? v.twelveAvg : '',
          ...dailyCols,
          \`"\${anomalyStatus}"\`,
          \`"\${anomalyReasons.replace(/"/g, '""')}"\`,
          v.wwVolume !== null && v.wwVolume !== undefined ? v.wwVolume : '',
          v.waterVolume !== null && v.waterVolume !== undefined ? v.waterVolume : '',
          \`"\${ratioStr}"\`
        ];
      });

      const csvContent = '\\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = \`臺南經發局工業區水錶每日明細_\${startPeriod}_\${endPeriod}_\${Date.now()}.csv\`;
      a.click();
    };

    window.__TAIWAN_SEWAGE_DATA__ = extractedResults;
    console.log('%c[擷取完成] 數據已存於 window.__TAIWAN_SEWAGE_DATA__', 'color: #4ade80; font-weight: bold;', extractedResults);

  } catch (err) {
    setProgress(0, '❌ 執行失敗');
    log('發生錯誤: ' + err.message, '#f87171');
    console.error(err);
  }
})();
`;
}
