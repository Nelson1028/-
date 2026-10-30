import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));

const TARGET_ORIGIN = 'https://industrialmgr.tainan.gov.tw';

// Helper to forward requests to the government platform
async function forwardToGov(endpoint: string, options: {
  method?: string;
  token?: string;
  params?: Record<string, string | number | boolean | undefined>;
  body?: any;
}) {
  let url = `${TARGET_ORIGIN}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  if (options.params) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(options.params)) {
      if (value !== undefined && value !== null && value !== '') {
        query.append(key, String(value));
      }
    }
    const qStr = query.toString();
    if (qStr) {
      url += (url.includes('?') ? '&' : '?') + qStr;
    }
  }

  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': `${TARGET_ORIGIN}/paymentBill/sewageMeter`,
    'Origin': TARGET_ORIGIN,
  };

  if (options.token) {
    let cleanToken = options.token.trim();
    if (cleanToken.startsWith('Bearer ')) {
      cleanToken = cleanToken.slice(7).trim();
    }
    headers['Authorization'] = `Bearer ${cleanToken}`;
  }

  const reqInit: RequestInit = {
    method: options.method || 'GET',
    headers,
  };

  if (options.body && options.method !== 'GET') {
    headers['Content-Type'] = 'application/json';
    reqInit.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }

  try {
    const res = await fetch(url, reqInit);
    const contentType = res.headers.get('content-type') || '';
    let data;
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      data = await res.text();
    }
    return {
      status: res.status,
      ok: res.ok,
      data,
    };
  } catch (err: any) {
    return {
      status: 500,
      ok: false,
      error: err?.message || 'Network request failed',
    };
  }
}

// 取得目標平臺偵測到的工業區 (僅保留柳科工業區與新吉工業區)
app.get('/api/proxy/parks', async (req, res) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || (req.query.token as string) || '';
  
  if (token) {
    const govRes = await forwardToGov('/Api/Common/ParkList', { method: 'GET', token });
    if (govRes.ok && govRes.data?.data && Array.isArray(govRes.data.data)) {
      const detected = govRes.data.data.map((p: any) => ({
        id: p.code || p.key || p.id,
        name: p.name || p.title,
        code: p.code || p.key,
      })).filter((p: any) => p.name && (p.name.includes('柳') || p.name.includes('新吉') || p.code === 'LiouYing' || p.code === 'SinJi'));
      
      if (detected.length > 0) {
        return res.json({
          success: true,
          data: [{ id: '', name: '全部工業區' }, ...detected],
        });
      }
    }
  }

  // 預設平臺已確實驗證的工業區名單
  return res.json({
    success: true,
    data: [
      { id: '', name: '全部工業區' },
      { id: 'LiouYing', name: '柳科工業區 (柳營科技工業區)' },
      { id: 'SinJi', name: '新吉工業區' },
    ],
  });
});

// ==========================================
// 氣象署 CODIS (https://codis.cwa.gov.tw/StationData) 氣象測站與降水量 API
// ==========================================

const CWA_STATIONS_DATA: Record<string, { id: string; name: string; parkId: string; location: string }> = {
  // 柳科工業區主要及鄰近測站
  'C0X320': { id: 'C0X320', name: '柳營', parkId: 'LiouYing', location: '臺南市柳營區' },
  'C0X250': { id: 'C0X250', name: '新營', parkId: 'LiouYing', location: '臺南市新營區' },
  'C2X060': { id: 'C2X060', name: '下營', parkId: 'LiouYing', location: '臺南市下營區' },
  'C0X130': { id: 'C0X130', name: '官田', parkId: 'LiouYing', location: '臺南市官田區' },
  'C1X040': { id: 'C1X040', name: '東山東原', parkId: 'LiouYing', location: '臺南市東山區' },
  'C0X210': { id: 'C0X210', name: '白河', parkId: 'LiouYing', location: '臺南市白河區' },
  'C0X260': { id: 'C0X260', name: '後壁', parkId: 'LiouYing', location: '臺南市後壁區' },
  'C0X230': { id: 'C0X230', name: '鹽水', parkId: 'LiouYing', location: '臺南市鹽水區' },

  // 新吉工業區主要及鄰近測站
  'C2O950': { id: 'C2O950', name: '安南', parkId: 'SinJi', location: '臺南市安南區' },
  'C0N020': { id: 'C0N020', name: '城西', parkId: 'SinJi', location: '臺南市安南區' },
  'C0N030': { id: 'C0N030', name: '四草', parkId: 'SinJi', location: '臺南市安南區' },
  'C0X150': { id: 'C0X150', name: '安定', parkId: 'SinJi', location: '臺南市安定區' },
  'C0X140': { id: 'C0X140', name: '西港', parkId: 'SinJi', location: '臺南市西港區' },
  '467420': { id: '467420', name: '永康', parkId: 'SinJi', location: '臺南市永康區' },
  '467410': { id: '467410', name: '臺南', parkId: 'SinJi', location: '臺南市中西區' },
  'C0X190': { id: 'C0X190', name: '安平', parkId: 'SinJi', location: '臺南市安平區' },
  '72N240': { id: '72N240', name: '七股', parkId: 'SinJi', location: '臺南市七股區' },

  // 臺南市其他常用工業區與重要行政區氣象測站
  'C0O900': { id: 'C0O900', name: '善化', parkId: 'all', location: '臺南市善化區' },
  'C0O980': { id: 'C0O980', name: '新市', parkId: 'all', location: '臺南市新市區' },
  'C0X080': { id: 'C0X080', name: '佳里', parkId: 'all', location: '臺南市佳里區' },
  'C0X120': { id: 'C0X120', name: '麻豆', parkId: 'all', location: '臺南市麻豆區' },
  'C0X160': { id: 'C0X160', name: '仁德', parkId: 'all', location: '臺南市仁德區' },
  'C1N001': { id: 'C1N001', name: '歸仁沙崙', parkId: 'all', location: '臺南市歸仁區' },
  'C0X170': { id: 'C0X170', name: '關廟', parkId: 'all', location: '臺南市關廟區' },
  'C0X180': { id: 'C0X180', name: '山上', parkId: 'all', location: '臺南市山上區' },
  'C0X220': { id: 'C0X220', name: '學甲', parkId: 'all', location: '臺南市學甲區' },
  'C0X280': { id: 'C0X280', name: '將軍', parkId: 'all', location: '臺南市將軍區' },
  'C0X290': { id: 'C0X290', name: '北門', parkId: 'all', location: '臺南市北門區' },
  'C2O930': { id: 'C2O930', name: '玉井', parkId: 'all', location: '臺南市玉井區' },
  'C1O921': { id: 'C1O921', name: '楠西', parkId: 'all', location: '臺南市楠西區' },
  'C2O880': { id: 'C2O880', name: '南化', parkId: 'all', location: '臺南市南化區' },
};

// 取得氣象測站清單與工業區對應配置
app.get('/api/proxy/cwa/stations', (_req, res) => {
  return res.json({
    success: true,
    source: 'https://codis.cwa.gov.tw/StationData',
    defaultParkStationMap: {
      LiouYing: 'C0X320', // 柳科工業區 -> 柳營測站 (C0X320)
      SinJi: 'C2O950',    // 新吉工業區 -> 安南測站 (C2O950)
      default: 'C0X320',
    },
    stations: Object.values(CWA_STATIONS_DATA),
  });
});

/**
 * 輔助函式：自交通部中央氣象署 CODIS API (https://codis.cwa.gov.tw/api/station) 抓取真實測站降水觀測
 * 支援中央氣象署各時期站碼轉換（例如 C2X060 / C0X060 下營、C2O950 / C0O950 安南、C0O830 / C2O880 南化等）
 */
async function fetchCodisPrecipitation(stationId: string, startPeriod: string, endPeriod: string): Promise<Record<string, { rainfall: number; hourlyMax: number }>> {
  const months = getMonthsRange(startPeriod, endPeriod);

  // 決定主查詢測站 ID 與新舊歷年相容備選測站代碼
  const candidateIds = [stationId];
  if (stationId === 'C0X320') candidateIds.push('C0X270');
  else if (stationId === 'C0X270') candidateIds.push('C0X320');
  else if (stationId === 'C0X250') candidateIds.push('C0O910');
  else if (stationId === 'C0O910') candidateIds.push('C0X250');
  else if (stationId === 'C2X060') candidateIds.push('C0X060', 'C1X060');
  else if (stationId === 'C0X060') candidateIds.push('C2X060', 'C1X060');
  else if (stationId === 'C2O950') candidateIds.push('C0O950');
  else if (stationId === 'C0O950') candidateIds.push('C2O950');
  else if (stationId === 'C2O930') candidateIds.push('C0O930');
  else if (stationId === 'C0O930') candidateIds.push('C2O930');
  else if (stationId === 'C2O880') candidateIds.push('C0O830', 'C1O880');
  else if (stationId === 'C0O830') candidateIds.push('C2O880');
  else if (stationId === '72N240') candidateIds.push('C0X310', '467780');

  const getCandidateTypes = (stn: string) => {
    if (stn.startsWith('46')) return ['cwb', 'auto_C0', 'agr'];
    if (stn.startsWith('C2') || stn.startsWith('72')) return ['agr', 'auto_C0', 'auto_C1'];
    if (stn.startsWith('C1')) return ['auto_C0', 'auto_C1', 'agr', 'cwb'];
    return ['auto_C0', 'agr', 'auto_C1', 'cwb'];
  };

  const map: Record<string, { rainfall: number; hourlyMax: number }> = {};

  for (const mStr of months) {
    let monthFound = false;
    const [y, m] = mStr.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const startIso = `${mStr}-01T00:00:00`;
    const endIso = `${mStr}-${String(lastDay).padStart(2, '0')}T23:59:59`;

    for (const cId of candidateIds) {
      if (monthFound) break;
      const candidateTypes = getCandidateTypes(cId);

      for (const stnType of candidateTypes) {
        if (monthFound) break;
        try {
          const postBody = new URLSearchParams({
            stn_ID: cId,
            stn_type: stnType,
            type: 'report_month',
            date: mStr,
            start: startIso,
            end: endIso,
          }).toString();

          const codisRes = await fetch('https://codis.cwa.gov.tw/api/station', {
            method: 'POST',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
              'Accept': 'application/json, text/javascript, */*; q=0.01',
              'Referer': 'https://codis.cwa.gov.tw/StationData',
            },
            body: postBody,
          });

          if (codisRes.ok) {
            const json = await codisRes.json();
            const dts = json?.data?.[0]?.dts;
            if (Array.isArray(dts) && dts.length > 0) {
              dts.forEach((d: any) => {
                if (d.DataDate) {
                  const clean = d.DataDate.split('T')[0].replace(/-/g, '/');
                  const accum = d.Precipitation?.Accumulation;
                  const hMax = d.Precipitation?.HourlyMaximum;

                  let rainVal = 0;
                  if (accum !== undefined && accum !== null) {
                    if (accum === 'T' || accum === 't') {
                      rainVal = 0; // 微量降水 (Trace <0.1mm)
                    } else {
                      const num = Number(accum);
                      if (!isNaN(num)) {
                        rainVal = num > 0 ? num : 0; // 排除 -9999 / -999 等儀器故障或無觀測負值
                      }
                    }
                  }

                  let hMaxVal = 0;
                  if (hMax !== undefined && hMax !== null) {
                    const hNum = Number(hMax);
                    if (!isNaN(hNum) && hNum > 0) {
                      hMaxVal = hNum;
                    }
                  }

                  map[clean] = {
                    rainfall: rainVal,
                    hourlyMax: hMaxVal,
                  };
                }
              });
              monthFound = true;
            }
          }
        } catch (e: any) {
          // 容錯嘗試下一種候選站型
        }
      }
    }
  }

  return map;
}

interface StationRainfallDataset {
  stationInfo: { id: string; name: string; parkId: string; location: string };
  records: Array<{
    date: string;
    rainfall: number;
    hourlyMax: number;
    stationId: string;
    stationName: string;
    intensityLevel: string;
    isEstimated?: boolean;
  }>;
  summary: {
    totalRainfall: number;
    rainyDays: number;
    totalDays: number;
    heavyRainDays: number;
    maxDailyRain: number;
    maxDailyDate: string;
  };
  startDate: string;
  endDate: string;
}

/**
 * 集中整合氣象署測站觀測與區間計算，消除重複代碼
 */
async function getStationRainfallDataset(
  stationId: string,
  startPeriodInput?: string,
  endPeriodInput?: string,
  startDateParam?: string,
  endDateParam?: string
): Promise<StationRainfallDataset> {
  let startPeriod = startPeriodInput || '';
  let endPeriod = endPeriodInput || startPeriod;

  if (startDateParam && !startPeriod) {
    startPeriod = startDateParam.slice(0, 7).replace(/\//g, '-');
  }
  if (endDateParam && !endPeriod) {
    endPeriod = endDateParam.slice(0, 7).replace(/\//g, '-');
  }
  if (!startPeriod) startPeriod = new Date().toISOString().slice(0, 7);
  if (!endPeriod) endPeriod = startPeriod;

  const stationInfo = CWA_STATIONS_DATA[stationId] || {
    id: stationId,
    name: stationId,
    parkId: stationId === 'C2O950' ? 'SinJi' : 'LiouYing',
    location: '臺南市',
  };

  const months = getMonthsRange(startPeriod, endPeriod);
  const codisMap = await fetchCodisPrecipitation(stationId, startPeriod, endPeriod);
  const hasCodisData = Object.keys(codisMap).length > 0;

  let records: Array<{
    date: string;
    rainfall: number;
    hourlyMax: number;
    stationId: string;
    stationName: string;
    intensityLevel: string;
    isEstimated?: boolean;
  }> = [];

  for (const mStr of months) {
    const [year, month] = mStr.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;

      let rainfall = 0;
      let hourlyMax = 0;
      let isEstimated = false;

      if (codisMap[dateStr]) {
        rainfall = codisMap[dateStr].rainfall;
        hourlyMax = codisMap[dateStr].hourlyMax;
      } else if (hasCodisData) {
        rainfall = 0;
        hourlyMax = 0;
      } else {
        rainfall = 0;
        hourlyMax = 0;
        isEstimated = true;
      }

      let intensityLevel = '無降水';
      if (rainfall >= 350) intensityLevel = '超大豪雨';
      else if (rainfall >= 200) intensityLevel = '大豪雨';
      else if (rainfall >= 80) intensityLevel = '豪雨';
      else if (rainfall >= 50) intensityLevel = '大雨';
      else if (rainfall >= 10) intensityLevel = '中雨';
      else if (rainfall > 0) intensityLevel = '小雨';

      records.push({
        date: dateStr,
        rainfall,
        hourlyMax,
        stationId,
        stationName: stationInfo.name,
        intensityLevel,
        isEstimated,
      });
    }
  }

  if (startDateParam) {
    const sClean = startDateParam.replace(/-/g, '/');
    records = records.filter((r) => r.date >= sClean);
  }
  if (endDateParam) {
    const eClean = endDateParam.replace(/-/g, '/');
    records = records.filter((r) => r.date <= eClean);
  }

  const totalRainfall = Number(records.reduce((acc, cur) => acc + cur.rainfall, 0).toFixed(1));
  const rainyDays = records.filter((r) => r.rainfall >= 0.5).length;
  const heavyRainDays = records.filter((r) => r.rainfall >= 50).length;
  let maxDailyRain = 0;
  let maxDailyDate = '';
  records.forEach((r) => {
    if (r.rainfall > maxDailyRain) {
      maxDailyRain = r.rainfall;
      maxDailyDate = r.date;
    }
  });

  return {
    stationInfo,
    records,
    summary: {
      totalRainfall,
      rainyDays,
      totalDays: records.length,
      heavyRainDays,
      maxDailyRain,
      maxDailyDate,
    },
    startDate: records[0]?.date || startDateParam || startPeriod,
    endDate: records[records.length - 1]?.date || endDateParam || endPeriod,
  };
}

// 擷取指定測站與區間之日降水量數據 (整合 CODIS CWA 觀測資料)
app.get('/api/proxy/cwa/rainfall', async (req, res) => {
  const stationId = (req.query.stationId as string) || 'C0X320';
  const startDateParam = (req.query.startDate as string) || (req.query.start as string) || '';
  const endDateParam = (req.query.endDate as string) || (req.query.end as string) || '';
  const startPeriod = (req.query.startPeriod as string) || (req.query.period as string) || '';
  const endPeriod = (req.query.endPeriod as string) || startPeriod;

  try {
    const dataset = await getStationRainfallDataset(stationId, startPeriod, endPeriod, startDateParam, endDateParam);
    return res.json({
      success: true,
      source: 'https://codis.cwa.gov.tw/StationData',
      stationId,
      stationName: dataset.stationInfo.name,
      location: dataset.stationInfo.location,
      startDate: dataset.startDate,
      endDate: dataset.endDate,
      summary: dataset.summary,
      data: dataset.records,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: `擷取氣象署測站降水量資料失敗: ${err?.message}`,
    });
  }
});

// 下載指定測站與區間之日降水量 CSV 檔案
app.get('/api/proxy/cwa/rainfall/download.csv', async (req, res) => {
  const stationId = (req.query.stationId as string) || 'C0X320';
  const startDateParam = (req.query.startDate as string) || '';
  const endDateParam = (req.query.endDate as string) || '';
  const startPeriod = (req.query.startPeriod as string) || (startDateParam ? startDateParam.slice(0, 7) : '');
  const endPeriod = (req.query.endPeriod as string) || (endDateParam ? endDateParam.slice(0, 7) : startPeriod);

  try {
    const dataset = await getStationRainfallDataset(stationId, startPeriod, endPeriod, startDateParam, endDateParam);
    const parkLabel = dataset.stationInfo.parkId === 'SinJi' ? '新吉工業區' : '柳科工業區';
    const csvHeaders = ['測站代碼', '測站名稱', '觀測日期', '日降水量(mm)', '降水強度等級', '最大時降水量(mm)', '對應園區', '資料來源'];
    const csvRows = dataset.records.map((r) => [
      `"${stationId}"`,
      `"${dataset.stationInfo.name}"`,
      `"${r.date}"`,
      r.rainfall,
      `"${r.intensityLevel}"`,
      r.hourlyMax,
      `"${parkLabel}"`,
      `"https://codis.cwa.gov.tw/StationData"`,
    ]);

    const csvContent = '\uFEFF' + [csvHeaders.join(','), ...csvRows.map((row) => row.join(','))].join('\n');
    const filename = `氣象署CODIS降水數據_${dataset.stationInfo.name}(${stationId})_${startDateParam || dataset.startDate}_${endDateParam || dataset.endDate}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    return res.send(csvContent);
  } catch (err: any) {
    return res.status(500).send(`下載降水資料 CSV 失敗: ${err?.message}`);
  }
});

