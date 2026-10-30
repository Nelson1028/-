import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Calendar,
  Droplet,
  Droplets,
  Building,
  Gauge,
  Activity,
  Download,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Waves,
  Zap,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { VendorSewageData, DailyBillingRecord } from '../types';

interface DetailModalProps {
  vendor: VendorSewageData | null;
  onClose: () => void;
}

function cleanDateOnly(dStr?: string): string {
  if (!dStr) return '';
  let datePart = dStr.split('T')[0].split(' ')[0].trim();
  return datePart.replace(/-/g, '/');
}

export const DetailModal: React.FC<DetailModalProps> = ({ vendor, onClose }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'daily' | 'history12M'>('overview');
  const [hoveredPoint, setHoveredPoint] = useState<{
    date: string;
    sewage: number;
    water: number;
    ratio: string;
    remark?: string;
    x: number;
    y: number;
  } | null>(null);

  if (!vendor) return null;

  const months = vendor.twelveMonthDays || [];
  const days = useMemo(() => {
    return [...(vendor.waterBillingDays || [])].sort((a, b) => {
      const dateA = cleanDateOnly(a.billingDate);
      const dateB = cleanDateOnly(b.billingDate);
      return dateA.localeCompare(dateB);
    });
  }, [vendor.waterBillingDays]);

  // Extract available Year-Months from data
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    (vendor.waterBillingDays || []).forEach((d) => {
      if (d.billingDate) {
        const clean = cleanDateOnly(d.billingDate);
        const ym = clean.slice(0, 7);
        if (ym.length === 7) set.add(ym);
      }
    });
    (vendor.twelveMonthDays || []).forEach((m) => {
      if (m.year && m.month) {
        set.add(`${m.year}/${String(m.month).padStart(2, '0')}`);
      }
    });
    if (vendor.billingDate) {
      const ym = cleanDateOnly(vendor.billingDate).slice(0, 7);
      if (ym.length === 7) set.add(ym);
    }
    const arr = Array.from(set).sort().reverse();
    return arr.length > 0 ? arr : [new Date().toISOString().slice(0, 7).replace('-', '/')];
  }, [vendor]);

  const [selectedMonth, setSelectedMonth] = useState<string>(availableMonths[0] || '');

  useEffect(() => {
    if (availableMonths.length > 0 && !availableMonths.includes(selectedMonth)) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth]);

  // Filter full month daily data for the selected month
  const monthDailyData = useMemo(() => {
    const targetYM = selectedMonth.replace(/-/g, '/');
    const matched = days.filter((d) => {
      const dYM = cleanDateOnly(d.billingDate).slice(0, 7);
      return dYM === targetYM;
    });

    return matched.length > 0 ? matched : days;
  }, [days, selectedMonth]);

  const monthSewageSum = useMemo(() => {
    return monthDailyData.reduce((acc, cur) => acc + (cur.dayWwVolume || 0), 0);
  }, [monthDailyData]);

  const monthWaterSum = useMemo(() => {
    return monthDailyData.reduce((acc, cur) => acc + (cur.dayWaterVolume || 0), 0);
  }, [monthDailyData]);

  const monthRatio = useMemo(() => {
    if (monthSewageSum > 0 && monthWaterSum > 0) {
      return ((monthSewageSum / monthWaterSum) * 100).toFixed(1);
    }
    return null;
  }, [monthSewageSum, monthWaterSum]);

  const maxMonthlyVal = months.length > 0 ? Math.max(...months.map((m) => m.avgDayWwVolume || 0), vendor.twelveAvg || 0) : 100;
  const maxDailyVal = monthDailyData.length > 0 ? Math.max(...monthDailyData.map((d) => d.dayWwVolume || 0), vendor.twelveAvg || 0, 10) : 10;

  const ratio = vendor.ratio;
  const ratioPct = ratio !== null ? (ratio * 100).toFixed(1) : null;
  const isRatioDanger = ratio !== null && ratio > 1.2;
  const isRatioWarningHigh = ratio !== null && ratio > 1.0 && ratio <= 1.2;
  const isRatioWarningLow = ratio !== null && ratio < 0.35;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-800/90 border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
              <Droplet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                {vendor.name}
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-700 text-cyan-300 font-normal border border-slate-600">
                  {vendor.parkName}
                </span>
                {vendor.anomaly?.hasAnomaly ? (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                    vendor.anomaly.severity === 'danger'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}>
                    <AlertTriangle className="w-3 h-3" />
                    {vendor.anomaly.tags[0] || '異常'}
                    {vendor.anomaly.checks && vendor.anomaly.checks.length > 1 && (
                      <span className="ml-1 px-1.5 py-0.2 bg-slate-900/60 rounded-full text-[9px] font-mono border border-current">
                        +{vendor.anomaly.checks.length - 1} 項
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> 排放正常
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                水錶名稱：<span className="text-slate-200 font-semibold">{vendor.waterName}</span> · 水錶編號：<span className="font-mono text-cyan-300">{vendor.waterId}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Header inside Modal */}
        <div className="px-6 pt-3 bg-slate-900 border-b border-slate-800 flex items-center gap-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'overview'
                ? 'text-cyan-400 border-cyan-400 bg-slate-800/40'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            總覽與每日折線趨勢
          </button>
          <button
            onClick={() => setActiveTab('daily')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'daily'
                ? 'text-cyan-400 border-cyan-400 bg-slate-800/40'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            每日污水抄錶明細 ({days.length} 日)
          </button>
          <button
            onClick={() => setActiveTab('history12M')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'history12M'
                ? 'text-cyan-400 border-cyan-400 bg-slate-800/40'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <Gauge className="w-3.5 h-3.5" />
            前12個月歷月日均 ({months.length} 期)
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {activeTab === 'overview' && (
            <>
              {/* DevTools Target Spotlight Card */}
              <div className="bg-gradient-to-r from-cyan-950/50 via-blue-950/40 to-slate-900 border-2 border-cyan-500/40 rounded-2xl p-5 relative overflow-hidden shadow-lg">
                <div className="absolute top-2 right-3 flex items-center gap-1.5 text-[11px] font-mono text-cyan-300 bg-cyan-950/80 px-2.5 py-0.5 rounded-full border border-cyan-500/40">
                  <span>DevTools 抓取代碼:</span>
                  <span className="text-emerald-400 font-bold">.v-col.v-col-auto.align-self-center.py-2</span>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-xs uppercase tracking-wider text-cyan-300 font-semibold flex items-center gap-1.5">
                      <Gauge className="w-4 h-4 text-cyan-400" />
                      官方核心標的：前 12 個月平均每日污水水量 (最新期別)
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-white drop-shadow-md">
                        {vendor.twelveAvg !== null && vendor.twelveAvg !== undefined ? vendor.twelveAvg : '無數據'}
                      </span>
                      <span className="text-sm font-semibold text-cyan-300 font-mono">
                        m³ / 日
                      </span>
                    </div>
                  </div>

                  {vendor.approvedWwVolume && (
                    <div className="text-left sm:text-right bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                      <div className="text-[11px] text-slate-400">核准每日容許排放量</div>
                      <div className="text-base font-bold font-mono text-emerald-400">
                        {vendor.approvedWwVolume} m³/日
                      </div>
                    </div>
                  )}
                </div>

                {/* 3 Metric Cards: 累積污水、累積自來水、污自比 */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-3 border-t border-slate-700/60">
                  <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-800">
                    <div className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Waves className="w-3.5 h-3.5 text-cyan-400" />
                      區間累積污水量
                    </div>
                    <div className="text-lg font-bold font-mono text-cyan-300 mt-1">
                      {vendor.wwVolume !== null && vendor.wwVolume !== undefined ? `${vendor.wwVolume.toLocaleString()} m³` : '-'}
                    </div>
                  </div>

                  <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-800">
                    <div className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Droplets className="w-3.5 h-3.5 text-blue-400" />
                      區間累積自來水用量
                    </div>
                    <div className="text-lg font-bold font-mono text-blue-300 mt-1">
                      {vendor.waterVolume !== null && vendor.waterVolume !== undefined ? `${vendor.waterVolume.toLocaleString()} m³` : '-'}
                    </div>
                  </div>

                  <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-800">
                    <div className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      區間污自比
                    </div>
                    <div className="text-lg font-bold font-mono mt-1 flex items-baseline gap-1">
                      <span className={isRatioDanger ? 'text-rose-400' : isRatioWarningHigh || isRatioWarningLow ? 'text-amber-400' : 'text-emerald-400'}>
                        {ratioPct !== null ? `${ratioPct}%` : '-'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-sans">
                        {isRatioDanger ? '(>120% 嚴重異常)' : isRatioWarningHigh ? '(100%~120% 警戒)' : isRatioWarningLow ? '(<35% 警戒異常)' : ratioPct ? '(正常合格)' : ''}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Requirement 3: 每日污水排放趨勢預覽 (採用折線圖，呈現一整個月的數據，並可選擇年月) */}
              <div className="bg-slate-800/40 border border-slate-700/80 rounded-2xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/60 pb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-cyan-400" />
                    <span className="font-bold text-white text-xs">
                      每日污水排放量折線圖趨勢預覽 (整月完整呈現)
                    </span>
                  </div>

                  {/* Year-Month Selector for preview */}
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                      選擇呈現年月：
                    </span>
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-cyan-300 font-mono focus:outline-none focus:border-cyan-400 font-bold"
                    >
                      {availableMonths.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Month Summary Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-4 text-slate-300">
                    <span>
                      當月污水合計: <strong className="text-cyan-300">{monthSewageSum.toLocaleString()} m³</strong>
                    </span>
                    <span>
                      當月自來水合計: <strong className="text-blue-300">{monthWaterSum.toLocaleString()} m³</strong>
                    </span>
                    <span>
                      當月污自比:{' '}
                      <strong className={monthRatio && Number(monthRatio) > 120 ? 'text-rose-400' : (monthRatio && (Number(monthRatio) > 100 || Number(monthRatio) < 35)) ? 'text-amber-400' : 'text-emerald-400'}>
                        {monthRatio ? `${monthRatio}%` : '-'}
                      </strong>
                    </span>
                  </div>
                  <div className="text-slate-400 text-[11px]">
                    共 <span className="text-white font-bold">{monthDailyData.length}</span> 天抄錶記錄
                  </div>
                </div>

                {/* Interactive SVG Line Chart */}
                {monthDailyData.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 text-xs">
                    此月份（{selectedMonth}）尚無每日水錶抄錶數據
                  </div>
                ) : (
                  <div className="relative pt-2">
                    <div className="h-56 w-full">
                      <svg
                        viewBox="0 0 760 190"
                        className="w-full h-full overflow-visible"
                        preserveAspectRatio="none"
                      >
                        <defs>
                          <linearGradient id="detailLineGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.45" />
                            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>

                        {/* Y-axis Gridlines and Labels */}
                        {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                          const yPos = 20 + (1 - pct) * 135;
                          const labelVal = Math.round(pct * maxDailyVal);
                          return (
                            <g key={pct}>
                              <line
                                x1="55"
                                y1={yPos}
                                x2="745"
                                y2={yPos}
                                stroke="#334155"
                                strokeDasharray="3 3"
                                strokeWidth="0.8"
                              />
                              <text
                                x="48"
                                y={yPos + 3}
                                textAnchor="end"
                                fill="#64748b"
                                fontSize="9"
                                fontFamily="monospace"
                              >
                                {labelVal}
                              </text>
                            </g>
                          );
                        })}

                        {/* Benchmark Line: 12-Month Daily Average */}
                        {vendor.twelveAvg && vendor.twelveAvg <= maxDailyVal && (
                          <g>
                            <line
                              x1="55"
                              y1={20 + (1 - vendor.twelveAvg / maxDailyVal) * 135}
                              x2="745"
                              y2={20 + (1 - vendor.twelveAvg / maxDailyVal) * 135}
                              stroke="#2dd4bf"
                              strokeDasharray="4 4"
                              strokeWidth="1.5"
                            />
                            <text
                              x="745"
                              y={20 + (1 - vendor.twelveAvg / maxDailyVal) * 135 - 5}
                              textAnchor="end"
                              fill="#2dd4bf"
                              fontSize="9"
                              fontWeight="bold"
                              fontFamily="monospace"
                            >
                              12M日均基準: {vendor.twelveAvg} m³/日
                            </text>
                          </g>
                        )}

                        {/* Line chart paths */}
                        {(() => {
                          const totalPoints = monthDailyData.length;
                          const points = monthDailyData.map((d, i) => {
                            const x = 55 + (i / Math.max(1, totalPoints - 1)) * 690;
                            const val = d.dayWwVolume || 0;
                            const y = 20 + (1 - val / maxDailyVal) * 135;
                            return { x, y, d };
                          });

                          const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                          const areaD = `${pathD} L ${points[points.length - 1].x} 155 L ${points[0].x} 155 Z`;

                          return (
                            <>
                              {/* Filled Area */}
                              <path d={areaD} fill="url(#detailLineGradient)" />
                              {/* Stroke Line */}
                              <path
                                d={pathD}
                                fill="none"
                                stroke="#38bdf8"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />

                              {/* Data Point Circles */}
                              {points.map((p, i) => {
                                const d = p.d;
                                const dateClean = cleanDateOnly(d.billingDate);
                                const dayRatio = d.dayWwVolume !== null && d.dayWaterVolume !== null && d.dayWaterVolume > 0
                                  ? ((d.dayWwVolume / d.dayWaterVolume) * 100).toFixed(1) + '%'
                                  : '-';

                                return (
                                  <g key={i}>
                                    <circle
                                      cx={p.x}
                                      cy={p.y}
                                      r="3.5"
                                      fill="#0f172a"
                                      stroke="#38bdf8"
                                      strokeWidth="2"
                                      className="transition-transform duration-200 hover:scale-150 cursor-pointer"
                                      onMouseEnter={(e) => {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setHoveredPoint({
                                          date: dateClean,
                                          sewage: d.dayWwVolume || 0,
                                          water: d.dayWaterVolume || 0,
                                          ratio: dayRatio,
                                          remark: d.remark,
                                          x: rect.left,
                                          y: rect.top,
                                        });
                                      }}
                                      onMouseLeave={() => setHoveredPoint(null)}
                                    />
                                    {/* X-axis date text for key intervals */}
                                    {(totalPoints <= 12 || i % Math.ceil(totalPoints / 10) === 0 || i === totalPoints - 1) && (
                                      <text
                                        x={p.x}
                                        y="172"
                                        textAnchor="middle"
                                        fill="#94a3b8"
                                        fontSize="8.5"
                                        fontFamily="monospace"
                                      >
                                        {dateClean.length >= 10 ? dateClean.slice(5) : dateClean}
                                      </text>
                                    )}
                                  </g>
                                );
                              })}
                            </>
                          );
                        })()}
                      </svg>
                    </div>

                    {/* Interactive Tooltip */}
                    {hoveredPoint && (
                      <div className="bg-slate-950 border border-cyan-500/60 rounded-xl p-2.5 shadow-2xl text-xs space-y-1 z-20 max-w-xs mt-2">
                        <div className="font-bold text-white flex items-center justify-between border-b border-slate-800 pb-1">
                          <span className="font-mono text-cyan-300">{hoveredPoint.date}</span>
                          <span className="text-[10px] text-slate-400">抄錶記錄</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1">
                          <div>
                            <span className="text-slate-400">當日污水: </span>
                            <span className="text-cyan-300 font-bold">{hoveredPoint.sewage} m³</span>
                          </div>
                          <div>
                            <span className="text-slate-400">當日自來水: </span>
                            <span className="text-blue-300 font-bold">{hoveredPoint.water} m³</span>
                          </div>
                        </div>
                        <div className="text-[11px] font-mono text-amber-300 pt-0.5">
                          當日污自比: <strong>{hoveredPoint.ratio}</strong>
                        </div>
                        {hoveredPoint.remark && (
                          <div className="text-[10px] text-rose-300 bg-rose-950/40 p-1 rounded border border-rose-500/30">
                            備註: {hoveredPoint.remark}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Anomaly Diagnostic Report Panel */}
              <div className="bg-slate-800/40 border border-slate-700/80 rounded-2xl p-5 space-y-3">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    異常排放初步分析診斷報告
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    vendor.anomaly?.hasAnomaly
                      ? vendor.anomaly.severity === 'danger'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}>
                    診斷結果: {vendor.anomaly?.hasAnomaly ? (vendor.anomaly.severity === 'danger' ? '嚴重異常' : '警戒關注') : '正常合格'}
                  </span>
                </h4>

                {vendor.anomaly?.checks && vendor.anomaly.checks.length > 0 ? (
                  <div className="space-y-2 pt-1">
                    {vendor.anomaly.checks.map((check) => (
                      <div
                        key={check.id}
                        className={`p-3 rounded-xl border text-xs flex items-start gap-3 ${
                          check.severity === 'danger'
                            ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                            : 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                        }`}
                      >
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                        <div className="space-y-0.5">
                          <div className="font-bold text-white flex items-center gap-2">
                            <span>{check.title}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-900/80 text-slate-300 font-normal font-mono">
                              {check.type}
                            </span>
                          </div>
                          <p className="text-slate-300">{check.description}</p>
                          {check.detail && (
                            <p className="text-[11px] text-slate-400 font-mono pt-0.5">
                              數據詳情: {check.detail}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>該水錶各項污水排放數據良好，污自比處於合理區間，無連續零排放或污水水錶讀值倒退問題。</span>
                  </div>
                )}

                {/* Notes & Remarks (自來水數據與抄錶備註，不計入異常警示) */}
                {vendor.anomaly?.notes && vendor.anomaly.notes.length > 0 && (
                  <div className="mt-3 p-3 rounded-xl bg-slate-900/80 border border-slate-700/80 text-xs space-y-1">
                    <div className="font-semibold text-slate-300 flex items-center gap-1.5 text-[11px]">
                      <Droplets className="w-3.5 h-3.5 text-blue-400" />
                      自來水與抄錶備註記錄 (僅供參考備註，不計入異常警示)
                    </div>
                    <ul className="list-disc list-inside text-slate-400 space-y-0.5 text-[11px]">
                      {vendor.anomaly.notes.map((note, nIdx) => (
                        <li key={nIdx}>{note}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Tab 2: 每日抄錶明細清單 */}
          {activeTab === 'daily' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>各日污水水量、自來水水量、當日污自比與水錶累計讀值</span>
                <span className="font-mono text-cyan-300">共 {days.length} 筆每日記錄</span>
              </div>

              <div className="border border-slate-700/80 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-800 text-slate-300 uppercase font-semibold border-b border-slate-700">
                    <tr>
                      <th className="py-2.5 px-3 text-center">日期</th>
                      <th className="py-2.5 px-3 text-right text-cyan-300 font-bold">當日污水量 (m³/日)</th>
                      <th className="py-2.5 px-3 text-right text-blue-300 font-bold">當日自來水量 (m³/日)</th>
                      <th className="py-2.5 px-3 text-center text-amber-300 font-bold">當日污自比</th>
                      <th className="py-2.5 px-3 text-right font-mono">污水水錶累計讀值 (m³)</th>
                      <th className="py-2.5 px-3 text-right font-mono">自來水累計讀值 (m³)</th>
                      <th className="py-2.5 px-3 text-left">備註 / 警示</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 bg-slate-900/60">
                    {days.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500">
                          此水錶尚無每日抄錶數據明細
                        </td>
                      </tr>
                    ) : (
                      days.map((day, idx) => {
                        const dayRatio = day.dayWwVolume !== null && day.dayWaterVolume !== null && day.dayWaterVolume > 0
                          ? ((day.dayWwVolume / day.dayWaterVolume) * 100).toFixed(1)
                          : null;
                        const dateText = cleanDateOnly(day.billingDate);

                        return (
                          <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-2.5 px-3 text-center font-mono text-slate-200">
                              {dateText}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-cyan-300">
                              {day.dayWwVolume !== null && day.dayWwVolume !== undefined ? day.dayWwVolume.toLocaleString() : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-300">
                              {day.dayWaterVolume !== null && day.dayWaterVolume !== undefined ? day.dayWaterVolume.toLocaleString() : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono">
                              {dayRatio !== null ? (
                                <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                  Number(dayRatio) > 120 ? 'text-rose-400 bg-rose-500/10' : (Number(dayRatio) > 100 || Number(dayRatio) < 35) ? 'text-amber-400 bg-amber-500/10' : 'text-emerald-400 bg-emerald-500/10'
                                }`}>
                                  {dayRatio}%
                                </span>
                              ) : (
                                <span className="text-slate-600">-</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-400">
                              {day.wwAccumulate !== null && day.wwAccumulate !== undefined ? day.wwAccumulate.toLocaleString() : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-400">
                              {day.waterAccumulate !== null && day.waterAccumulate !== undefined ? day.waterAccumulate.toLocaleString() : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-left">
                              {day.remark ? (
                                <span className="text-amber-400 font-medium">{day.remark}</span>
                              ) : (
                                <span className="text-slate-600">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 3: 前12個月歷月日均 */}
          {activeTab === 'history12M' && (
            <div className="space-y-4">
              {months.length > 0 && (
                <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Gauge className="w-4 h-4 text-cyan-400" />
                    歷月平均每日污水水量柱狀走勢 (m³/日)
                  </h4>

                  <div className="h-40 flex items-end gap-2 pt-6 pb-2 px-1">
                    {months.map((m, idx) => {
                      const heightPct = maxMonthlyVal > 0 ? Math.max(8, (m.avgDayWwVolume / maxMonthlyVal) * 100) : 10;
                      const isAboveAvg = vendor.twelveAvg !== null && m.avgDayWwVolume > vendor.twelveAvg;

                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                          <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950 text-white text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-700 pointer-events-none whitespace-nowrap z-10">
                            {m.date}: {m.avgDayWwVolume} m³/日
                          </div>
                          <div
                            style={{ height: `${heightPct}%` }}
                            className={`w-full rounded-t transition-all ${
                              isAboveAvg
                                ? 'bg-gradient-to-t from-amber-600 to-amber-400 group-hover:from-amber-500 group-hover:to-amber-300'
                                : 'bg-gradient-to-t from-cyan-600 to-cyan-400 group-hover:from-cyan-500 group-hover:to-cyan-300'
                            }`}
                          />
                          <span className="text-[9px] text-slate-400 mt-1.5 font-mono">
                            {m.month}月
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Table of 12M historical values */}
              <div className="border border-slate-700/80 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-800 text-slate-300 uppercase font-semibold border-b border-slate-700">
                    <tr>
                      <th className="py-2.5 px-4">期別 (年月)</th>
                      <th className="py-2.5 px-4 text-right text-cyan-300 font-bold">
                        平均每日污水水量 (m³/日)
                      </th>
                      <th className="py-2.5 px-4 text-right">與基準日均差異</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 bg-slate-900/60 font-mono">
                    {months.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-8 text-center text-slate-500 font-sans">
                          官方平臺未回傳前 12 個月歷月日均數據
                        </td>
                      </tr>
                    ) : (
                      months.map((m, idx) => {
                        const diff = vendor.twelveAvg !== null ? m.avgDayWwVolume - vendor.twelveAvg : null;
                        return (
                          <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-2.5 px-4 text-white font-medium">{m.date}</td>
                            <td className="py-2.5 px-4 text-right text-cyan-300 font-bold">
                              {m.avgDayWwVolume.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              {diff !== null ? (
                                <span className={diff > 0 ? 'text-amber-400' : diff < 0 ? 'text-emerald-400' : 'text-slate-400'}>
                                  {diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)} m³/日
                                </span>
                              ) : (
                                '-'
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-800/90 border-t border-slate-700/80 flex items-center justify-between text-xs">
          <span className="text-slate-400 text-[11px] font-mono">
            水錶數據同步時間: {vendor.extractedAt ? new Date(vendor.extractedAt).toLocaleString() : '即時'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold transition-colors"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
};
