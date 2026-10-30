import React, { useState, useEffect, useMemo } from 'react';
import {
  CloudRain,
  Download,
  Calendar,
  ExternalLink,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Droplet,
  Layers,
  Building2,
  ArrowUpDown,
  FileSpreadsheet,
} from 'lucide-react';
import { CWA_WEATHER_STATIONS } from '../data/weatherStations';
import { RainfallRecord, VendorSewageData } from '../types';

interface CodisRainfallPanelProps {
  vendorsData?: VendorSewageData[];
  selectedParkFilter?: string;
  onApplyRainfallToCharts?: (stationId: string, records: RainfallRecord[]) => void;
  appliedStationId?: string;
}

export const CodisRainfallPanel: React.FC<CodisRainfallPanelProps> = ({
  vendorsData = [],
  selectedParkFilter,
  onApplyRainfallToCharts,
  appliedStationId,
}) => {
  // 1. 計算水錶現有數據之最早與最晚日期，做為預設/快捷填選依據
  const meterDateRange = useMemo(() => {
    const dates: string[] = [];
    vendorsData.forEach((v) => {
      (v.waterBillingDays || []).forEach((d) => {
        if (d.billingDate) {
          const clean = d.billingDate.split('T')[0].split(' ')[0].replace(/\//g, '-');
          if (clean.length === 10) dates.push(clean);
        }
      });
    });
    if (dates.length > 0) {
      dates.sort();
      return { start: dates[0], end: dates[dates.length - 1] };
    }
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = today.slice(0, 8) + '01';
    return { start: monthStart, end: today };
  }, [vendorsData]);

  // 測站選擇 (優先採用上層目前作用測站，其次依工業區：柳科 -> 柳營 C0X320；新吉 -> 安南 C2O950)
  const defaultStation = useMemo(() => {
    if (appliedStationId) return appliedStationId;
    if (selectedParkFilter) {
      if (selectedParkFilter.includes('柳') || selectedParkFilter.toLowerCase().includes('liou')) return 'C0X320';
      if (selectedParkFilter.includes('新吉') || selectedParkFilter.toLowerCase().includes('sinji')) return 'C2O950';
    }
    return 'C0X320';
  }, [appliedStationId, selectedParkFilter]);

  const [stationId, setStationId] = useState<string>(defaultStation);
  const [customStation, setCustomStation] = useState<string>('');
  const [useCustomStation, setUseCustomStation] = useState<boolean>(false);

  // 填選年月日 (精確到日)
  const [startDate, setStartDate] = useState<string>(meterDateRange.start);
  const [endDate, setEndDate] = useState<string>(meterDateRange.end);

  // 當水錶資料區間載入或變更時，自動精確同步填選起始與結束年月日
  useEffect(() => {
    if (meterDateRange.start && meterDateRange.end) {
      setStartDate(meterDateRange.start);
      setEndDate(meterDateRange.end);
    }
  }, [meterDateRange.start, meterDateRange.end]);

  // 當預設測站變更時同步更新
  useEffect(() => {
    if (defaultStation && !useCustomStation) {
      setStationId(defaultStation);
    }
  }, [defaultStation, useCustomStation]);

  // 查詢狀態與數據
  const [loading, setLoading] = useState<boolean>(false);
  const [records, setRecords] = useState<RainfallRecord[]>([]);
  const [summary, setSummary] = useState<{
    totalRainfall: number;
    rainyDays: number;
    totalDays: number;
    heavyRainDays: number;
    maxDailyRain: number;
    maxDailyDate: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // 取得目前作用測站的資訊
  const currentStationInfo = useMemo(() => {
    const targetId = useCustomStation ? customStation.trim() : stationId;
    const found = CWA_WEATHER_STATIONS.find((s) => s.id === targetId);
    if (found) return found;
    return {
      id: targetId || 'C0X320',
      name: `${targetId || '自訂測站'}`,
      stnType: 'auto',
      parkId: 'all' as const,
      desc: '中央氣象署觀測測站',
    };
  }, [stationId, customStation, useCustomStation]);

  // 查詢氣象署 CODIS 降水數據
  const handleFetchRainfall = async () => {
    const activeId = useCustomStation ? customStation.trim() : stationId;
    if (!activeId) {
      setErrorMsg('請選擇或填寫氣象測站代碼！');
      return;
    }
    if (!startDate || !endDate) {
      setErrorMsg('請填選完整的起始年月日與結束年月日！');
      return;
    }
    if (startDate > endDate) {
      setErrorMsg('起始日期不可大於結束日期！');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const url = `/api/proxy/cwa/rainfall?stationId=${encodeURIComponent(activeId)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
      const res = await fetch(url);
      const json = await res.json();

      if (json.success && Array.isArray(json.data)) {
        setRecords(json.data);
        setSummary(json.summary || null);
        setHasSearched(true);
      } else {
        setErrorMsg(json.message || '查詢氣象署測站降水資料失敗');
      }
    } catch (err: any) {
      setErrorMsg(`連線查詢失敗: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  // 首次載入或測站預設值變動時自動查詢
  useEffect(() => {
    handleFetchRainfall();
  }, [stationId, startDate, endDate]);

  // 快捷區間填選
  const setPresetRange = (type: 'meters' | 'thisMonth' | 'lastMonth' | 'last30Days') => {
    const now = new Date();
    if (type === 'meters') {
      setStartDate(meterDateRange.start);
      setEndDate(meterDateRange.end);
    } else if (type === 'thisMonth') {
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      setStartDate(`${y}-${m}-01`);
      setEndDate(now.toISOString().slice(0, 10));
    } else if (type === 'lastMonth') {
      const prev = new Date(now.getFullYear(), now.getMonth(), 0);
      const y = prev.getFullYear();
      const m = String(prev.getMonth() + 1).padStart(2, '0');
      const lastDay = prev.getDate();
      setStartDate(`${y}-${m}-01`);
      setEndDate(`${y}-${m}-${String(lastDay).padStart(2, '0')}`);
    } else if (type === 'last30Days') {
      const past = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
      setStartDate(past.toISOString().slice(0, 10));
      setEndDate(now.toISOString().slice(0, 10));
    }
  };

  // 下載 Excel (CSV with UTF-8 BOM)
  const handleDownloadCSV = () => {
    if (records.length === 0) {
      alert('目前無降水數據可供下載，請先點擊「查詢降水量」！');
      return;
    }

    const activeId = useCustomStation ? customStation.trim() : stationId;
    const parkLabel = currentStationInfo.parkId === 'SinJi' ? '新吉工業區' : currentStationInfo.parkId === 'LiouYing' ? '柳科工業區' : '臺南工業區周邊';

    const headers = [
      '測站代碼',
      '測站名稱',
      '觀測日期',
      '日降水量 (mm)',
      '降水強度等級',
      '最大時降水量 (mm/hr)',
      '對應工業區',
      '資料來源',
    ];

    const rows = records.map((r) => {
      let intensity = '無降水';
      if (r.rainfall >= 350) intensity = '超大豪雨';
      else if (r.rainfall >= 200) intensity = '大豪雨';
      else if (r.rainfall >= 80) intensity = '豪雨';
      else if (r.rainfall >= 50) intensity = '大雨';
      else if (r.rainfall >= 10) intensity = '中雨';
      else if (r.rainfall > 0) intensity = '小雨';

      return [
        `"${activeId}"`,
        `"${currentStationInfo.name}"`,
        `"${r.date}"`,
        r.rainfall !== undefined && r.rainfall !== null ? r.rainfall : 0,
        `"${intensity}"`,
        r.hourlyMax !== undefined && r.hourlyMax !== null ? r.hourlyMax : 0,
        `"${parkLabel}"`,
        `"https://codis.cwa.gov.tw/StationData"`,
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const cleanS = startDate.replace(/-/g, '');
    const cleanE = endDate.replace(/-/g, '');
    link.download = `氣象署CODIS降水數據_${currentStationInfo.name}(${activeId})_${cleanS}-${cleanE}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 排序每日數據
  const displayRecords = useMemo(() => {
    return [...records].sort((a, b) => {
      return sortAsc ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
    });
  }, [records, sortAsc]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      {/* 標頭說明與 CODIS 官方連結 */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <CloudRain className="w-5 h-5 text-sky-400" />
            <h3 className="text-base font-bold text-white">
              中央氣象署 CODIS 測站降水觀測數據下載與關聯分析
            </h3>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/30">
              CODIS StationData
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            資料介接自交通部中央氣象署（CWA）觀測資料查詢系統。支援填選各測站與精確年月日區間，提供日雨量統計、Excel 報表匯出與水錶排放關聯性檢核。
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={`https://codis.cwa.gov.tw/StationData`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-sky-300 border border-sky-500/30 text-xs font-medium transition-all"
            title="前往中央氣象署 CODIS 官方觀測資料查詢系統"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>開啟 CODIS 官網</span>
          </a>
        </div>
      </div>

      {/* 填選控制面板：測站選擇 + 年月日填選 + 快捷區間 */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 text-xs">
          {/* 1. 測站選擇 */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-semibold flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-sky-400" />
                觀測氣象測站
              </span>
              <button
                type="button"
                onClick={() => setUseCustomStation(!useCustomStation)}
                className="text-[11px] text-cyan-400 hover:underline"
              >
                {useCustomStation ? '切換選單' : '自訂代碼'}
              </button>
            </label>

            {useCustomStation ? (
              <input
                type="text"
                placeholder="輸入測站代碼 (如 C0X320、C2O950)"
                value={customStation}
                onChange={(e) => setCustomStation(e.target.value.toUpperCase())}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono uppercase"
              />
            ) : (
              <select
                value={stationId}
                onChange={(e) => setStationId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-medium"
              >
                <optgroup label="工業區主要首選測站">
                  <option value="C0X320">柳營 (C0X320) · 柳科工業區主要測站</option>
                  <option value="C2O950">安南 (C2O950) · 新吉工業區主要測站</option>
                  <option value="C0X150">安定 (C0X150) · 安定/新吉交界首要測站</option>
                  <option value="C0X250">新營 (C0X250) · 鄰近柳科/新營主要測站</option>
                </optgroup>
                <optgroup label="臺南標準氣象站 / 有人氣象站">
                  <option value="467420">永康 (467420) · 永康有人標準氣象站</option>
                  <option value="467410">臺南 (467410) · 臺南歷史標準氣象站</option>
                </optgroup>
                <optgroup label="臺南各主要行政區氣象測站">
                  <option value="C0N020">城西 (C0N020) · 安南區城西雨量站</option>
                  <option value="C0N030">四草 (C0N030) · 安南區四草測站</option>
                  <option value="C0O900">善化 (C0O900) · 南科善化核心測站</option>
                  <option value="C0O980">新市 (C0O980) · 南科新市測站</option>
                  <option value="C2X060">下營 (C2X060 / C0X060) · 下營測站 (新舊站相容)</option>
                  <option value="C0X130">官田 (C0X130) · 官田/六甲測站</option>
                  <option value="C1X040">東山東原 (C1X040) · 東山測站</option>
                  <option value="C0X210">白河 (C0X210) · 白河測站</option>
                  <option value="C0X260">後壁 (C0X260) · 後壁蘭花園區測站</option>
                  <option value="C0X230">鹽水 (C0X230) · 鹽水測站</option>
                  <option value="C0X140">西港 (C0X140) · 西港測站</option>
                  <option value="C0X080">佳里 (C0X080) · 佳里測站</option>
                  <option value="C0X120">麻豆 (C0X120) · 麻豆測站</option>
                  <option value="C0X160">仁德 (C0X160) · 仁德測站</option>
                  <option value="C0X190">安平 (C0X190) · 安平測站</option>
                  <option value="72N240">七股 (72N240) · 七股研究中心測站</option>
                  <option value="C1N001">歸仁沙崙 (C1N001) · 綠能科學城測站</option>
                  <option value="C0X220">學甲 (C0X220) · 學甲測站</option>
                  <option value="C2O930">玉井 (C2O930 / C0O930) · 玉井農業測站</option>
                  <option value="C1O921">楠西 (C1O921) · 楠西曾文水庫測站</option>
                  <option value="C0O830">南化北寮 (C0O830 / C2O880) · 南化測站</option>
                </optgroup>
              </select>
            )}
            <div className="text-[11px] text-slate-400 truncate">
              {currentStationInfo.desc || `測站位置: ${currentStationInfo.name}`}
            </div>
          </div>

          {/* 2. 填選起始年月日 */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-semibold flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-sky-400" />
              填選起始日期 (年/月/日)
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
            />
            <div className="text-[11px] text-slate-400">格式：YYYY-MM-DD</div>
          </div>

          {/* 3. 填選結束年月日 */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-semibold flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-sky-400" />
              填選結束日期 (年/月/日)
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
            />
            <div className="text-[11px] text-slate-400">格式：YYYY-MM-DD</div>
          </div>

          {/* 4. 操作按鈕 */}
          <div className="flex flex-col justify-end space-y-2">
            <button
              onClick={handleFetchRainfall}
              disabled={loading}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold transition-all shadow-md disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>查詢中...</span>
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" />
                  <span>查詢降水量</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownloadCSV}
              disabled={loading || records.length === 0}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl bg-emerald-600/25 hover:bg-emerald-600/35 text-emerald-300 border border-emerald-500/40 font-bold transition-all shadow-sm disabled:opacity-40"
              title="匯出並下載所選測站與年月日區間之降水數據 Excel 表 (CSV UTF-8 BOM)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>下載降水 Excel (CSV)</span>
            </button>
          </div>
        </div>

        {/* 快捷區間填選鈕 */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/80 text-xs text-slate-400">
          <span className="font-semibold text-slate-300">快速填選區間：</span>
          <button
            type="button"
            onClick={() => setPresetRange('meters')}
            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 hover:border-sky-500/50 transition-colors"
          >
            水錶抄錶區間 ({meterDateRange.start} ~ {meterDateRange.end})
          </button>
          <button
            type="button"
            onClick={() => setPresetRange('thisMonth')}
            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 hover:border-sky-500/50 transition-colors"
          >
            本月迄今
          </button>
          <button
            type="button"
            onClick={() => setPresetRange('lastMonth')}
            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 hover:border-sky-500/50 transition-colors"
          >
            上個月全月
          </button>
          <button
            type="button"
            onClick={() => setPresetRange('last30Days')}
            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 hover:border-sky-500/50 transition-colors"
          >
            最近 30 天
          </button>

          {onApplyRainfallToCharts && records.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const activeId = useCustomStation ? customStation.trim() : stationId;
                onApplyRainfallToCharts(activeId, records);
              }}
              className="ml-auto px-3 py-1 rounded-lg bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-cyan-500/40 font-bold transition-all flex items-center gap-1.5"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>
                {appliedStationId === (useCustomStation ? customStation.trim() : stationId)
                  ? '✓ 已套用至折線圖'
                  : '套用至水錶折線圖比對'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* 錯誤警示提示 */}
      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 統計摘要資訊卡片 */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 space-y-1">
            <span className="text-slate-400">區間累積總降水量</span>
            <div className="text-base sm:text-lg font-bold text-sky-400 font-mono">
              {summary.totalRainfall.toLocaleString()} <span className="text-xs text-slate-400">mm</span>
            </div>
            <span className="text-[10px] text-slate-500">
              統計天數：{summary.totalDays} 天
            </span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 space-y-1">
            <span className="text-slate-400">降水日數 / 降水率</span>
            <div className="text-base sm:text-lg font-bold text-cyan-300 font-mono">
              {summary.rainyDays} <span className="text-xs text-slate-400">天</span>
              <span className="text-xs text-slate-400 ml-1.5 font-normal">
                ({summary.totalDays > 0 ? ((summary.rainyDays / summary.totalDays) * 100).toFixed(1) : 0}%)
              </span>
            </div>
            <span className="text-[10px] text-slate-500">標準：日降水量 ≥ 0.5 mm</span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 space-y-1">
            <span className="text-slate-400">單日最高降水量</span>
            <div className="text-base sm:text-lg font-bold text-amber-300 font-mono">
              {summary.maxDailyRain} <span className="text-xs text-slate-400">mm</span>
            </div>
            <span className="text-[10px] text-slate-400">
              發生日期：{summary.maxDailyDate || '-'}
            </span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 space-y-1">
            <span className="text-slate-400">豪大雨警示日數</span>
            <div className={`text-base sm:text-lg font-bold font-mono ${
              summary.heavyRainDays > 0 ? 'text-rose-400' : 'text-emerald-400'
            }`}>
              {summary.heavyRainDays} <span className="text-xs text-slate-400">天</span>
            </div>
            <span className="text-[10px] text-slate-500">標準：日降水量 ≥ 50 mm (大雨/豪雨)</span>
          </div>
        </div>
      )}

      {/* 每日降水量數據明細表 */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-xl overflow-hidden text-xs">
        <div className="p-3 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
          <div className="font-semibold text-white flex items-center gap-2">
            <Droplet className="w-4 h-4 text-sky-400" />
            <span>
              {currentStationInfo.name} ({currentStationInfo.id}) 每日降水明細表 ({displayRecords.length} 筆)
            </span>
          </div>

          <button
            type="button"
            onClick={() => setSortAsc(!sortAsc)}
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white"
          >
            <ArrowUpDown className="w-3 h-3" />
            <span>日期排序：{sortAsc ? '由早到晚 (舊至新)' : '由晚到早 (新至舊)'}</span>
          </button>
        </div>

        {displayRecords.length > 0 ? (
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-900/90 sticky top-0 border-b border-slate-800 text-[11px] text-slate-400 font-semibold">
                <tr>
                  <th className="py-2.5 px-3">觀測日期</th>
                  <th className="py-2.5 px-3">測站名稱 (代碼)</th>
                  <th className="py-2.5 px-3 text-right">日降水量 (mm)</th>
                  <th className="py-2.5 px-3 text-right">最高時降水量 (mm/hr)</th>
                  <th className="py-2.5 px-3 text-center">降水等級燈號</th>
                  <th className="py-2.5 px-3">水錶檢核備註</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                {displayRecords.map((r, idx) => {
                  let badgeColor = 'bg-slate-800 text-slate-400 border-slate-700';
                  let level = '無降水';

                  if (r.rainfall >= 350) {
                    level = '超大豪雨 (≥350mm)';
                    badgeColor = 'bg-purple-950/80 text-purple-300 border-purple-500/50 font-bold';
                  } else if (r.rainfall >= 200) {
                    level = '大豪雨 (≥200mm)';
                    badgeColor = 'bg-rose-950/80 text-rose-300 border-rose-500/50 font-bold';
                  } else if (r.rainfall >= 80) {
                    level = '豪雨 (≥80mm)';
                    badgeColor = 'bg-red-950/80 text-red-300 border-red-500/50 font-bold';
                  } else if (r.rainfall >= 50) {
                    level = '大雨 (≥50mm)';
                    badgeColor = 'bg-amber-950/80 text-amber-300 border-amber-500/50 font-semibold';
                  } else if (r.rainfall >= 10) {
                    level = '中雨 (10~50mm)';
                    badgeColor = 'bg-sky-950/80 text-sky-300 border-sky-500/50';
                  } else if (r.rainfall > 0) {
                    level = '小雨 (<10mm)';
                    badgeColor = 'bg-blue-950/60 text-blue-300 border-blue-500/30';
                  }

                  const isHighRain = r.rainfall >= 50;

                  return (
                    <tr
                      key={idx}
                      className={`hover:bg-slate-900/60 transition-colors ${
                        isHighRain ? 'bg-amber-950/15' : ''
                      }`}
                    >
                      <td className="py-2 px-3 font-semibold text-white whitespace-nowrap">
                        {r.date}
                      </td>
                      <td className="py-2 px-3 text-slate-400 font-sans whitespace-nowrap">
                        {currentStationInfo.name} ({currentStationInfo.id})
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-sky-300">
                        {r.rainfall !== undefined && r.rainfall !== null ? r.rainfall.toFixed(1) : '0.0'}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-400">
                        {r.hourlyMax !== undefined && r.hourlyMax !== null ? r.hourlyMax.toFixed(1) : '-'}
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] border ${badgeColor}`}>
                          {level}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-400 font-sans text-[11px]">
                        {isHighRain
                          ? '⚠ 強降水日：若水錶污水突增，需查核廠區是否雨污混流或雨水滲入'
                          : r.rainfall > 0
                          ? '有降水紀錄'
                          : '無降水乾燥天'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-500">
            {loading ? '正在連線交通部中央氣象署 CODIS 抓取測站降水資料...' : '尚未有降水數據，請點擊上方「查詢降水量」'}
          </div>
        )}
      </div>
    </div>
  );
};