// Get Captcha from official platform
app.get('/api/proxy/captcha', async (_req, res) => {
  const result = await forwardToGov('/Api/Token/Captcha', {
    method: 'GET',
  });
  return res.status(result.status).json(result.data || { success: false, error: result.error });
});

// Login route (Account, Password, Captcha)
app.post('/api/proxy/login', async (req, res) => {
  const { userName, password, captcha, captchaId, loginType = 'sso' } = req.body;

  if (!userName || !password || !captcha || !captchaId) {
    return res.status(400).json({
      success: false,
      message: '請填寫完整帳號、密碼與驗證碼',
    });
  }

  const endpoint = loginType === 'normal' ? '/Api/Token/SignIn' : '/Api/Token/Sso';
  const result = await forwardToGov(endpoint, {
    method: 'POST',
    body: {
      userName: userName.trim(),
      qoo: password,
      captcha: captcha.trim(),
      captchaId: captchaId.trim(),
    },
  });

  if (result.ok && result.data?.success) {
    return res.json({
      success: true,
      message: '登入成功',
      data: result.data.data,
    });
  } else {
    return res.status(result.status || 400).json({
      success: false,
      message: result.data?.message || result.error || '登入失敗，請確認帳號密碼與驗證碼是否正確',
      errorCode: result.data?.errorCode,
      raw: result.data,
    });
  }
});

