import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Droplets,
  Gauge,
  AlertTriangle,
  Calendar,
  Layers,
  Building2,
  Zap,
  Activity,
  CheckCircle2,
  Info,
  CloudRain,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Search,
  X,
} from 'lucide-react';
import { VendorSewageData, DailyBillingRecord, RainfallRecord } from '../types';
import { CWA_WEATHER_STATIONS } from '../data/weatherStations';
import { CodisRainfallPanel } from './CodisRainfallPanel';

interface ChartsViewProps {
  data: VendorSewageData[];
  selectedParkFilter?: string;
  onSelectVendor?: (vendor: VendorSewageData) => void;
  stationRainfallMap?: Record<string, Record<string, number>>;
  stationRainfallRecords?: Record<string, RainfallRecord[]>;
  parkStationMap?: Record<string, string>;
  onUpdateParkStation?: (parkKey: string, stationId: string) => void;
  onFetchStationRainfall?: (stationId: string) => void;
}

/**
 * 輔助函式：確保日期格式純淨（僅包含年月日，例如 2026/09/01 或 09/01，不包含任何時間字串）
 */
function cleanDateOnly(dStr: string): string {
  if (!dStr) return '';
  let datePart = dStr.split('T')[0].split(' ')[0].trim();
  datePart = datePart.replace(/-/g, '/');
  return datePart;
}

