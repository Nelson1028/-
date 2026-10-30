// server.ts
import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
var PORT = Number(process.env.PORT) || 3e3;
app.use(express.json({ limit: "10mb" }));
var TARGET_ORIGIN = "https://industrialmgr.tainan.gov.tw";
async function forwardToGov(endpoint, options) {
  let url = `${TARGET_ORIGIN}${endpoint.startsWith("/") ? endpoint : "/" + endpoint}`;
  if (options.params) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(options.params)) {
      if (value !== void 0 && value !== null && value !== "") {
        query.append(key, String(value));
      }
    }
    const qStr = query.toString();
    if (qStr) {
      url += (url.includes("?") ? "&" : "?") + qStr;
    }
  }
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7",
    "Referer": `${TARGET_ORIGIN}/paymentBill/sewageMeter`,
    "Origin": TARGET_ORIGIN
  };
  if (options.token) {
    let cleanToken = options.token.trim();
    if (cleanToken.startsWith("Bearer ")) {
      cleanToken = cleanToken.slice(7).trim();
    }
    headers["Authorization"] = `Bearer ${cleanToken}`;
  }
  const reqInit = {
    method: options.method || "GET",
    headers
  };
  if (options.body && options.method !== "GET") {
    headers["Content-Type"] = "application/json";
    reqInit.body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
  }
  try {
    const res = await fetch(url, reqInit);
    const contentType = res.headers.get("content-type") || "";
    let data;
    if (contentType.includes("application/json")) {
      data = await res.json();
    } else {
      data = await res.text();
    }
    return {
      status: res.status,
      ok: res.ok,
      data
    };
  } catch (err) {
    return {
      status: 500,
      ok: false,
      error: err?.message || "Network request failed"
    };
  }
}
app.get("/api/proxy/parks", async (req, res) => {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "") || req.query.token || "";
  if (token) {
    const govRes = await forwardToGov("/Api/Common/ParkList", { method: "GET", token });
    if (govRes.ok && govRes.data?.data && Array.isArray(govRes.data.data)) {
      const detected = govRes.data.data.map((p) => ({
        id: p.code || p.key || p.id,
        name: p.name || p.title,
        code: p.code || p.key
      })).filter((p) => p.name && (p.name.includes("\u67F3") || p.name.includes("\u65B0\u5409") || p.code === "LiouYing" || p.code === "SinJi"));
      if (detected.length > 0) {
        return res.json({
          success: true,
          data: [{ id: "", name: "\u5168\u90E8\u5DE5\u696D\u5340" }, ...detected]
        });
      }
    }
  }
  return res.json({
    success: true,
    data: [
      { id: "", name: "\u5168\u90E8\u5DE5\u696D\u5340" },
      { id: "LiouYing", name: "\u67F3\u79D1\u5DE5\u696D\u5340 (\u67F3\u71DF\u79D1\u6280\u5DE5\u696D\u5340)" },
      { id: "SinJi", name: "\u65B0\u5409\u5DE5\u696D\u5340" }
    ]
  });
});
var CWA_STATIONS_DATA = {
  // 柳科工業區主要及鄰近測站
  "C0X320": { id: "C0X320", name: "\u67F3\u71DF", parkId: "LiouYing", location: "\u81FA\u5357\u5E02\u67F3\u71DF\u5340" },
  "C0X250": { id: "C0X250", name: "\u65B0\u71DF", parkId: "LiouYing", location: "\u81FA\u5357\u5E02\u65B0\u71DF\u5340" },
  "C2X060": { id: "C2X060", name: "\u4E0B\u71DF", parkId: "LiouYing", location: "\u81FA\u5357\u5E02\u4E0B\u71DF\u5340" },
  "C0X130": { id: "C0X130", name: "\u5B98\u7530", parkId: "LiouYing", location: "\u81FA\u5357\u5E02\u5B98\u7530\u5340" },
  "C1X040": { id: "C1X040", name: "\u6771\u5C71\u6771\u539F", parkId: "LiouYing", location: "\u81FA\u5357\u5E02\u6771\u5C71\u5340" },
  "C0X210": { id: "C0X210", name: "\u767D\u6CB3", parkId: "LiouYing", location: "\u81FA\u5357\u5E02\u767D\u6CB3\u5340" },
  "C0X260": { id: "C0X260", name: "\u5F8C\u58C1", parkId: "LiouYing", location: "\u81FA\u5357\u5E02\u5F8C\u58C1\u5340" },
  "C0X230": { id: "C0X230", name: "\u9E7D\u6C34", parkId: "LiouYing", location: "\u81FA\u5357\u5E02\u9E7D\u6C34\u5340" },
  // 新吉工業區主要及鄰近測站
  "C2O950": { id: "C2O950", name: "\u5B89\u5357", parkId: "SinJi", location: "\u81FA\u5357\u5E02\u5B89\u5357\u5340" },
  "C0N020": { id: "C0N020", name: "\u57CE\u897F", parkId: "SinJi", location: "\u81FA\u5357\u5E02\u5B89\u5357\u5340" },
  "C0N030": { id: "C0N030", name: "\u56DB\u8349", parkId: "SinJi", location: "\u81FA\u5357\u5E02\u5B89\u5357\u5340" },
  "C0X150": { id: "C0X150", name: "\u5B89\u5B9A", parkId: "SinJi", location: "\u81FA\u5357\u5E02\u5B89\u5B9A\u5340" },
  "C0X140": { id: "C0X140", name: "\u897F\u6E2F", parkId: "SinJi", location: "\u81FA\u5357\u5E02\u897F\u6E2F\u5340" },
  "467420": { id: "467420", name: "\u6C38\u5EB7", parkId: "SinJi", location: "\u81FA\u5357\u5E02\u6C38\u5EB7\u5340" },
  "467410": { id: "467410", name: "\u81FA\u5357", parkId: "SinJi", location: "\u81FA\u5357\u5E02\u4E2D\u897F\u5340" },
  "C0X190": { id: "C0X190", name: "\u5B89\u5E73", parkId: "SinJi", location: "\u81FA\u5357\u5E02\u5B89\u5E73\u5340" },
  "72N240": { id: "72N240", name: "\u4E03\u80A1", parkId: "SinJi", location: "\u81FA\u5357\u5E02\u4E03\u80A1\u5340" },
  // 臺南市其他常用工業區與重要行政區氣象測站
  "C0O900": { id: "C0O900", name: "\u5584\u5316", parkId: "all", location: "\u81FA\u5357\u5E02\u5584\u5316\u5340" },
  "C0O980": { id: "C0O980", name: "\u65B0\u5E02", parkId: "all", location: "\u81FA\u5357\u5E02\u65B0\u5E02\u5340" },
  "C0X080": { id: "C0X080", name: "\u4F73\u91CC", parkId: "all", location: "\u81FA\u5357\u5E02\u4F73\u91CC\u5340" },
  "C0X120": { id: "C0X120", name: "\u9EBB\u8C46", parkId: "all", location: "\u81FA\u5357\u5E02\u9EBB\u8C46\u5340" },
  "C0X160": { id: "C0X160", name: "\u4EC1\u5FB7", parkId: "all", location: "\u81FA\u5357\u5E02\u4EC1\u5FB7\u5340" },
  "C1N001": { id: "C1N001", name: "\u6B78\u4EC1\u6C99\u5D19", parkId: "all", location: "\u81FA\u5357\u5E02\u6B78\u4EC1\u5340" },
  "C0X170": { id: "C0X170", name: "\u95DC\u5EDF", parkId: "all", location: "\u81FA\u5357\u5E02\u95DC\u5EDF\u5340" },
  "C0X180": { id: "C0X180", name: "\u5C71\u4E0A", parkId: "all", location: "\u81FA\u5357\u5E02\u5C71\u4E0A\u5340" },
  "C0X220": { id: "C0X220", name: "\u5B78\u7532", parkId: "all", location: "\u81FA\u5357\u5E02\u5B78\u7532\u5340" },
  "C0X280": { id: "C0X280", name: "\u5C07\u8ECD", parkId: "all", location: "\u81FA\u5357\u5E02\u5C07\u8ECD\u5340" },
  "C0X290": { id: "C0X290", name: "\u5317\u9580", parkId: "all", location: "\u81FA\u5357\u5E02\u5317\u9580\u5340" },
  "C2O930": { id: "C2O930", name: "\u7389\u4E95", parkId: "all", location: "\u81FA\u5357\u5E02\u7389\u4E95\u5340" },
  "C1O921": { id: "C1O921", name: "\u6960\u897F", parkId: "all", location: "\u81FA\u5357\u5E02\u6960\u897F\u5340" },
  "C2O880": { id: "C2O880", name: "\u5357\u5316", parkId: "all", location: "\u81FA\u5357\u5E02\u5357\u5316\u5340" }
};
app.get("/api/proxy/cwa/stations", (_req, res) => {
  return res.json({
    success: true,
    source: "https://codis.cwa.gov.tw/StationData",
    defaultParkStationMap: {
      LiouYing: "C0X320",
      // 柳科工業區 -> 柳營測站 (C0X320)
      SinJi: "C2O950",
      // 新吉工業區 -> 安南測站 (C2O950)
      default: "C0X320"
    },
    stations: Object.values(CWA_STATIONS_DATA)
  });
});
async function fetchCodisPrecipitation(stationId, startPeriod, endPeriod) {
  const months = getMonthsRange(startPeriod, endPeriod);
  const candidateIds = [stationId];
  if (stationId === "C2X060") candidateIds.push("C0X060");
  else if (stationId === "C0X060") candidateIds.push("C2X060");
  else if (stationId === "C2O950") candidateIds.push("C0O950");
  else if (stationId === "C0O950") candidateIds.push("C2O950");
  else if (stationId === "C2O930") candidateIds.push("C0O930");
  else if (stationId === "C0O930") candidateIds.push("C2O930");
  else if (stationId === "C2O880") candidateIds.push("C0O830", "C1O880");
  else if (stationId === "C0O830") candidateIds.push("C2O880");
  const getCandidateTypes = (stn) => {
    if (stn.startsWith("46")) return ["cwb", "auto_C0"];
    if (stn.startsWith("C2") || stn.startsWith("72")) return ["agr", "auto_C0"];
    return ["auto_C0", "agr", "auto_C1", "cwb"];
  };
  const map = {};
  for (const mStr of months) {
    let monthFound = false;
    const [y, m] = mStr.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const startIso = `${mStr}-01T00:00:00`;
    const endIso = `${mStr}-${String(lastDay).padStart(2, "0")}T23:59:59`;
    for (const cId of candidateIds) {
      if (monthFound) break;
      const candidateTypes = getCandidateTypes(cId);
      for (const stnType of candidateTypes) {
        if (monthFound) break;
        try {
          const postBody = new URLSearchParams({
            stn_ID: cId,
            stn_type: stnType,
            type: "report_month",
            date: mStr,
            start: startIso,
            end: endIso
          }).toString();
          const codisRes = await fetch("https://codis.cwa.gov.tw/api/station", {
            method: "POST",
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
              "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
              "Accept": "application/json, text/javascript, */*; q=0.01",
              "Referer": "https://codis.cwa.gov.tw/StationData"
            },
            body: postBody
          });
          if (codisRes.ok) {
            const json = await codisRes.json();
            const dts = json?.data?.[0]?.dts;
            if (Array.isArray(dts) && dts.length > 0) {
              dts.forEach((d) => {
                if (d.DataDate) {
                  const clean = d.DataDate.split("T")[0].replace(/-/g, "/");
                  const accum = d.Precipitation?.Accumulation;
                  const hMax = d.Precipitation?.HourlyMaximum;
                  if (accum !== void 0 && accum !== null && !isNaN(Number(accum))) {
                    map[clean] = {
                      rainfall: Math.max(0, Number(accum)),
                      hourlyMax: hMax !== void 0 && hMax !== null && !isNaN(Number(hMax)) ? Math.max(0, Number(hMax)) : 0
                    };
                  }
                }
              });
              monthFound = true;
            }
          }
        } catch (e) {
        }
      }
    }
  }
  return map;
}
app.get("/api/proxy/cwa/rainfall", async (req, res) => {
  const stationId = req.query.stationId || "C0X320";
  const startDateParam = req.query.startDate || req.query.start || "";
  const endDateParam = req.query.endDate || req.query.end || "";
  let startPeriod = req.query.startPeriod || req.query.period || "";
  let endPeriod = req.query.endPeriod || startPeriod;
  if (startDateParam && !startPeriod) {
    startPeriod = startDateParam.slice(0, 7).replace(/\//g, "-");
  }
  if (endDateParam && !endPeriod) {
    endPeriod = endDateParam.slice(0, 7).replace(/\//g, "-");
  }
  if (!startPeriod) startPeriod = (/* @__PURE__ */ new Date()).toISOString().slice(0, 7);
  if (!endPeriod) endPeriod = startPeriod;
  const stationInfo = CWA_STATIONS_DATA[stationId] || {
    id: stationId,
    name: stationId,
    parkId: stationId === "C2O950" ? "SinJi" : "LiouYing",
    location: "\u81FA\u5357\u5E02"
  };
  try {
    const months = getMonthsRange(startPeriod, endPeriod);
    const codisMap = await fetchCodisPrecipitation(stationId, startPeriod, endPeriod);
    const hasCodisData = Object.keys(codisMap).length > 0;
    let records = [];
    for (const mStr of months) {
      const [year, month] = mStr.split("-").map(Number);
      const daysInMonth = new Date(year, month, 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
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
        let intensityLevel = "\u7121\u964D\u6C34";
        if (rainfall >= 350) intensityLevel = "\u8D85\u5927\u8C6A\u96E8";
        else if (rainfall >= 200) intensityLevel = "\u5927\u8C6A\u96E8";
        else if (rainfall >= 80) intensityLevel = "\u8C6A\u96E8";
        else if (rainfall >= 50) intensityLevel = "\u5927\u96E8";
        else if (rainfall >= 10) intensityLevel = "\u4E2D\u96E8";
        else if (rainfall > 0) intensityLevel = "\u5C0F\u96E8";
        records.push({
          date: dateStr,
          rainfall,
          hourlyMax,
          stationId,
          stationName: stationInfo.name,
          intensityLevel,
          isEstimated
        });
      }
    }
    if (startDateParam) {
      const sClean = startDateParam.replace(/-/g, "/");
      records = records.filter((r) => r.date >= sClean);
    }
    if (endDateParam) {
      const eClean = endDateParam.replace(/-/g, "/");
      records = records.filter((r) => r.date <= eClean);
    }
    const totalRainfall = Number(records.reduce((acc, cur) => acc + cur.rainfall, 0).toFixed(1));
    const rainyDays = records.filter((r) => r.rainfall >= 0.5).length;
    const heavyRainDays = records.filter((r) => r.rainfall >= 50).length;
    let maxDailyRain = 0;
    let maxDailyDate = "";
    records.forEach((r) => {
      if (r.rainfall > maxDailyRain) {
        maxDailyRain = r.rainfall;
        maxDailyDate = r.date;
      }
    });
    return res.json({
      success: true,
      source: "https://codis.cwa.gov.tw/StationData",
      stationId,
      stationName: stationInfo.name,
      location: stationInfo.location,
      startDate: records[0]?.date || startDateParam || startPeriod,
      endDate: records[records.length - 1]?.date || endDateParam || endPeriod,
      summary: {
        totalRainfall,
        rainyDays,
        totalDays: records.length,
        heavyRainDays,
        maxDailyRain,
        maxDailyDate
      },
      data: records
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: `\u64F7\u53D6\u6C23\u8C61\u7F72\u6E2C\u7AD9\u964D\u6C34\u91CF\u8CC7\u6599\u5931\u6557: ${err?.message}`
    });
  }
});
app.get("/api/proxy/cwa/rainfall/download.csv", async (req, res) => {
  const stationId = req.query.stationId || "C0X320";
  const startDateParam = req.query.startDate || "";
  const endDateParam = req.query.endDate || "";
  let startPeriod = req.query.startPeriod || (startDateParam ? startDateParam.slice(0, 7) : (/* @__PURE__ */ new Date()).toISOString().slice(0, 7));
  let endPeriod = req.query.endPeriod || (endDateParam ? endDateParam.slice(0, 7) : startPeriod);
  const stationInfo = CWA_STATIONS_DATA[stationId] || { id: stationId, name: stationId, parkId: "LiouYing", location: "\u81FA\u5357\u5E02" };
  const months = getMonthsRange(startPeriod, endPeriod);
  const codisMap = await fetchCodisPrecipitation(stationId, startPeriod, endPeriod);
  const hasCodisData = Object.keys(codisMap).length > 0;
  let records = [];
  for (const mStr of months) {
    const [year, month] = mStr.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
      let rainfall = 0;
      let hourlyMax = 0;
      if (codisMap[dateStr]) {
        rainfall = codisMap[dateStr].rainfall;
        hourlyMax = codisMap[dateStr].hourlyMax;
      } else if (hasCodisData) {
        rainfall = 0;
        hourlyMax = 0;
      } else {
        rainfall = 0;
        hourlyMax = 0;
      }
      let intensityLevel = "\u7121\u964D\u6C34";
      if (rainfall >= 350) intensityLevel = "\u8D85\u5927\u8C6A\u96E8";
      else if (rainfall >= 200) intensityLevel = "\u5927\u8C6A\u96E8";
      else if (rainfall >= 80) intensityLevel = "\u8C6A\u96E8";
      else if (rainfall >= 50) intensityLevel = "\u5927\u96E8";
      else if (rainfall >= 10) intensityLevel = "\u4E2D\u96E8";
      else if (rainfall > 0) intensityLevel = "\u5C0F\u96E8";
      records.push({ date: dateStr, rainfall, hourlyMax, intensityLevel });
    }
  }
  if (startDateParam) {
    const sClean = startDateParam.replace(/-/g, "/");
    records = records.filter((r) => r.date >= sClean);
  }
  if (endDateParam) {
    const eClean = endDateParam.replace(/-/g, "/");
    records = records.filter((r) => r.date <= eClean);
  }
  const parkLabel = stationInfo.parkId === "SinJi" ? "\u65B0\u5409\u5DE5\u696D\u5340" : "\u67F3\u79D1\u5DE5\u696D\u5340";
  const csvHeaders = ["\u6E2C\u7AD9\u4EE3\u78BC", "\u6E2C\u7AD9\u540D\u7A31", "\u89C0\u6E2C\u65E5\u671F", "\u65E5\u964D\u6C34\u91CF(mm)", "\u964D\u6C34\u5F37\u5EA6\u7B49\u7D1A", "\u6700\u5927\u6642\u964D\u6C34\u91CF(mm)", "\u5C0D\u61C9\u5712\u5340", "\u8CC7\u6599\u4F86\u6E90"];
  const csvRows = records.map((r) => [
    `"${stationId}"`,
    `"${stationInfo.name}"`,
    `"${r.date}"`,
    r.rainfall,
    `"${r.intensityLevel}"`,
    r.hourlyMax,
    `"${parkLabel}"`,
    `"https://codis.cwa.gov.tw/StationData"`
  ]);
  const csvContent = "\uFEFF" + [csvHeaders.join(","), ...csvRows.map((row) => row.join(","))].join("\n");
  const filename = `\u6C23\u8C61\u7F72CODIS\u964D\u6C34\u6578\u64DA_${stationInfo.name}(${stationId})_${startDateParam || startPeriod}_${endDateParam || endPeriod}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
  return res.send(csvContent);
});
app.get("/api/proxy/captcha", async (_req, res) => {
  const result = await forwardToGov("/Api/Token/Captcha", {
    method: "GET"
  });
  return res.status(result.status).json(result.data || { success: false, error: result.error });
});
app.post("/api/proxy/login", async (req, res) => {
  const { userName, password, captcha, captchaId, loginType = "sso" } = req.body;
  if (!userName || !password || !captcha || !captchaId) {
    return res.status(400).json({
      success: false,
      message: "\u8ACB\u586B\u5BEB\u5B8C\u6574\u5E33\u865F\u3001\u5BC6\u78BC\u8207\u9A57\u8B49\u78BC"
    });
  }
  const endpoint = loginType === "normal" ? "/Api/Token/SignIn" : "/Api/Token/Sso";
  const result = await forwardToGov(endpoint, {
    method: "POST",
    body: {
      userName: userName.trim(),
      qoo: password,
      captcha: captcha.trim(),
      captchaId: captchaId.trim()
    }
  });
  if (result.ok && result.data?.success) {
    return res.json({
      success: true,
      message: "\u767B\u5165\u6210\u529F",
      data: result.data.data
    });
  } else {
    return res.status(result.status || 400).json({
      success: false,
      message: result.data?.message || result.error || "\u767B\u5165\u5931\u6557\uFF0C\u8ACB\u78BA\u8A8D\u5E33\u865F\u5BC6\u78BC\u8207\u9A57\u8B49\u78BC\u662F\u5426\u6B63\u78BA",
      errorCode: result.data?.errorCode,
      raw: result.data
    });
  }
});
app.post("/api/proxy/verify-token", async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ success: false, message: "\u8ACB\u63D0\u4F9B Token" });
  }
  const result = await forwardToGov("/Api/WaterBilling/Query", {
    method: "GET",
    token,
    params: { pageSize: 1, currentPage: 1 }
  });
  if (result.status === 200 && result.data?.success) {
    return res.json({
      success: true,
      message: "Token \u9A57\u8B49\u6210\u529F\uFF0C\u9023\u7DDA\u6B63\u5E38",
      total: result.data.total,
      totalPages: result.data.totalPages
    });
  } else if (result.status === 401) {
    return res.status(401).json({
      success: false,
      message: "Token \u5DF2\u5931\u6548\u6216\u7121\u6388\u6B0A (HTTP 401)\uFF0C\u8ACB\u91CD\u65B0\u767B\u5165\u6216\u5F9E Edge DevTools \u53D6\u5F97\u6700\u65B0 Token"
    });
  } else {
    return res.status(result.status || 500).json({
      success: false,
      message: result.data?.message || result.error || `\u8ACB\u6C42\u5931\u6557 (HTTP ${result.status})`,
      raw: result.data
    });
  }
});
app.post("/api/proxy/query-vendors", async (req, res) => {
  const { token, pageSize = 20, currentPage = 1, parkId = "", keyword = "", isAbnormal = "", billingDate = "", sorting = "", sortingDesc = false } = req.body;
  const result = await forwardToGov("/Api/WaterBilling/Query", {
    method: "GET",
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
      isAdvSearch: true
    }
  });
  return res.status(result.status).json(result.data || { success: false, error: result.error });
});
app.post("/api/proxy/vendor-detail", async (req, res) => {
  const { token, waterId, period, sorting = "billingDate", sortingDesc = true } = req.body;
  if (!waterId) {
    return res.status(400).json({ success: false, message: "\u7F3A\u5C11 waterId" });
  }
  const periodVal = period || (/* @__PURE__ */ new Date()).toISOString().slice(0, 7);
  const result = await forwardToGov("/Api/WaterBilling/QueryMonth", {
    method: "GET",
    token,
    params: {
      waterId,
      period: periodVal,
      sorting,
      sortingDesc
    }
  });
  return res.status(result.status).json(result.data || { success: false, error: result.error });
});
function getMonthsRange(start, end) {
  const s = start <= end ? start : end;
  const e = start <= end ? end : start;
  const [sY, sM] = s.split("-").map(Number);
  const [eY, eM] = e.split("-").map(Number);
  const months = [];
  let curY = sY;
  let curM = sM;
  while (curY < eY || curY === eY && curM <= eM) {
    months.push(`${curY}-${String(curM).padStart(2, "0")}`);
    curM++;
    if (curM > 12) {
      curM = 1;
      curY++;
    }
  }
  return months;
}
app.get("/api/proxy/batch-crawl-stream", async (req, res) => {
  const token = req.query.token || "";
  const parkId = req.query.parkId || "";
  const keyword = req.query.keyword || "";
  const maxPages = Number(req.query.maxPages) || 10;
  const startPeriod = req.query.startPeriod || req.query.period || (/* @__PURE__ */ new Date()).toISOString().slice(0, 7);
  const endPeriod = req.query.endPeriod || startPeriod;
  const targetMonths = getMonthsRange(startPeriod, endPeriod);
  const newestMonth = targetMonths[targetMonths.length - 1];
  if (!token) {
    return res.status(400).json({ success: false, message: "\u7F3A\u5C11 Token" });
  }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  const sendEvt = (type, data) => {
    res.write(`event: ${type}
data: ${JSON.stringify(data)}

`);
  };
  try {
    sendEvt("status", { message: "\u6B63\u5728\u53D6\u5F97\u6C34\u9336\u5EE0\u5546\u5217\u8868\u7B2C\u4E00\u9801\u8207\u7E3D\u9801\u6578...", progress: 5 });
    const firstPageRes = await forwardToGov("/Api/WaterBilling/Query", {
      method: "GET",
      token,
      params: {
        pageSize: 50,
        currentPage: 1,
        parkId,
        keyword,
        isAdvSearch: true
      }
    });
    if (!firstPageRes.ok || !firstPageRes.data?.success) {
      sendEvt("error", {
        message: firstPageRes.data?.message || firstPageRes.error || `\u7121\u6CD5\u53D6\u5F97\u5EE0\u5546\u5217\u8868 (HTTP ${firstPageRes.status})`
      });
      return res.end();
    }
    const totalPages = Math.min(firstPageRes.data.totalPages || 1, maxPages);
    const totalCount = firstPageRes.data.total || 0;
    const allVendors = [...firstPageRes.data.data || []];
    sendEvt("status", {
      message: `\u5DF2\u53D6\u5F97\u7B2C 1/${totalPages} \u9801\uFF0C\u5E73\u81FA\u7DDA\u4E0A\u5171 ${totalCount} \u7B46\u6C34\u9336\u8CC7\u6599`,
      progress: 15,
      totalCount,
      totalPages
    });
    for (let p = 2; p <= totalPages; p++) {
      sendEvt("status", { message: `\u6B63\u5728\u53D6\u5F97\u7B2C ${p}/${totalPages} \u9801\u5EE0\u5546\u5217\u8868...`, progress: 15 + Math.floor(p / totalPages * 15) });
      const pRes = await forwardToGov("/Api/WaterBilling/Query", {
        method: "GET",
        token,
        params: {
          pageSize: 50,
          currentPage: p,
          parkId,
          keyword,
          isAdvSearch: true
        }
      });
      if (pRes.ok && pRes.data?.data) {
        allVendors.push(...pRes.data.data);
      }
    }
    sendEvt("status", {
      message: `\u6C34\u9336\u6E05\u55AE\u64F7\u53D6\u5B8C\u6210\uFF0C\u5171\u8A08 ${allVendors.length} \u7B46\u6C34\u9336\u3002\u958B\u59CB\u64F7\u53D6\u5340\u9593\uFF08${startPeriod} ~ ${endPeriod}\uFF0C\u5171 ${targetMonths.length} \u500B\u6708\uFF09\u6BCF\u65E5\u6C61\u6C34\u91CF\u3001\u672C\u6708\u7D2F\u7A4D\u91CF\u3001\u6C61\u81EA\u6BD4\u8207\u6700\u65B0\u6708\uFF08${newestMonth}\uFF09\u524D12\u500B\u6708\u65E5\u5747\u91CF...`,
      progress: 30,
      totalVendors: allVendors.length,
      targetMonths
    });
    const results = [];
    const concurrency = 2;
    let processed = 0;
    for (let i = 0; i < allVendors.length; i += concurrency) {
      const chunk = allVendors.slice(i, i + concurrency);
      const chunkPromises = chunk.map(async (vendor) => {
        try {
          let latestTwelveAvg = null;
          let twelveMonthDays = [];
          const allWaterBillingDays = [];
          let totalPeriodWw = 0;
          let totalPeriodWater = 0;
          let hasAnyMonthData = false;
          let latestBillingId = "";
          for (const mStr of [...targetMonths].reverse()) {
            const detailRes = await forwardToGov("/Api/WaterBilling/QueryMonth", {
              method: "GET",
              token,
              params: {
                waterId: vendor.waterId,
                period: mStr,
                sorting: "billingDate",
                sortingDesc: true
              }
            });
            if (detailRes.ok && detailRes.data?.success && detailRes.data.data) {
              const d = detailRes.data.data;
              hasAnyMonthData = true;
              if (!latestBillingId && d.billingId) latestBillingId = d.billingId;
              if (mStr === newestMonth && d.twelveAvg !== void 0 && d.twelveAvg !== null) {
                latestTwelveAvg = Number(d.twelveAvg);
              } else if (latestTwelveAvg === null && d.twelveAvg !== void 0 && d.twelveAvg !== null) {
                latestTwelveAvg = Number(d.twelveAvg);
              }
              if (twelveMonthDays.length === 0 && Array.isArray(d.twelveMonthDays)) {
                twelveMonthDays = d.twelveMonthDays.map((item) => ({
                  year: item.year,
                  month: item.month,
                  date: `${item.year}/${String(item.month).padStart(2, "0")}`,
                  avgDayWwVolume: item.avgDayWwVolume !== null ? Number(item.avgDayWwVolume) : 0
                }));
              }
              if (Array.isArray(d.waterBillingDays)) {
                d.waterBillingDays.forEach((item) => {
                  allWaterBillingDays.push({
                    dayBillingId: item.dayBillingId,
                    billingDate: item.billingDate || "",
                    dayWwVolume: item.dayWwVolume !== null && item.dayWwVolume !== void 0 ? Number(item.dayWwVolume) : null,
                    dayWaterVolume: item.dayWaterVolume !== null && item.dayWaterVolume !== void 0 ? Number(item.dayWaterVolume) : null,
                    wwAccumulate: item.wwAccumulate !== null && item.wwAccumulate !== void 0 ? Number(item.wwAccumulate) : null,
                    waterAccumulate: item.waterAccumulate !== null && item.waterAccumulate !== void 0 ? Number(item.waterAccumulate) : null,
                    remark: item.remark || "",
                    isModifyWwWater: !!item.isModifyWwWater,
                    isModifyWater: !!item.isModifyWater
                  });
                });
              }
              if (d.wwVolume !== void 0 && d.wwVolume !== null) totalPeriodWw += Number(d.wwVolume);
              if (d.waterVolume !== void 0 && d.waterVolume !== null) totalPeriodWater += Number(d.waterVolume);
            }
          }
          const dayMap = /* @__PURE__ */ new Map();
          allWaterBillingDays.forEach((item) => {
            const key = item.billingDate || item.dayBillingId;
            if (key && !dayMap.has(key)) {
              dayMap.set(key, item);
            }
          });
          const deduplicatedDays = Array.from(dayMap.values());
          if (totalPeriodWw === 0 && deduplicatedDays.length > 0) {
            totalPeriodWw = deduplicatedDays.reduce((acc, cur) => acc + (cur.dayWwVolume || 0), 0);
          }
          if (totalPeriodWater === 0 && deduplicatedDays.length > 0) {
            totalPeriodWater = deduplicatedDays.reduce((acc, cur) => acc + (cur.dayWaterVolume || 0), 0);
          }
          let ratio = null;
          if (totalPeriodWw > 0 && totalPeriodWater > 0) {
            ratio = Number((totalPeriodWw / totalPeriodWater).toFixed(4));
          } else if (vendor.wwVolume && vendor.waterVolume && Number(vendor.waterVolume) > 0) {
            ratio = Number((Number(vendor.wwVolume) / Number(vendor.waterVolume)).toFixed(4));
          }
          const curWwVolume = hasAnyMonthData ? totalPeriodWw : vendor.wwVolume !== void 0 && vendor.wwVolume !== null ? Number(vendor.wwVolume) : null;
          const curWaterVolume = hasAnyMonthData ? totalPeriodWater : vendor.waterVolume !== void 0 && vendor.waterVolume !== null ? Number(vendor.waterVolume) : null;
          return {
            waterId: vendor.waterId,
            parkName: vendor.parkName || "\u672A\u6307\u5B9A\u5DE5\u696D\u5340",
            name: vendor.name || "\u672A\u77E5\u5EE0\u5546",
            waterName: vendor.waterName || "\u6C34\u9336",
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
            extractedAt: (/* @__PURE__ */ new Date()).toISOString()
          };
        } catch (err) {
          return {
            waterId: vendor.waterId,
            parkName: vendor.parkName || "\u672A\u6307\u5B9A\u5DE5\u696D\u5340",
            name: vendor.name || "\u672A\u77E5\u5EE0\u5546",
            waterName: vendor.waterName || "\u6C34\u9336",
            billingDate: vendor.billingDate || "",
            twelveAvg: null,
            wwVolume: null,
            waterVolume: null,
            ratio: null,
            error: err?.message || "\u8B80\u53D6\u5931\u6557",
            extractedAt: (/* @__PURE__ */ new Date()).toISOString()
          };
        }
      });
      const chunkResults = await Promise.all(chunkPromises);
      for (const item of chunkResults) {
        results.push(item);
        processed++;
        sendEvt("item", {
          item,
          processed,
          total: allVendors.length,
          progress: 30 + Math.floor(processed / allVendors.length * 65)
        });
      }
      await new Promise((r) => setTimeout(r, 60));
    }
    sendEvt("complete", {
      message: `\u722C\u53D6\u5B8C\u6210\uFF01\u5171\u6210\u529F\u64F7\u53D6 ${results.length} \u7B46\u6C34\u9336\u5EE0\u5546\u5340\u9593\u6578\u64DA\uFF08\u542B ${startPeriod} ~ ${endPeriod} \u6BCF\u65E5\u6578\u64DA\u3001\u6700\u65B0\u6708 ${newestMonth} \u524D12\u500B\u6708\u65E5\u5747\u503C\uFF09\u3002`,
      progress: 100,
      count: results.length,
      data: results
    });
    res.end();
  } catch (error) {
    sendEvt("error", { message: error?.message || "\u4F3A\u670D\u5668\u57F7\u884C\u722C\u53D6\u6642\u767C\u751F\u7570\u5E38" });
    res.end();
  }
});
app.get("/api/download/local-package", (_req, res) => {
  const possiblePaths = [
    path.resolve(__dirname, "tainan-sewage-system-local.zip"),
    path.resolve(__dirname, "public", "tainan-sewage-system-local.zip"),
    path.resolve(process.cwd(), "tainan-sewage-system-local.zip")
  ];
  const zipPath = possiblePaths.find((p) => fs.existsSync(p));
  if (zipPath) {
    res.download(zipPath, "tainan-sewage-system-local.zip");
  } else {
    res.status(404).json({ error: "\u672C\u5730\u57F7\u884C\u5305\u6B63\u5728\u6253\u5305\u4E2D\u6216\u5C1A\u672A\u751F\u6210\uFF0C\u8ACB\u7A0D\u5019\u91CD\u8A66" });
  }
});
async function startServer() {
  const rootDist = path.resolve(__dirname, "dist");
  const hasDist = fs.existsSync(path.resolve(rootDist, "index.html")) || fs.existsSync(path.resolve(__dirname, "index.html"));
  const isDev = process.env.NODE_ENV === "development";
  if (isDev || !hasDist && process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = fs.existsSync(rootDist) ? rootDist : __dirname;
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}
startServer();