// Verify token route
app.post('/api/proxy/verify-token', async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ success: false, message: '請提供 Token' });
  }

  const result = await forwardToGov('/Api/WaterBilling/Query', {
    method: 'GET',
    token,
    params: { pageSize: 1, currentPage: 1 },
  });

  if (result.status === 200 && result.data?.success) {
    return res.json({
      success: true,
      message: 'Token 驗證成功，連線正常',
      total: result.data.total,
      totalPages: result.data.totalPages,
    });
  } else if (result.status === 401) {
    return res.status(401).json({
      success: false,
      message: 'Token 已失效或無授權 (HTTP 401)，請重新登入或從 Edge DevTools 取得最新 Token',
    });
  } else {
    return res.status(result.status || 500).json({
      success: false,
      message: result.data?.message || result.error || `請求失敗 (HTTP ${result.status})`,
      raw: result.data,
    });
  }
});

// Query Vendor List
app.post('/api/proxy/query-vendors', async (req, res) => {
  const { token, pageSize = 20, currentPage = 1, parkId = '', keyword = '', isAbnormal = '', billingDate = '', sorting = '', sortingDesc = false } = req.body;

  const result = await forwardToGov('/Api/WaterBilling/Query', {
    method: 'GET',
    token,
    params: {
      pageSize,
      currentPage,
      parkId,
      keyword,
      isAbnormal,
      billingDate,
      sorting,
      sortingDesc,
      isAdvSearch: true,
    },
  });

  return res.status(result.status).json(result.data || { success: false, error: result.error });
});

