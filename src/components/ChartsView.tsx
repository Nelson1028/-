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
} from 'lucide-react';
import { VendorSewageData, DailyBillingRecord } from '../types';

interface ChartsViewProps {
  data: VendorSewageData[];
  selectedParkFilter?: string;
  onSelectVendor?: (vendor: VendorSewageData) => void;
}

/**
 * 輔助函式：確保日期格式純淨（僅包含年月日，例如 2026/09/01 或 09/01，不包含任何時間字串）
 */
function cleanDateOnly(dStr: string): string {
  if (!dStr) return '';
  // 移除 ISO 時間後綴與空白時間部分
  let datePart = dStr.split('T')[0].split(' ')[0].trim();
  datePart = datePart.replace(/-/g, '/');
  return datePart;
}

export const ChartsView: React.FC<ChartsViewProps> = ({ data, selectedParkFilter, onSelectVendor }) => {
  const [activeTab, setActiveTab] = useState<'dailyLine' | 'vendorLine' | 'ratioBar' | 'anomalyAnalysis' | 'twelveAvg'>('dailyLine');
  const [selectedVendorId, setSelectedVendorId] = useState<string>(data[0]?.waterId || '');
  const [hoveredPoint, setHoveredPoint] = useState<{
    date: string;
    sewage: number;
    water: number;
    ratio: string;
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
  const selectedVendor = useMemo(() => {
    return data.find((d) => d.waterId === selectedVendorId) || data[0];
  }, [data, selectedVendorId]);

  const vendorDailyData = useMemo(() => {
    if (!selectedVendor || !selectedVendor.waterBillingDays) return [];
    return [...selectedVendor.waterBillingDays]
      .map((d) => ({
        ...d,
        billingDate: cleanDateOnly(d.billingDate),
      }))
      .sort((a, b) => (a.billingDate || '').localeCompare(b.billingDate || ''));
  }, [selectedVendor]);

  // 3. Top vendors by sewage volume
  const topSewageVendors = useMemo(() => {
    return [...data]
      .filter((d) => (d.wwVolume || 0) > 0 || (d.twelveAvg || 0) > 0)
      .sort((a, b) => (b.wwVolume || b.twelveAvg || 0) - (a.wwVolume || a.twelveAvg || 0))
      .slice(0, 10);
  }, [data]);

  // 4. Anomaly list
  const anomalyVendors = useMemo(() => {
    return data.filter((d) => d.anomaly?.hasAnomaly);
  }, [data]);

  // Render SVG line chart (X軸與提示卡片嚴格呈現純日期，無時間)
  const renderDailyLineChart = (points: Array<{ date: string; sewage: number; water: number; remark?: string }>, isSingleVendor = false) => {
    if (points.length === 0) {
      return (
        <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-xs bg-slate-950/40 rounded-xl border border-slate-800">
          <Calendar className="w-8 h-8 text-slate-600 mb-2" />
          <span>此水錶本月尚無每日抄錶紀錄明細</span>
        </div>
      );
    }

    const width = 800;
    const height = 280;
    const padding = { top: 30, right: 30, bottom: 40, left: 60 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const maxSewage = Math.max(...points.map((p) => p.sewage), 10);
    const maxWater = Math.max(...points.map((p) => p.water), 10);
    const maxY = Math.max(maxSewage, maxWater) * 1.15;

    const getX = (idx: number) => padding.left + (idx / Math.max(1, points.length - 1)) * chartW;
    const getY = (val: number) => padding.top + chartH - (val / maxY) * chartH;

    // Build SVG paths
    const sewagePath = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx)} ${getY(p.sewage)}`).join(' ');
    const waterPath = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx)} ${getY(p.water)}`).join(' ');

    const sewageArea = `${sewagePath} L ${getX(points.length - 1)} ${padding.top + chartH} L ${getX(0)} ${padding.top + chartH} Z`;

    return (
      <div className="relative w-full overflow-x-auto">
        <div className="min-w-[640px]">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible select-none">
            <defs>
              <linearGradient id="sewageGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
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

            {/* Area fill */}
            <path d={sewageArea} fill="url(#sewageGrad)" />

            {/* Water Line (Blue dashed) */}
            <path
              d={waterPath}
              fill="none"
              stroke="#60a5fa"
              strokeWidth="2"
              strokeDasharray="5 5"
            />

            {/* Sewage Line (Cyan solid) */}
            <path
              d={sewagePath}
              fill="none"
              stroke="#06b6d4"
              strokeWidth="3"
            />

            {/* Benchmark baseline if single vendor has 12M average */}
            {isSingleVendor && selectedVendor?.twelveAvg && (
              <g>
                <line
                  x1={padding.left}
                  y1={getY(selectedVendor.twelveAvg)}
                  x2={padding.left + chartW}
                  y2={getY(selectedVendor.twelveAvg)}
                  stroke="#fbbf24"
                  strokeWidth="1.5"
                  strokeDasharray="6 3"
                />
                <text
                  x={padding.left + chartW - 4}
                  y={getY(selectedVendor.twelveAvg) - 6}
                  textAnchor="end"
                  fill="#fbbf24"
                  fontSize="10"
                  fontWeight="bold"
                >
                  12個月日均基準線: {selectedVendor.twelveAvg} m³/日
                </text>
              </g>
            )}

            {/* Data Points */}
            {points.map((p, idx) => {
              const cx = getX(idx);
              const cy = getY(p.sewage);
              const dayRatio = p.water > 0 ? `${((p.sewage / p.water) * 100).toFixed(1)}%` : '-';
              const isSpike = isSingleVendor && selectedVendor?.twelveAvg && p.sewage > selectedVendor.twelveAvg * 2;
              const isZero = p.sewage === 0;
              const cleanDate = cleanDateOnly(p.date);

              // Extract date display for X-axis (e.g. 09/01 or 2026/09/01)
              const xLabel = cleanDate.length >= 10 ? cleanDate.slice(5) : cleanDate;

              return (
                <g key={idx} className="cursor-pointer">
                  {/* Outer glow or anomaly mark */}
                  {isSpike && (
                    <circle cx={cx} cy={cy} r="8" fill="#f43f5e" opacity="0.4" />
                  )}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isSpike || isZero ? "5" : "4"}
                    fill={isSpike ? "#f43f5e" : isZero ? "#94a3b8" : "#22d3ee"}
                    stroke="#0f172a"
                    strokeWidth="2"
                    onMouseEnter={() => {
                      setHoveredPoint({
                        date: cleanDate,
                        sewage: p.sewage,
                        water: p.water,
                        ratio: dayRatio,
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

        {/* Hover Tooltip Card: 嚴格呈現日期，不顯示時間 */}
        {hoveredPoint && (
          <div
            className="absolute top-2 right-4 bg-slate-950/95 border border-cyan-500/40 rounded-xl p-3 shadow-2xl backdrop-blur-md text-xs space-y-1.5 pointer-events-none z-20 min-w-[200px]"
          >
            <div className="font-bold text-white flex items-center justify-between border-b border-slate-800 pb-1">
              <span>📅 日期：{cleanDateOnly(hoveredPoint.date)}</span>
              <span className="text-[10px] text-cyan-400 font-mono">抄錶紀錄</span>
            </div>
            <div className="flex items-center justify-between text-cyan-300">
              <span>🌊 當日污水量:</span>
              <span className="font-mono font-bold text-sm">{hoveredPoint.sewage.toLocaleString()} m³/日</span>
            </div>
            <div className="flex items-center justify-between text-blue-300">
              <span>💧 當日自來水量:</span>
              <span className="font-mono font-bold">{hoveredPoint.water.toLocaleString()} m³/日</span>
            </div>
            <div className="flex items-center justify-between text-indigo-300 pt-0.5">
              <span>⚡ 當日污自比:</span>
              <span className="font-mono font-bold text-amber-300">{hoveredPoint.ratio}</span>
            </div>
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
            自動彙整各水錶每日排放水量、自來水用量對照、當月污自比與異常排放初判
          </p>
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
            onClick={() => { setActiveTab('ratioBar'); setHoveredPoint(null); }}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'ratioBar' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            各水錶污自比排行
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
            onClick={() => { setActiveTab('twelveAvg'); setHoveredPoint(null); }}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'twelveAvg' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Gauge className="w-3.5 h-3.5" />
            前12個月日均量
          </button>
        </div>
      </div>

      {/* Tab 1: 全區每日污水趨勢折線圖 */}
      {activeTab === 'dailyLine' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
                <span className="w-3 h-3 rounded-full bg-cyan-400"></span> 全區每日污水量 (m³/日)
              </span>
              <span className="flex items-center gap-1.5 text-blue-400 font-semibold">
                <span className="w-3 h-0.5 bg-blue-400 border-dashed"></span> 全區每日自來水量 (m³/日)
              </span>
            </div>
            <span className="text-slate-400">
              共計 <span className="text-white font-mono font-bold">{dailyAggregate.length}</span> 個記錄日 · 總水錶數 {data.length} 支
            </span>
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
          {/* Vendor Selector dropdown */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-300">選擇水錶廠商：</span>
              <select
                value={selectedVendorId}
                onChange={(e) => setSelectedVendorId(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-white text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500 max-w-xs sm:max-w-md truncate"
              >
                {data.map((v) => (
                  <option key={v.waterId} value={v.waterId}>
                    [{v.parkName}] {v.name} - {v.waterName} (編號: {v.waterId})
                  </option>
                ))}
              </select>
            </div>

            {selectedVendor && (
              <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
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

      {/* Tab 3: 各水錶污自比排行 */}
      {activeTab === 'ratioBar' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>各水錶本月目前污自比 (本月累積污水排放量 / 本月累積自來水使用量)</span>
            <span>基準區間: 70% ~ 95% 正常 | &gt;120% 偏高 | &lt;35% 偏低</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.slice(0, 16).map((vendor) => {
              const ratio = vendor.ratio;
              const ratioPct = ratio !== null ? ratio * 100 : 0;
              const isDanger = ratio !== null && ratio > 1.2;
              const isWarningHigh = ratio !== null && ratio > 1.0 && ratio <= 1.2;
              const isWarningLow = ratio !== null && ratio < 0.35;
              const isNormal = ratio !== null && ratio >= 0.35 && ratio <= 1.0;

              return (
                <div
                  key={vendor.waterId}
                  onClick={() => onSelectVendor && onSelectVendor(vendor)}
                  className="bg-slate-950/60 border border-slate-800 hover:border-cyan-500/50 rounded-xl p-3 space-y-2 cursor-pointer transition-all"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="truncate pr-2">
                      <span className="font-bold text-white truncate">{vendor.name}</span>
                      <span className="text-slate-400 ml-1.5">({vendor.waterName})</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 font-mono">
                      <span className={`font-extrabold text-sm ${
                        isDanger ? 'text-rose-400' : isWarningHigh || isWarningLow ? 'text-amber-400' : 'text-emerald-400'
                      }`}>
                        {ratio !== null ? `${ratioPct.toFixed(1)}%` : '無數據'}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-sans ${
                        isDanger
                          ? 'bg-rose-500/20 text-rose-300'
                          : isWarningHigh
                          ? 'bg-amber-500/20 text-amber-300'
                          : isWarningLow
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}>
                        {isDanger ? '>120% 嚴重異常' : isWarningHigh ? '100%~120% 警戒' : isWarningLow ? '<35% 偏低警戒' : isNormal ? '正常合格' : '待測'}
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                    <div
                      style={{ width: `${Math.min(100, Math.max(5, ratioPct))}%` }}
                      className={`h-full rounded-full transition-all duration-300 ${
                        isDanger
                          ? 'bg-gradient-to-r from-rose-500 to-amber-500'
                          : isWarningHigh || isWarningLow
                          ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                          : 'bg-gradient-to-r from-emerald-500 to-cyan-400'
                      }`}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span>污水: {vendor.wwVolume?.toLocaleString() ?? '-'} m³</span>
                    <span>自來水: {vendor.waterVolume?.toLocaleString() ?? '-'} m³</span>
                    <span>12M日均: {vendor.twelveAvg ?? '-'} m³/日</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 4: 異常排放初判報告 */}
      {activeTab === 'anomalyAnalysis' && (
        <div className="space-y-4">
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white">智慧異常排放初判診斷清單</h4>
                <p className="text-slate-400">
                  針對污自比失衡 (&gt;120% 或 &lt;35%)、連續 7 日零排放、讀值倒退、單日排放突增等多維度檢核
                </p>
              </div>
            </div>
            <div className="text-right font-mono">
              <span className="text-xl font-bold text-rose-400">{anomalyVendors.length}</span>
              <span className="text-slate-400 text-xs ml-1">/ {data.length} 水錶</span>
            </div>
          </div>

          {anomalyVendors.length === 0 ? (
            <div className="p-8 text-center text-emerald-400 text-xs bg-emerald-950/20 border border-emerald-500/30 rounded-xl space-y-1">
              <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400 mb-1" />
              <div className="font-bold">目前所有水錶排放初判均屬正常範圍</div>
              <div className="text-slate-400">未檢測到污自比嚴重失衡、水錶倒退或連續零排放等異常情形。</div>
            </div>
          ) : (
            <div className="space-y-3">
              {anomalyVendors.map((vendor) => (
                <div
                  key={vendor.waterId}
                  onClick={() => onSelectVendor && onSelectVendor(vendor)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    vendor.anomaly?.severity === 'danger'
                      ? 'bg-rose-950/20 border-rose-500/40 hover:border-rose-400'
                      : 'bg-amber-950/20 border-amber-500/40 hover:border-amber-400'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-md font-bold text-xs ${
                        vendor.anomaly?.severity === 'danger'
                          ? 'bg-rose-500 text-white'
                          : 'bg-amber-500 text-slate-950'
                      }`}>
                        {vendor.anomaly?.severity === 'danger' ? '🔴 嚴重異常' : '🟡 警戒關注'}
                      </span>
                      <span className="font-bold text-white text-sm">{vendor.name}</span>
                      <span className="text-xs text-slate-400">({vendor.parkName} · {vendor.waterName})</span>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-mono">
                      <span className="text-slate-400">
                        污自比: <span className="text-white font-bold">{vendor.ratio ? `${(vendor.ratio * 100).toFixed(1)}%` : '-'}</span>
                      </span>
                      <span className="text-slate-400">
                        污水: <span className="text-cyan-300 font-bold">{vendor.wwVolume?.toLocaleString() ?? '-'} m³</span>
                      </span>
                      <span className="text-slate-400">
                        自來水: <span className="text-blue-300 font-bold">{vendor.waterVolume?.toLocaleString() ?? '-'} m³</span>
                      </span>
                    </div>
                  </div>

                  {/* Checklist details */}
                  <div className="space-y-1.5 mt-2 pt-2 border-t border-slate-800/80">
                    {vendor.anomaly?.checks.map((c) => (
                      <div key={c.id} className="text-xs flex items-start gap-2">
                        <span className="text-amber-400 shrink-0 mt-0.5">•</span>
                        <div>
                          <span className="font-semibold text-slate-200">{c.title}：</span>
                          <span className="text-slate-300">{c.description}</span>
                          {c.detail && <span className="text-slate-400 ml-1 font-mono">({c.detail})</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 5: 前12個月日均量排行榜 */}
      {activeTab === 'twelveAvg' && (
        <div className="space-y-3">
          <div className="text-xs text-slate-400 mb-2 flex items-center justify-between">
            <span>官方 DevTools 核心指標：<b>前12個月平均每日污水水量（m³/日）</b> 前 10 大水錶廠商</span>
            <span className="font-mono text-[11px] text-cyan-400">.v-col.v-col-auto.align-self-center.py-2</span>
          </div>

          {topSewageVendors.map((vendor, idx) => {
            const maxVal = topSewageVendors[0]?.twelveAvg || 100;
            const pct = maxVal > 0 ? ((vendor.twelveAvg || 0) / maxVal) * 100 : 0;

            return (
              <div
                key={vendor.waterId}
                onClick={() => onSelectVendor && onSelectVendor(vendor)}
                className="bg-slate-950/50 border border-slate-800 hover:border-cyan-500/40 p-3 rounded-xl space-y-1.5 cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <span className={`w-5 h-5 rounded flex items-center justify-center font-mono font-bold text-[11px] ${
                      idx === 0 ? 'bg-amber-500 text-slate-950' : idx === 1 ? 'bg-slate-300 text-slate-950' : idx === 2 ? 'bg-amber-700 text-white' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {idx + 1}
                    </span>
                    <span className="font-bold text-white truncate">{vendor.name}</span>
                    <span className="text-[11px] text-slate-400">({vendor.parkName} · {vendor.waterName})</span>
                  </div>

                  <div className="flex items-baseline gap-1 font-mono shrink-0">
                    <span className="text-base font-extrabold text-cyan-300">{vendor.twelveAvg ?? '-'}</span>
                    <span className="text-[11px] text-slate-400">m³/日</span>
                  </div>
                </div>

                <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                  <div
                    style={{ width: `${pct}%` }}
                    className="bg-gradient-to-r from-teal-500 to-cyan-400 h-full rounded-full transition-all duration-500"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