export const ChartsView: React.FC<ChartsViewProps> = ({
  data,
  selectedParkFilter,
  onSelectVendor,
  stationRainfallMap,
  stationRainfallRecords,
  parkStationMap,
  onUpdateParkStation,
  onFetchStationRainfall,
}) => {
  const [activeTab, setActiveTab] = useState<'dailyLine' | 'vendorLine' | 'anomalyAnalysis' | 'codisRainfall'>('dailyLine');
  const [selectedVendorId, setSelectedVendorId] = useState<string>(data[0]?.waterId || '');
  const [showDetailedLegend, setShowDetailedLegend] = useState<boolean>(true);
  const [userSelectedStation, setUserSelectedStation] = useState<string>('');
  const [meterSearchQuery, setMeterSearchQuery] = useState<string>('');

  // 依文字搜尋篩選水錶清單 (支援搜尋廠商名稱、水錶名稱、水錶編號或所屬工業區)
  const filteredMeters = useMemo(() => {
    if (!meterSearchQuery.trim()) return data;
    const q = meterSearchQuery.trim().toLowerCase();
    return data.filter((v) => {
      const matchName = (v.name || '').toLowerCase().includes(q);
      const matchWaterName = (v.waterName || '').toLowerCase().includes(q);
      const matchId = (v.waterId || '').toLowerCase().includes(q);
      const matchPark = (v.parkName || '').toLowerCase().includes(q);
      return matchName || matchWaterName || matchId || matchPark;
    });
  }, [data, meterSearchQuery]);

  // Selected vendor (優先使用目前選取的水錶，若選取項不在搜尋結果且有搜尋結果則自動切換)
  const selectedVendor = useMemo(() => {
    const list = filteredMeters.length > 0 ? filteredMeters : data;
    const found = list.find((d) => d.waterId === selectedVendorId);
    if (found) return found;
    return list[0] || data[0];
  }, [data, filteredMeters, selectedVendorId]);

  // 當使用者文字搜尋時，若目前選取水錶不符合，自動將選取項更新為第一個符合的水錶
  React.useEffect(() => {
    if (meterSearchQuery.trim() && filteredMeters.length > 0) {
      if (!filteredMeters.some((d) => d.waterId === selectedVendorId)) {
        setSelectedVendorId(filteredMeters[0].waterId);
      }
    }
  }, [meterSearchQuery, filteredMeters, selectedVendorId]);

  // 依據目前選取工業區或選取水錶廠商自動判定建議測站 (柳科 -> C0X320 柳營; 新吉 -> C2O950 安南)
  const defaultStationId = useMemo(() => {
    if (activeTab === 'vendorLine' && selectedVendor) {
      const p = selectedVendor.parkName || '';
      if (p.includes('新吉') || p.toLowerCase().includes('sinji')) {
        return parkStationMap?.SinJi || 'C2O950';
      }
      return parkStationMap?.LiouYing || 'C0X320';
    }
    if (selectedParkFilter) {
      if (selectedParkFilter.includes('新吉') || selectedParkFilter.toLowerCase().includes('sinji')) {
        return parkStationMap?.SinJi || 'C2O950';
      }
    }
    return parkStationMap?.LiouYing || 'C0X320';
  }, [activeTab, selectedVendor, selectedParkFilter, parkStationMap]);

  // CODIS 測站降水量疊加資料
  const [appliedRainfallRecords, setAppliedRainfallRecords] = useState<RainfallRecord[]>([]);
  const [appliedStationId, setAppliedStationId] = useState<string>('');
  const [showRainfallOverlay, setShowRainfallOverlay] = useState<boolean>(true);

  // 當前生效測站 ID
  const activeStationId = userSelectedStation || appliedStationId || defaultStationId;

  // 當前測站詳細資訊
  const activeStationInfo = useMemo(() => {
    return CWA_WEATHER_STATIONS.find((s) => s.id === activeStationId) || {
      id: activeStationId,
      name: activeStationId,
      desc: '中央氣象署測站',
    };
  }, [activeStationId]);

  const [hoveredPoint, setHoveredPoint] = useState<{
    date: string;
    sewage: number;
    water: number;
    ratio: string;
    rainfall?: number;
    remark?: string;
    x: number;
    y: number;
  } | null>(null);

  // Sync selectedVendorId if list changes
  React.useEffect(() => {
    if (data.length > 0 && !data.some((d) => d.waterId === selectedVendorId)) {
      setSelectedVendorId(data[0].waterId);
    }
  }, [data, selectedVendorId]);

  // 降水數據映射表 (date -> mm) 自動從已套用資料或 props 中即時提取
  const rainfallMap = useMemo(() => {
    const map = new Map<string, number>();

    // 1. 若手動從 CODIS 面板套用了記錄，優先使用
    if (appliedRainfallRecords.length > 0 && appliedStationId === activeStationId) {
      appliedRainfallRecords.forEach((r) => {
        if (r.date) {
          map.set(cleanDateOnly(r.date), r.rainfall || 0);
        }
      });
      return map;
    }

    // 2. 從全局 stationRainfallRecords 映射讀取
    const records = stationRainfallRecords?.[activeStationId];
    if (Array.isArray(records) && records.length > 0) {
      records.forEach((r) => {
        if (r.date) {
          map.set(cleanDateOnly(r.date), r.rainfall || 0);
        }
      });
      return map;
    }

    // 3. 從全局 stationRainfallMap 映射讀取
    const rawMap = stationRainfallMap?.[activeStationId] || stationRainfallMap?.['C0X320'];
    if (rawMap) {
      Object.entries(rawMap).forEach(([dateStr, val]) => {
        map.set(cleanDateOnly(dateStr), val || 0);
      });
    }

    return map;
  }, [appliedRainfallRecords, appliedStationId, activeStationId, stationRainfallRecords, stationRainfallMap]);

  // 處理自 CODIS 面板套用降水資料至折線圖
  const handleApplyRainfall = (stnId: string, records: RainfallRecord[]) => {
    setAppliedStationId(stnId);
    setUserSelectedStation(stnId);
    setAppliedRainfallRecords(records);
    setShowRainfallOverlay(true);
    setActiveTab('dailyLine');
  };

  if (data.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center shadow-xl mb-8 space-y-3">
        <TrendingUp className="w-12 h-12 text-slate-600 mx-auto" />
        <h3 className="text-base font-bold text-slate-300">尚未有水錶排放數據以繪製圖表</h3>
        <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
          請先於上方啟動「線上即時批次爬蟲」擷取官方即時數據。系統將自動彙整每日污水量、自來水量、污自比並繪製每日污水排放量折線圖與異常初判診斷。
        </p>
      </div>
    );
  }

  // 1. Aggregate Daily Data across all vendors (純日期聚合，無時間)
  const dailyAggregate = useMemo(() => {
    const map = new Map<string, { date: string; sewage: number; water: number; count: number }>();

    data.forEach((vendor) => {
      const days = vendor.waterBillingDays || [];
      days.forEach((day) => {
        if (!day.billingDate) return;
        const dateKey = cleanDateOnly(day.billingDate);
        if (!dateKey) return;

        const existing = map.get(dateKey) || { date: dateKey, sewage: 0, water: 0, count: 0 };
        existing.sewage += day.dayWwVolume || 0;
        existing.water += day.dayWaterVolume || 0;
        existing.count += 1;
        map.set(dateKey, existing);
      });
    });

    const sorted = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
    return sorted;
  }, [data]);

  // 2. Selected vendor daily data

  const vendorDailyData = useMemo(() => {
    if (!selectedVendor || !selectedVendor.waterBillingDays) return [];
    return [...selectedVendor.waterBillingDays]
      .map((d) => ({
        ...d,
        billingDate: cleanDateOnly(d.billingDate),
      }))
      .sort((a, b) => (a.billingDate || '').localeCompare(b.billingDate || ''));
  }, [selectedVendor]);


  // 4. Anomaly list
  const anomalyVendors = useMemo(() => {
    return data.filter((d) => d.anomaly?.hasAnomaly);
  }, [data]);

  // Render SVG line chart (X軸與提示卡片嚴格呈現純日期，無時間)
  const renderDailyLineChart = (
    points: Array<{ date: string; sewage: number; water: number; remark?: string }>,
    isSingleVendor = false
  ) => {
    if (points.length === 0) {
      return (
        <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-xs bg-slate-950/40 rounded-xl border border-slate-800">
          <Calendar className="w-8 h-8 text-slate-600 mb-2" />
          <span>此水錶本月尚無每日抄錶紀錄明細</span>
        </div>
      );
    }

    const width = 800;
    const height = 300;
    const padding = { top: 35, right: 35, bottom: 45, left: 65 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const maxSewage = Math.max(...points.map((p) => p.sewage), 10);
    const maxWater = Math.max(...points.map((p) => p.water), 10);
    const maxY = Math.max(maxSewage, maxWater) * 1.15;

    // 降水量尺度 (若有降水數據)
    const pointsRain = points.map((p) => rainfallMap.get(cleanDateOnly(p.date)) || 0);
    const maxRain = Math.max(...pointsRain, 10);

    const getX = (idx: number) => padding.left + (idx / Math.max(1, points.length - 1)) * chartW;
    const getY = (val: number) => padding.top + chartH - (val / maxY) * chartH;
    const getRainBarH = (val: number) => (val / maxRain) * (chartH * 0.35); // 降水柱狀高度佔底部 35%

    // Build SVG paths
    const sewagePath = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx)} ${getY(p.sewage)}`).join(' ');
    const waterPath = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx)} ${getY(p.water)}`).join(' ');
    const sewageArea = `${sewagePath} L ${getX(points.length - 1)} ${padding.top + chartH} L ${getX(0)} ${padding.top + chartH} Z`;

    const hasRainData = showRainfallOverlay && pointsRain.some((r) => r > 0);

    return (
      <div className="relative w-full overflow-x-auto">
        <div className="min-w-[640px]">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible select-none">
            <defs>
              <linearGradient id="sewageGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.32" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="rainGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.1" />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = padding.top + chartH * (1 - ratio);
              const val = Math.round(maxY * ratio);
              return (
                <g key={ratio}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={padding.left + chartW}
                    y2={y}
                    stroke="#334155"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />
                  <text
                    x={padding.left - 8}
                    y={y + 4}
                    textAnchor="end"
                    fill="#94a3b8"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    {val}
                  </text>
                </g>
              );
            })}

            {/* Y軸單位標註 */}
            <text
              x={padding.left - 8}
              y={padding.top - 12}
              textAnchor="end"
              fill="#64748b"
              fontSize="9"
              fontFamily="sans-serif"
            >
              m³/日
            </text>

            {/* 降水量柱狀圖 (Rainfall Bars on secondary axis at bottom) */}
            {hasRainData &&
              points.map((p, idx) => {
                const cleanDate = cleanDateOnly(p.date);
                const rainVal = rainfallMap.get(cleanDate) || 0;
                if (rainVal <= 0) return null;
                const barH = getRainBarH(rainVal);
                const barW = Math.max(4, Math.min(18, (chartW / points.length) * 0.55));
                const cx = getX(idx);
                const x = cx - barW / 2;
                const y = padding.top + chartH - barH;

                return (
                  <rect
                    key={`rain-${idx}`}
                    x={x}
                    y={y}
                    width={barW}
                    height={barH}
                    fill="url(#rainGrad)"
                    stroke="#0284c7"
                    strokeWidth="1"
                    rx="1.5"
                    opacity="0.85"
                  />
                );
              })}

            {/* 污水量區域漸層填充 (Sewage Area Fill) */}
            <path d={sewageArea} fill="url(#sewageGrad)" />

            {/* 【自來水使用量】藍色虛線 (Water Line - Blue Dashed) */}
            <path
              d={waterPath}
              fill="none"
              stroke="#60a5fa"
              strokeWidth="2.2"
              strokeDasharray="6 4"
            />

            {/* 【每日污水排放量】青色實線 (Sewage Line - Cyan Solid) */}
            <path
              d={sewagePath}
              fill="none"
              stroke="#06b6d4"
              strokeWidth="3.2"
            />

            {/* 【前12個月日均基準線】金黃色長虛線 (Benchmark 12M Avg - Yellow Long-Dashed) */}
            {isSingleVendor && selectedVendor?.twelveAvg && (
              <g>
                <line
                  x1={padding.left}
                  y1={getY(selectedVendor.twelveAvg)}
                  x2={padding.left + chartW}
                  y2={getY(selectedVendor.twelveAvg)}
                  stroke="#fbbf24"
                  strokeWidth="1.8"
                  strokeDasharray="7 4"
                />
                <text
                  x={padding.left + chartW - 6}
                  y={getY(selectedVendor.twelveAvg) - 6}
                  textAnchor="end"
                  fill="#fbbf24"
                  fontSize="10"
                  fontWeight="bold"
                >
                  前12個月日均基準線 (長虛線): {selectedVendor.twelveAvg} m³/日
                </text>
              </g>
            )}

            {/* 數據節點 (Data Points) */}
            {points.map((p, idx) => {
              const cx = getX(idx);
              const cy = getY(p.sewage);
              const dayRatio = p.water > 0 ? `${((p.sewage / p.water) * 100).toFixed(1)}%` : '-';
              const isSpike = isSingleVendor && selectedVendor?.twelveAvg && p.sewage > selectedVendor.twelveAvg * 2;
              const isZero = p.sewage === 0;
              const cleanDate = cleanDateOnly(p.date);
              const dayRain = rainfallMap.get(cleanDate) || 0;

              // Extract date display for X-axis (e.g. 09/01 or 2026/09/01)
              const xLabel = cleanDate.length >= 10 ? cleanDate.slice(5) : cleanDate;

              return (
                <g key={idx} className="cursor-pointer">
                  {/* 異常光暈 (突增時顯示紅色光環) */}
                  {isSpike && (
                    <circle cx={cx} cy={cy} r="9" fill="#f43f5e" opacity="0.45" />
                  )}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isSpike || isZero ? '5.5' : '4'}
                    fill={isSpike ? '#f43f5e' : isZero ? '#94a3b8' : '#22d3ee'}
                    stroke="#0f172a"
                    strokeWidth="2"
                    onMouseEnter={() => {
                      setHoveredPoint({
                        date: cleanDate,
                        sewage: p.sewage,
                        water: p.water,
                        ratio: dayRatio,
                        rainfall: dayRain,
                        remark: p.remark,
                        x: cx,
                        y: cy,
                      });
                    }}
                  />
                  {/* X-axis labels (呈現日期，無時間) */}
                  {(points.length <= 15 || idx % Math.ceil(points.length / 12) === 0 || idx === points.length - 1) && (
                    <text
                      x={cx}
                      y={padding.top + chartH + 18}
                      textAnchor="middle"
                      fill="#94a3b8"
                      fontSize="10"
                      fontFamily="monospace"
                    >
                      {xLabel}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Hover Tooltip Card: 嚴格呈現日期，不顯示時間，並標明實線與虛線意義 */}
        {hoveredPoint && (
          <div
            className="absolute top-2 right-4 bg-slate-950/95 border border-cyan-500/50 rounded-xl p-3.5 shadow-2xl backdrop-blur-md text-xs space-y-2 pointer-events-none z-20 min-w-[230px]"
          >
            <div className="font-bold text-white flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span>📅 日期：{cleanDateOnly(hoveredPoint.date)}</span>
              <span className="text-[10px] text-cyan-400 font-mono">每日抄錶</span>
            </div>

            {/* 青色實線 */}
            <div className="flex items-center justify-between text-cyan-300">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-3.5 h-0.5 bg-cyan-400 inline-block shadow-[0_0_6px_rgba(6,182,212,0.8)]"></span>
                <span>[實線] 每日污水量:</span>
              </span>
              <span className="font-mono font-bold text-sm">{hoveredPoint.sewage.toLocaleString()} m³/日</span>
            </div>

            {/* 藍色虛線 */}
            <div className="flex items-center justify-between text-blue-300">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-3.5 border-t border-dashed border-blue-400 inline-block"></span>
                <span>[虛線] 每日自來水量:</span>
              </span>
              <span className="font-mono font-bold">{hoveredPoint.water.toLocaleString()} m³/日</span>
            </div>

            {/* 污自比 */}
            <div className="flex items-center justify-between text-indigo-300 pt-0.5 border-t border-slate-900">
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400" />
                <span>當日污自比:</span>
              </span>
              <span className="font-mono font-bold text-amber-300">{hoveredPoint.ratio}</span>
            </div>

            {/* 測站降水量 (若有) */}
            {hoveredPoint.rainfall !== undefined && (
              <div className="flex items-center justify-between text-sky-300 pt-0.5">
                <span className="flex items-center gap-1">
                  <CloudRain className="w-3 h-3 text-sky-400" />
                  <span>[柱狀] 測站日降水量:</span>
                </span>
                <span className="font-mono font-bold text-sky-400">
                  {hoveredPoint.rainfall > 0 ? `${hoveredPoint.rainfall.toFixed(1)} mm` : '0.0 mm (無降水)'}
                </span>
              </div>
            )}

            {hoveredPoint.remark && (
              <div className="text-amber-400 text-[11px] pt-1 border-t border-slate-800">
                ⚠ 備註: {hoveredPoint.remark}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl mb-8 space-y-6">
      {/* Chart Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-cyan-400" />
            水錶每日污水排放量折線圖與污自比趨勢
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            自動彙整各水錶每日排放水量、自來水用量對照、當月污自比、異常初判診斷與氣象署 CODIS 降水量比對
          </p>
        </div>

        {/* 頂部操作鈕：快速切換至 CODIS 測站降水數據下載面板 */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setActiveTab('codisRainfall');
              setHoveredPoint(null);
            }}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${
              activeTab === 'codisRainfall'
                ? 'bg-sky-600 text-white border-sky-500 shadow-sky-900/30'
                : 'bg-slate-950 hover:bg-slate-800 text-sky-300 border-sky-500/30'
            }`}
            title="開啟中央氣象署 CODIS 測站降水觀測數據填選下載面板"
          >
            <CloudRain className="w-3.5 h-3.5 text-sky-400" />
            <span>🌦️ 下載 CODIS 測站降水數據 (填選年月日)</span>
          </button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex flex-wrap items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
        <button
          onClick={() => { setActiveTab('dailyLine'); setHoveredPoint(null); }}
          className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
            activeTab === 'dailyLine' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          全區每日污水趨勢
        </button>
        <button
          onClick={() => { setActiveTab('vendorLine'); setHoveredPoint(null); }}
          className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
            activeTab === 'vendorLine' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Droplets className="w-3.5 h-3.5" />
          各水錶每日折線圖
        </button>
        <button
          onClick={() => { setActiveTab('anomalyAnalysis'); setHoveredPoint(null); }}
          className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
            activeTab === 'anomalyAnalysis' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
          異常排放初判報告
          {anomalyVendors.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-mono text-[10px]">
              {anomalyVendors.length}
            </span>
          )}
        </button>
        <button
          onClick={() => { setActiveTab('codisRainfall'); setHoveredPoint(null); }}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
            activeTab === 'codisRainfall' ? 'bg-sky-600 text-white shadow-sm' : 'text-sky-400 hover:text-sky-300'
          }`}
        >
          <CloudRain className="w-3.5 h-3.5" />
          🌦️ 測站降水數據 (CODIS 下載)
          {appliedRainfallRecords.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-sky-500 text-white font-mono text-[10px]">
              {appliedRainfallRecords.length}日
            </span>
          )}
        </button>
      </div>

      {/* 【核心需求：圖例說明 虛線與實線的區別】 (Legend Explaining Difference Between Dashed and Solid Lines) */}
      {(activeTab === 'dailyLine' || activeTab === 'vendorLine') && (
        <div className="bg-slate-950/85 border border-slate-800 rounded-xl p-4 space-y-3 shadow-md">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-white tracking-wide">
                圖表圖例說明 · 虛線與實線的定義與區別
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowDetailedLegend(!showDetailedLegend)}
              className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
            >
              <span>{showDetailedLegend ? '收合說明' : '展開完整圖例'}</span>
              {showDetailedLegend ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* 圖例卡片陣列 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* 1. 青色實線 (Solid Line) */}
            <div className="bg-slate-900/90 border border-cyan-500/40 rounded-xl p-3 flex items-start gap-3 shadow-sm">
              <div className="mt-1 flex items-center w-7 shrink-0">
                <span className="w-7 h-1 rounded-full bg-cyan-400 inline-block shadow-[0_0_8px_rgba(6,182,212,0.8)]"></span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-cyan-300">青色實線</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono font-bold">
                    實測值
                  </span>
                </div>
                <div className="font-bold text-white text-xs">每日污水排放量 (m³/日)</div>
                {showDetailedLegend && (
                  <p className="text-[11px] text-slate-400 leading-relaxed pt-0.5">
                    <strong>實線意義：</strong>代表水錶當日實際抄錄並排入下水道之排放水量，為系統檢核的核心監測實測數值。
                  </p>
                )}
              </div>
            </div>

            {/* 2. 藍色虛線 (Dashed Line) */}
            <div className="bg-slate-900/90 border border-blue-500/40 rounded-xl p-3 flex items-start gap-3 shadow-sm">
              <div className="mt-1 flex items-center w-7 shrink-0">
                <span className="w-7 border-t-2 border-dashed border-blue-400 inline-block"></span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-blue-300">藍色短虛線</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 font-mono font-bold">
                    對照值
                  </span>
                </div>
                <div className="font-bold text-white text-xs">每日自來水使用量 (m³/日)</div>
                {showDetailedLegend && (
                  <p className="text-[11px] text-slate-400 leading-relaxed pt-0.5">
                    <strong>虛線意義：</strong>代表當日進水錶自來水用水量，作為<strong>輔助比對參考線</strong>，用以計算檢核污自比。
                  </p>
                )}
              </div>
            </div>

            {/* 3. 金黃長虛線 (Long-Dashed Line) */}
            <div className="bg-slate-900/90 border border-amber-500/40 rounded-xl p-3 flex items-start gap-3 shadow-sm">
              <div className="mt-1 flex items-center w-7 shrink-0">
                <span className="w-7 border-t-2 border-dashed border-amber-400 inline-block"></span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-amber-300">金黃長虛線</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono font-bold">
                    基準線
                  </span>
                </div>
                <div className="font-bold text-white text-xs">前12個月日均量 (m³/日)</div>
                {showDetailedLegend && (
                  <p className="text-[11px] text-slate-400 leading-relaxed pt-0.5">
                    <strong>虛線意義：</strong>廠商前 12 個月平均日污水量，作為<strong>常態基準線</strong>，比對單日是否超額突增（超過 2 倍）。
                  </p>
                )}
              </div>
            </div>

            {/* 4. 天藍雨量柱狀與異常標記點 */}
            <div className="bg-slate-900/90 border border-slate-700 rounded-xl p-3 flex items-start gap-3 shadow-sm">
              <div className="mt-1 flex items-center gap-1 shrink-0">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block shadow-[0_0_6px_rgba(244,63,94,0.8)]"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block"></span>
                <span className="w-2 h-4 rounded bg-sky-500/50 inline-block border border-sky-400"></span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-200">標記點與降水</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono font-bold">
                    警示/氣象
                  </span>
                </div>
                <div className="font-bold text-white text-xs">突增紅點 / 零排放灰點 / 降水柱</div>
                {showDetailedLegend && (
                  <p className="text-[11px] text-slate-400 leading-relaxed pt-0.5">
                    🔴 紅點為單日排放突增；⚪ 灰點為零排放；天藍柱為氣象署 CODIS 測站日降水量，檢核雨污混流。
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 1: 全區每日污水趨勢折線圖 */}
      {activeTab === 'dailyLine' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="flex items-center gap-1.5 text-cyan-300 font-semibold">
                <span className="w-4 h-0.5 bg-cyan-400 inline-block"></span> [實線] 全區每日污水量 (m³/日)
              </span>
              <span className="flex items-center gap-1.5 text-blue-300 font-semibold">
                <span className="w-4 border-t-2 border-dashed border-blue-400 inline-block"></span> [虛線] 全區每日自來水量 (m³/日)
              </span>
              <span className="flex items-center gap-1.5 text-sky-400 font-semibold">
                <span className="w-3 h-3 bg-sky-500/30 border border-sky-400 rounded-sm inline-block"></span> [柱狀] 測站日降水量 ({activeStationInfo?.name || activeStationId})
              </span>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-700">
                <CloudRain className="w-3.5 h-3.5 text-sky-400" />
                <span className="text-slate-400 text-[11px]">氣象測站：</span>
                <select
                  value={activeStationId}
                  onChange={(e) => {
                    const stn = e.target.value;
                    setUserSelectedStation(stn);
                    onFetchStationRainfall?.(stn);
                  }}
                  className="bg-transparent text-white text-xs font-semibold focus:outline-none cursor-pointer"
                >
                  <optgroup label="工業區主要首選測站">
                    <option value="C0X320">柳營 (C0X320) · 柳科首選</option>
                    <option value="C2O950">安南 (C2O950) · 新吉首選</option>
                    <option value="C0X150">安定 (C0X150) · 鄰近新吉</option>
                    <option value="C0X250">新營 (C0X250) · 鄰近柳科</option>
                    <option value="C2X060">下營 (C2X060) · 下營測站</option>
                  </optgroup>
                  <optgroup label="其他重要測站">
                    {CWA_WEATHER_STATIONS.filter((s) => !['C0X320', 'C2O950', 'C0X150', 'C0X250', 'C2X060'].includes(s.id)).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <span className="text-slate-400">
                共計 <span className="text-white font-mono font-bold">{dailyAggregate.length}</span> 個記錄日 · 總水錶數 {data.length} 支
              </span>
            </div>
          </div>

          {dailyAggregate.length > 0 ? (
            renderDailyLineChart(dailyAggregate.map((d) => ({
              date: d.date,
              sewage: d.sewage,
              water: d.water,
            })))
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs bg-slate-950/40 rounded-xl border border-slate-800">
              尚無每日聚合數據。請使用線上爬蟲擷取廠商的每日水錶抄錶記錄。
            </div>
          )}
        </div>
      )}

      {/* Tab 2: 單一水錶每日折線圖 */}
      {activeTab === 'vendorLine' && (
        <div className="space-y-4">
          {/* Vendor Selector & Text Search Bar */}
          <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* 文字搜尋水錶與選擇下拉選單 */}
              <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
                <div className="relative min-w-[200px] sm:min-w-[260px]">
                  <Search className="w-4 h-4 text-cyan-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="搜尋水錶 (廠商/水錶名/編號)..."
                    value={meterSearchQuery}
                    onChange={(e) => setMeterSearchQuery(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded-lg pl-9 pr-7 py-1.5 focus:outline-none focus:border-cyan-500 shadow-inner"
                  />
                  {meterSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setMeterSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      title="清除搜尋"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-300 whitespace-nowrap">
                    選擇水錶
                    <span className="text-cyan-400 font-mono ml-1 font-bold">
                      ({filteredMeters.length}/{data.length} 支)
                    </span>
                    ：
                  </span>
                  <select
                    value={selectedVendorId}
                    onChange={(e) => setSelectedVendorId(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-white text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500 max-w-xs sm:max-w-md truncate"
                  >
                    {filteredMeters.length > 0 ? (
                      filteredMeters.map((v) => (
                        <option key={v.waterId} value={v.waterId}>
                          [{v.parkName}] {v.name} - {v.waterName} (編號: {v.waterId})
                        </option>
                      ))
                    ) : (
                      <option value="" disabled>查無符合的水錶</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Rain station selection */}
              <div className="flex items-center gap-1.5 font-sans bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-700">
                <CloudRain className="w-3.5 h-3.5 text-sky-400" />
                <span className="text-slate-400 text-[11px]">氣象測站:</span>
                <select
                  value={activeStationId}
                  onChange={(e) => {
                    const stn = e.target.value;
                    setUserSelectedStation(stn);
                    onFetchStationRainfall?.(stn);
                  }}
                  className="bg-transparent text-white text-xs font-semibold focus:outline-none cursor-pointer"
                >
                  <optgroup label="工業區主要首選測站">
                    <option value="C0X320">柳營 (C0X320) · 柳科首選</option>
                    <option value="C2O950">安南 (C2O950) · 新吉首選</option>
                    <option value="C0X150">安定 (C0X150) · 鄰近新吉</option>
                    <option value="C0X250">新營 (C0X250) · 鄰近柳科</option>
                    <option value="C2X060">下營 (C2X060) · 下營測站</option>
                  </optgroup>
                  <optgroup label="其他重要測站">
                    {CWA_WEATHER_STATIONS.filter((s) => !['C0X320', 'C2O950', 'C0X150', 'C0X250', 'C2X060'].includes(s.id)).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>

            {/* 快速點選符合水錶標籤 (當搜尋結果 1 ~ 6 筆時顯示快捷點選) */}
            {meterSearchQuery.trim() && filteredMeters.length > 0 && filteredMeters.length <= 6 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800/80 text-xs">
                <span className="text-slate-400 text-[11px]">🎯 搜尋快速點選：</span>
                {filteredMeters.map((v) => (
                  <button
                    key={v.waterId}
                    type="button"
                    onClick={() => setSelectedVendorId(v.waterId)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                      v.waterId === selectedVendorId
                        ? 'bg-cyan-600 text-white shadow-sm ring-1 ring-cyan-400'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                  >
                    <span>{v.name}</span>
                    <span className="text-slate-400 text-[10px]">({v.waterName})</span>
                  </button>
                ))}
              </div>
            )}

            {/* 若搜尋無結果提示 */}
            {meterSearchQuery.trim() && filteredMeters.length === 0 && (
              <div className="p-2.5 rounded-lg bg-rose-950/20 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
                <span>⚠️ 查無符合「{meterSearchQuery}」的水錶，請嘗試以廠商名稱、水錶編號或工業區搜尋。</span>
                <button
                  type="button"
                  onClick={() => setMeterSearchQuery('')}
                  className="px-2.5 py-0.5 rounded bg-rose-900/40 hover:bg-rose-900/60 text-rose-200 text-xs font-semibold"
                >
                  清除搜尋
                </button>
              </div>
            )}

            {/* Selected vendor metrics summary */}
            {selectedVendor && (
              <div className="flex flex-wrap items-center gap-4 text-xs font-mono pt-1 border-t border-slate-800/60">
                <div className="text-slate-300 font-sans font-bold flex items-center gap-1">
                  <span className="text-cyan-400 font-mono">[{selectedVendor.waterId}]</span>
                  <span>{selectedVendor.name} - {selectedVendor.waterName}</span>
                </div>
                <div>
                  <span className="text-slate-400">本月污水: </span>
                  <span className="text-cyan-300 font-bold">{selectedVendor.wwVolume?.toLocaleString() ?? '-'} m³</span>
                </div>
                <div>
                  <span className="text-slate-400">本月自來水: </span>
                  <span className="text-blue-300 font-bold">{selectedVendor.waterVolume?.toLocaleString() ?? '-'} m³</span>
                </div>
                <div>
                  <span className="text-slate-400">污自比: </span>
                  <span className={`font-bold ${
                    selectedVendor.ratio && (selectedVendor.ratio > 1.2 || selectedVendor.ratio < 0.35)
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}>
                    {selectedVendor.ratio ? `${(selectedVendor.ratio * 100).toFixed(1)}%` : '-'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">12M日均: </span>
                  <span className="text-teal-300 font-bold">{selectedVendor.twelveAvg ?? '-'} m³/日</span>
                </div>
              </div>
            )}
          </div>

          {/* Anomaly banner if vendor has anomaly */}
          {selectedVendor?.anomaly?.hasAnomaly && (
            <div className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
              selectedVendor.anomaly.severity === 'danger'
                ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                : 'bg-amber-950/40 border-amber-500/40 text-amber-200'
            }`}>
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">異常初判警示：</span>
                <span>{selectedVendor.anomaly.reasons.join('、')}</span>
              </div>
            </div>
          )}

          {/* Line chart for selected vendor */}
          {vendorDailyData.length > 0 ? (
            renderDailyLineChart(
              vendorDailyData.map((d) => ({
                date: d.billingDate,
                sewage: d.dayWwVolume || 0,
                water: d.dayWaterVolume || 0,
                remark: d.remark,
              })),
              true
            )
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs bg-slate-950/40 rounded-xl border border-slate-800">
              該水錶目前尚無每日抄錶資料
            </div>
          )}
        </div>
      )}


      {/* Tab 4: 異常排放初判報告 */}
      {activeTab === 'anomalyAnalysis' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>異常排放初步判斷水錶清單 (自動稽核：污自比超標、連續7日未排放、讀值倒退、單日突增)</span>
            <span className="font-mono text-rose-400 font-bold">{anomalyVendors.length} 支異常水錶</span>
          </div>

          {anomalyVendors.length === 0 ? (
            <div className="p-8 text-center text-emerald-400 text-xs bg-emerald-950/20 border border-emerald-500/30 rounded-xl space-y-1">
              <CheckCircle2 className="w-6 h-6 mx-auto mb-1 text-emerald-400" />
              <div className="font-bold">各廠商水錶排放與抄錶指標皆在正常合格範圍內</div>
              <div className="text-slate-400 text-[11px]">未檢測到污自比 &gt; 120%、連續7日零排放或水錶讀值倒退等異常現象</div>
            </div>
          ) : (
            <div className="space-y-3">
              {anomalyVendors.map((vendor) => (
                <div
                  key={vendor.waterId}
                  onClick={() => onSelectVendor?.(vendor)}
                  className="bg-slate-950/60 border border-rose-500/30 hover:border-rose-500 p-4 rounded-xl transition-all cursor-pointer space-y-2 group"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                        {vendor.anomaly?.severity === 'danger' ? '嚴重異常' : '警戒關注'}
                      </span>
                      <span className="font-bold text-white group-hover:text-cyan-300 transition-colors">
                        {vendor.name}
                      </span>
                      <span className="text-xs text-slate-400">
                        ({vendor.parkName} · 水錶: {vendor.waterName})
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-mono">
                      <span>污自比: <strong className="text-rose-400">{vendor.ratio ? `${(vendor.ratio * 100).toFixed(1)}%` : '-'}</strong></span>
                      <span>污水: <strong className="text-cyan-300">{vendor.wwVolume?.toLocaleString() ?? 0} m³</strong></span>
                    </div>
                  </div>

                  <div className="text-xs text-rose-300 space-y-1 bg-rose-950/30 p-2.5 rounded-lg border border-rose-500/20">
                    {vendor.anomaly?.reasons.map((r, rIdx) => (
                      <div key={rIdx} className="flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}


      {/* 【核心需求：Tab 6: 氣象署 CODIS 測站降水數據下載 (填選年月日)】 */}
      {activeTab === 'codisRainfall' && (
        <CodisRainfallPanel
          vendorsData={data}
          selectedParkFilter={selectedParkFilter}
          onApplyRainfallToCharts={handleApplyRainfall}
          appliedStationId={activeStationId}
        />
      )}
    </div>
  );
};