// Query Vendor Month Details (前12個月平均每日污水水量 + 每日污水與自來水數據)
app.post('/api/proxy/vendor-detail', async (req, res) => {
  const { token, waterId, period, sorting = 'billingDate', sortingDesc = true } = req.body;

  if (!waterId) {
    return res.status(400).json({ success: false, message: '缺少 waterId' });
  }

  const periodVal = period || new Date().toISOString().slice(0, 7);

  const result = await forwardToGov('/Api/WaterBilling/QueryMonth', {
    method: 'GET',
    token,
    params: {
      waterId,
      period: periodVal,
      sorting,
      sortingDesc,
    },
  });

  return res.status(result.status).json(result.data || { success: false, error: result.error });
});



// Helper to generate months between start and end (inclusive)
function getMonthsRange(start: string, end: string): string[] {
  const s = start <= end ? start : end;
  const e = start <= end ? end : start;
  const [sY, sM] = s.split('-').map(Number);
  const [eY, eM] = e.split('-').map(Number);
  const months: string[] = [];

  let curY = sY;
  let curM = sM;
  while (curY < eY || (curY === eY && curM <= eM)) {
    months.push(`${curY}-${String(curM).padStart(2, '0')}`);
    curM++;
    if (curM > 12) {
      curM = 1;
      curY++;
    }
  }
  return months;
}

// Full Batch Crawler SSE endpoint (Streaming progress)
app.get('/api/proxy/batch-crawl-stream', async (req, res) => {
  const token = (req.query.token as string) || '';
  const parkId = (req.query.parkId as string) || '';
  const keyword = (req.query.keyword as string) || '';
  const maxPages = Number(req.query.maxPages) || 10;
  const startPeriod = (req.query.startPeriod as string) || (req.query.period as string) || new Date().toISOString().slice(0, 7);
  const endPeriod = (req.query.endPeriod as string) || startPeriod;
  const targetMonths = getMonthsRange(startPeriod, endPeriod);
  const newestMonth = targetMonths[targetMonths.length - 1]; // 區間中最新月份

  if (!token) {
    return res.status(400).json({ success: false, message: '缺少 Token' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvt = (type: string, data: any) => {
    res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    sendEvt('status', { message: '正在取得水錶廠商列表第一頁與總頁數...', progress: 5 });

    const firstPageRes = await forwardToGov('/Api/WaterBilling/Query', {
      method: 'GET',
      token,
      params: {
        pageSize: 50,
        currentPage: 1,
        parkId,
        keyword,
        isAdvSearch: true,
      },
    });

    if (!firstPageRes.ok || !firstPageRes.data?.success) {
      sendEvt('error', {
        message: firstPageRes.data?.message || firstPageRes.error || `無法取得廠商列表 (HTTP ${firstPageRes.status})`,
      });
      return res.end();
    }

    const totalPages = Math.min(firstPageRes.data.totalPages || 1, maxPages);
    const totalCount = firstPageRes.data.total || 0;
    const allVendors: any[] = [...(firstPageRes.data.data || [])];

    sendEvt('status', {
      message: `已取得第 1/${totalPages} 頁，平臺線上共 ${totalCount} 筆水錶資料`,
      progress: 15,
      totalCount,
      totalPages,
    });

    // Fetch remaining pages if any
    for (let p = 2; p <= totalPages; p++) {
      sendEvt('status', { message: `正在取得第 ${p}/${totalPages} 頁廠商列表...`, progress: 15 + Math.floor((p / totalPages) * 15) });
      const pRes = await forwardToGov('/Api/WaterBilling/Query', {
        method: 'GET',
        token,
        params: {
          pageSize: 50,
          currentPage: p,
          parkId,
          keyword,
          isAdvSearch: true,
        },
      });
      if (pRes.ok && pRes.data?.data) {
        allVendors.push(...pRes.data.data);
      }
    }

    sendEvt('status', {
      message: `水錶清單擷取完成，共計 ${allVendors.length} 筆水錶。開始擷取區間（${startPeriod} ~ ${endPeriod}，共 ${targetMonths.length} 個月）每日污水量、本月累積量、污自比與最新月（${newestMonth}）前12個月日均量...`,
      progress: 30,
      totalVendors: allVendors.length,
      targetMonths,
    });

    const results: any[] = [];
    const concurrency = 2; // safe concurrency for multi-month queries
    let processed = 0;

    for (let i = 0; i < allVendors.length; i += concurrency) {
      const chunk = allVendors.slice(i, i + concurrency);
      const chunkPromises = chunk.map(async (vendor) => {
        try {
          let latestTwelveAvg: number | null = null;
          let twelveMonthDays: any[] = [];
          const allWaterBillingDays: any[] = [];
          let totalPeriodWw = 0;
          let totalPeriodWater = 0;
          let hasAnyMonthData = false;
          let latestBillingId = '';

          // 依序查詢區間內所有月份（由最新月優先確認 12M 日均）
          for (const mStr of [...targetMonths].reverse()) {
            const detailRes = await forwardToGov('/Api/WaterBilling/QueryMonth', {
              method: 'GET',
              token,
              params: {
                waterId: vendor.waterId,
                period: mStr,
                sorting: 'billingDate',
                sortingDesc: true,
              },
            });

            if (detailRes.ok && detailRes.data?.success && detailRes.data.data) {
              const d = detailRes.data.data;
              hasAnyMonthData = true;
              if (!latestBillingId && d.billingId) latestBillingId = d.billingId;

              // 前12個月日平均值：採用截取區間中最新月份的數據
              if (mStr === newestMonth && d.twelveAvg !== undefined && d.twelveAvg !== null) {
                latestTwelveAvg = Number(d.twelveAvg);
              } else if (latestTwelveAvg === null && d.twelveAvg !== undefined && d.twelveAvg !== null) {
                latestTwelveAvg = Number(d.twelveAvg);
              }

              if (twelveMonthDays.length === 0 && Array.isArray(d.twelveMonthDays)) {
                twelveMonthDays = d.twelveMonthDays.map((item: any) => ({
                  year: item.year,
                  month: item.month,
                  date: `${item.year}/${String(item.month).padStart(2, '0')}`,
                  avgDayWwVolume: item.avgDayWwVolume !== null ? Number(item.avgDayWwVolume) : 0,
                }));
              }

              // 彙整該月份的每日水錶排放量
              if (Array.isArray(d.waterBillingDays)) {
                d.waterBillingDays.forEach((item: any) => {
                  allWaterBillingDays.push({
                    dayBillingId: item.dayBillingId,
                    billingDate: item.billingDate || '',
                    dayWwVolume: item.dayWwVolume !== null && item.dayWwVolume !== undefined ? Number(item.dayWwVolume) : null,
                    dayWaterVolume: item.dayWaterVolume !== null && item.dayWaterVolume !== undefined ? Number(item.dayWaterVolume) : null,
                    wwAccumulate: item.wwAccumulate !== null && item.wwAccumulate !== undefined ? Number(item.wwAccumulate) : null,
                    waterAccumulate: item.waterAccumulate !== null && item.waterAccumulate !== undefined ? Number(item.waterAccumulate) : null,
                    remark: item.remark || '',
                    isModifyWwWater: !!item.isModifyWwWater,
                    isModifyWater: !!item.isModifyWater,
                  });
                });
              }

              if (d.wwVolume !== undefined && d.wwVolume !== null) totalPeriodWw += Number(d.wwVolume);
              if (d.waterVolume !== undefined && d.waterVolume !== null) totalPeriodWater += Number(d.waterVolume);
            }
          }

          // 去除重複日期記錄並排序
          const dayMap = new Map<string, any>();
          allWaterBillingDays.forEach((item) => {
            const key = item.billingDate || item.dayBillingId;
            if (key && !dayMap.has(key)) {
              dayMap.set(key, item);
            }
          });
          const deduplicatedDays = Array.from(dayMap.values());

          // 若多月份無月總量，從每日累加計算
          if (totalPeriodWw === 0 && deduplicatedDays.length > 0) {
            totalPeriodWw = deduplicatedDays.reduce((acc, cur) => acc + (cur.dayWwVolume || 0), 0);
          }
          if (totalPeriodWater === 0 && deduplicatedDays.length > 0) {
            totalPeriodWater = deduplicatedDays.reduce((acc, cur) => acc + (cur.dayWaterVolume || 0), 0);
          }

          // 計算區間污自比
          let ratio: number | null = null;
          if (totalPeriodWw > 0 && totalPeriodWater > 0) {
            ratio = Number((totalPeriodWw / totalPeriodWater).toFixed(4));
          } else if (vendor.wwVolume && vendor.waterVolume && Number(vendor.waterVolume) > 0) {
            ratio = Number((Number(vendor.wwVolume) / Number(vendor.waterVolume)).toFixed(4));
          }

          const curWwVolume = hasAnyMonthData ? totalPeriodWw : (vendor.wwVolume !== undefined && vendor.wwVolume !== null ? Number(vendor.wwVolume) : null);
          const curWaterVolume = hasAnyMonthData ? totalPeriodWater : (vendor.waterVolume !== undefined && vendor.waterVolume !== null ? Number(vendor.waterVolume) : null);

          return {
            waterId: vendor.waterId,
            parkName: vendor.parkName || '未指定工業區',
            name: vendor.name || '未知廠商',
            waterName: vendor.waterName || '水錶',
            billingDate: vendor.billingDate || newestMonth,
            twelveAvg: latestTwelveAvg,
            wwVolume: curWwVolume,
            waterVolume: curWaterVolume,
            ratio,
            approvedWwVolume: vendor.approvedWwVolume ? Number(vendor.approvedWwVolume) : null,
            wastewaterVolume: vendor.wastewaterVolume ? Number(vendor.wastewaterVolume) : null,
            exWwAccumulate: vendor.exWwAccumulate ? Number(vendor.exWwAccumulate) : null,
            exWaterAccumulate: vendor.exWaterAccumulate ? Number(vendor.exWaterAccumulate) : null,
            billingId: latestBillingId,
            twelveMonthDays,
            waterBillingDays: deduplicatedDays,
            extractedAt: new Date().toISOString(),
          };
        } catch (err: any) {
          return {
            waterId: vendor.waterId,
            parkName: vendor.parkName || '未指定工業區',
            name: vendor.name || '未知廠商',
            waterName: vendor.waterName || '水錶',
            billingDate: vendor.billingDate || '',
            twelveAvg: null,
            wwVolume: null,
            waterVolume: null,
            ratio: null,
            error: err?.message || '讀取失敗',
            extractedAt: new Date().toISOString(),
          };
        }
      });

      const chunkResults = await Promise.all(chunkPromises);
      for (const item of chunkResults) {
        results.push(item);
        processed++;
        sendEvt('item', {
          item,
          processed,
          total: allVendors.length,
          progress: 30 + Math.floor((processed / allVendors.length) * 65),
        });
      }

      await new Promise((r) => setTimeout(r, 60));
    }

    sendEvt('complete', {
      message: `爬取完成！共成功擷取 ${results.length} 筆水錶廠商區間數據（含 ${startPeriod} ~ ${endPeriod} 每日數據、最新月 ${newestMonth} 前12個月日均值）。`,
      progress: 100,
      count: results.length,
      data: results,
    });

    res.end();
  } catch (error: any) {
    sendEvt('error', { message: error?.message || '伺服器執行爬取時發生異常' });
    res.end();
  }
});

// API route to download local executable package ZIP
app.get('/api/download/local-package', (_req, res) => {
  const possiblePaths = [
    path.resolve(__dirname, 'tainan-sewage-system-local.zip'),
    path.resolve(__dirname, 'public', 'tainan-sewage-system-local.zip'),
    path.resolve(process.cwd(), 'tainan-sewage-system-local.zip'),
  ];
  const zipPath = possiblePaths.find((p) => fs.existsSync(p));

  if (zipPath) {
    res.download(zipPath, 'tainan-sewage-system-local.zip');
  } else {
    res.status(404).json({ error: '本地執行包正在打包中或尚未生成，請稍候重試' });
  }
});

// Configure Vite in development or static serve in production
async function startServer() {
  const rootDist = path.resolve(__dirname, 'dist');
  const hasDist = fs.existsSync(path.resolve(rootDist, 'index.html')) || fs.existsSync(path.resolve(__dirname, 'index.html'));
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev || (!hasDist && process.env.NODE_ENV !== 'production')) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = fs.existsSync(rootDist) ? rootDist : __dirname;
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
