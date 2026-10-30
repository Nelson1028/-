import React, { useState, useMemo } from 'react';
import {
  Droplets,
  Gauge,
  AlertTriangle,
  CheckCircle2,
  Waves,
  Zap,
  Calendar,
  Building2,
  Filter,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { VendorSewageData, ParkOption, DailyBillingRecord } from '../types';
import { DETECTED_PARKS_LIST } from '../data/mockData';

interface StatsCardsProps {
  data: VendorSewageData[];
  parksList?: ParkOption[];
  onFilterAnomaly?: (type: string) => void;
  onParkChange?: (parkId: string) => void;
  onMonthRangeChange?: (startMonth: string, endMonth: string) => void;
}

export const StatsCards: React.FC<StatsCardsProps> = ({
  data,
  parksList = DETECTED_PARKS_LIST,
  onFilterAnomaly,
  onParkChange,
  onMonthRangeChange,
}) => {
  // Filter states
  const [selectedPark, setSelectedPark] = useState<string>('');
  const [periodMode, setPeriodMode] = useState<'all' | 'range'>('all');
  const [startMonth, setStartMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [endMonth, setEndMonth] = useState<string>(new Date().toISOString().slice(0, 7));

  // Extract unique year-months from data
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    data.forEach((v) => {
      (v.waterBillingDays || []).forEach((d) => {
        if (d.billingDate) {
          const ym = d.billingDate.slice(0, 7).replace('/', '-');
          if (ym.length === 7) set.add(ym);
        }
      });
      (v.twelveMonthDays || []).forEach((m) => {
        if (m.year && m.month) {
          set.add(`${m.year}-${String(m.month).padStart(2, '0')}`);
        }
      });
      if (v.billingDate) {
        const ym = v.billingDate.slice(0, 7).replace('/', '-');
        if (ym.length === 7) set.add(ym);
      }
    });
    return Array.from(set).sort().reverse();
  }, [data]);

  // Handle park change
  const handleParkSelect = (parkId: string) => {
    setSelectedPark(parkId);
    if (onParkChange) onParkChange(parkId);
  };

  // Handle Month Range update
  const handleStartMonthChange = (val: string) => {
    setStartMonth(val);
    if (periodMode === 'range' && onMonthRangeChange) {
      onMonthRangeChange(val, endMonth || val);
    }
  };

  const handleEndMonthChange = (val: string) => {
    setEndMonth(val);
    if (periodMode === 'range' && onMonthRangeChange) {
      onMonthRangeChange(startMonth || val, val);
    }
  };

  // Filter data by selected park
  const parkFilteredVendors = useMemo(() => {
    if (!selectedPark) return data;
    const sel = selectedPark.toLowerCase();
    return data.filter((v) => {
      const p = (v.parkName || '').toLowerCase();
      if (sel === 'liouying') return p.includes('柳') || p.includes('liou');
      if (sel === 'sinji') return p.includes('新吉') || p.includes('sinji');
      return v.parkName === selectedPark;
    });
  }, [data, selectedPark]);

  // Calculate Aggregated Metrics according to selected park & Year-Month interval (起始年月 ~ 結束年月)
  const metrics = useMemo(() => {
    let sewageTotal = 0;
    let waterTotal = 0;
    const meterCount = parkFilteredVendors.length;
    let monthCount = 1;

    if (periodMode === 'range' && startMonth && endMonth) {
      const sM = startMonth <= endMonth ? startMonth : endMonth;
      const eM = startMonth <= endMonth ? endMonth : startMonth;

      parkFilteredVendors.forEach((v) => {
        let vSewage = 0;
        let vWater = 0;
        let hasMatchedDays = false;

        // Check daily readings in that month range
        (v.waterBillingDays || []).forEach((d) => {
          if (d.billingDate) {
            const dMonth = d.billingDate.slice(0, 7).replace('/', '-');
            if (dMonth >= sM && dMonth <= eM) {
              vSewage += d.dayWwVolume || 0;
              vWater += d.dayWaterVolume || 0;
              hasMatchedDays = true;
            }
          }
        });

        if (hasMatchedDays) {
          sewageTotal += vSewage;
          waterTotal += vWater;
        } else {
          // If no daily records, use month summary if matched
          const vBillingMonth = (v.billingDate || '').slice(0, 7).replace('/', '-');
          if (!vBillingMonth || (vBillingMonth >= sM && vBillingMonth <= eM)) {
            sewageTotal += v.wwVolume !== null && v.wwVolume !== undefined ? Number(v.wwVolume) : 0;
            waterTotal += v.waterVolume !== null && v.waterVolume !== undefined ? Number(v.waterVolume) : 0;
          }
        }
      });
    } else {
      // All period cumulative
      parkFilteredVendors.forEach((v) => {
        sewageTotal += v.wwVolume !== null && v.wwVolume !== undefined ? Number(v.wwVolume) : 0;
        waterTotal += v.waterVolume !== null && v.waterVolume !== undefined ? Number(v.waterVolume) : 0;
      });
    }

    // Sewage to Water Ratio
    const ratio = waterTotal > 0 ? sewageTotal / waterTotal : null;
    const ratioPct = ratio !== null ? (ratio * 100).toFixed(1) : '-';

    // 12M Daily Average total
    const validAvgs = parkFilteredVendors
      .map((d) => d.twelveAvg)
      .filter((v): v is number => v !== null && v !== undefined && !isNaN(v));
    const avgDailySum = validAvgs.reduce((acc, cur) => acc + cur, 0);

    // Anomaly item classification count
    const anomalyVendors = parkFilteredVendors.filter((d) => d.anomaly?.hasAnomaly);
    const dangerCount = parkFilteredVendors.filter((d) => d.anomaly?.severity === 'danger').length;
    const warningCount = parkFilteredVendors.filter((d) => d.anomaly?.severity === 'warning').length;

    // Detailed anomaly category breakdown
    const anomalyCategoryCount: Record<string, { label: string; count: number; severity: string; icon: string }> = {
      ratio_high: { label: '污自比超過 120% (嚴重異常)', count: 0, severity: 'danger', icon: '⚡' },
      ratio_warning: { label: '污自比 100%~120% (警戒關注)', count: 0, severity: 'warning', icon: '⚡' },
      ratio_low: { label: '污自比偏低 (警戒異常)', count: 0, severity: 'warning', icon: '💧' },
      consecutive_zero: { label: '連續7日以上未排放 (嚴重異常)', count: 0, severity: 'danger', icon: '⚪' },
      rollback: { label: '污水水錶累計讀值倒退', count: 0, severity: 'danger', icon: '🔄' },
      surge: { label: '單日污水量突增', count: 0, severity: 'warning', icon: '📈' },
      exceed_approved: { label: '超出核准容許排放量', count: 0, severity: 'danger', icon: '⛔' },
    };

    parkFilteredVendors.forEach((v) => {
      (v.anomaly?.checks || []).forEach((c) => {
        if (c.id === 'ratio_warning') {
          anomalyCategoryCount.ratio_warning.count++;
        } else if (c.id === 'ratio_high') {
          anomalyCategoryCount.ratio_high.count++;
        } else if (c.id === 'ratio_low') {
          anomalyCategoryCount.ratio_low.count++;
        } else if (anomalyCategoryCount[c.type]) {
          anomalyCategoryCount[c.type].count++;
        }
      });
    });

    return {
      sewageTotal,
      waterTotal,
      ratio,
      ratioPct,
      avgDailySum,
      validAvgsCount: validAvgs.length,
      meterCount,
      anomalyCount: anomalyVendors.length,
      dangerCount,
      warningCount,
      anomalyCategoryCount,
    };
  }, [parkFilteredVendors, periodMode, startMonth, endMonth]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl mb-8 space-y-5">
      {/* Core Stats Cards: 自來水使用量、污水排放量、污自比、前12月日均、疑似異常項目 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: 自來水使用量 */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
              <Droplets className="w-4 h-4" />
              自來水使用量
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
              <Droplets className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-white tracking-tight font-mono">
              {metrics.waterTotal.toLocaleString()}
            </span>
            <span className="text-xs font-semibold text-blue-300">m³</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            {periodMode === 'range'
              ? `${startMonth} ~ ${endMonth} 期間總用水`
              : `${selectedPark ? '園區' : '全區'}總用水量`}
          </div>
        </div>

        {/* Card 2: 污水排放量 */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Waves className="w-4 h-4" />
              污水排放量
            </span>
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
              <Waves className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-white tracking-tight font-mono">
              {metrics.sewageTotal.toLocaleString()}
            </span>
            <span className="text-xs font-semibold text-cyan-300">m³</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            {periodMode === 'range'
              ? `${startMonth} ~ ${endMonth} 期間總排水`
              : `${selectedPark ? '園區' : '全區'}總排水量`}
          </div>
        </div>

        {/* Card 3: 污自比 (%) */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
              <Zap className="w-4 h-4" />
              區間污自比
            </span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${
              metrics.ratio && (metrics.ratio > 1.2 || metrics.ratio < 0.35)
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
            }`}>
              <Gauge className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className={`text-2xl font-extrabold tracking-tight font-mono ${
              metrics.ratio && (metrics.ratio > 1.2 || metrics.ratio < 0.35) ? 'text-amber-300' : 'text-emerald-400'
            }`}>
              {metrics.ratioPct !== '-' ? `${metrics.ratioPct}%` : '-'}
            </span>
            <span className="text-[11px] text-slate-400 font-normal">
              (污水/自來水)
            </span>
          </div>
          <div className="mt-2 text-[11px] flex items-center gap-1">
            {metrics.ratio && metrics.ratio >= 0.35 && metrics.ratio <= 1.2 ? (
              <span className="text-emerald-400 flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3 h-3" /> 比例合理 (70%~95%)
              </span>
            ) : (
              <span className="text-amber-400 flex items-center gap-1 font-medium">
                <AlertTriangle className="w-3 h-3" /> 區間污自比偏離基準
              </span>
            )}
          </div>
        </div>

        {/* Card 4: 前12個月平均每日污水水量 (m³/日) */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
              <Gauge className="w-4 h-4" />
              前12個月日均量
            </span>
            <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center border border-teal-500/20 text-[10px] font-mono font-bold">
              12M
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-teal-300 tracking-tight font-mono">
              {metrics.avgDailySum > 0 ? metrics.avgDailySum.toFixed(1) : '0.0'}
            </span>
            <span className="text-xs font-semibold text-teal-400">m³/日</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            {metrics.validAvgsCount} 支水錶 12 個月基準日均
          </div>
        </div>

        {/* Card 5: 疑似異常項目總覽 */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              疑似異常項目
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-extrabold tracking-tight font-mono ${
              metrics.dangerCount > 0 ? 'text-rose-400' : metrics.warningCount > 0 ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              {metrics.anomalyCount}
            </span>
            <span className="text-xs text-slate-400">支水錶疑似異常</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-2">
            {metrics.dangerCount > 0 && <span className="text-rose-400 font-semibold">🔴 嚴重 {metrics.dangerCount}</span>}
            {metrics.warningCount > 0 && <span className="text-amber-400 font-semibold">🟡 警戒 {metrics.warningCount}</span>}
            {metrics.anomalyCount === 0 && <span className="text-emerald-400 font-medium">✔ 目前無異常</span>}
          </div>
        </div>
      </div>

      {/* 3. Suspected Anomaly Categories Breakdown Panel */}
      <div className="bg-slate-950/60 border border-slate-800/90 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              疑似異常項目分類統計與快速篩選
            </h4>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {selectedPark ? `工業區：${parksList.find((p) => p.id === selectedPark)?.name || selectedPark}` : '全部工業區'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1">
          {Object.entries(metrics.anomalyCategoryCount).map(([key, cat]) => {
            const hasItems = cat.count > 0;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onFilterAnomaly && onFilterAnomaly(key)}
                className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  hasItems
                    ? cat.severity === 'danger'
                      ? 'bg-rose-950/20 border-rose-500/40 hover:bg-rose-950/40 text-rose-200'
                      : 'bg-amber-950/20 border-amber-500/40 hover:bg-amber-950/40 text-amber-200'
                    : 'bg-slate-900/40 border-slate-800/80 text-slate-500 opacity-60 hover:opacity-100'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span>{cat.icon}</span>
                  <span className="font-mono font-bold text-xs">{cat.count} 筆</span>
                </div>
                <div className="text-[11px] font-semibold truncate" title={cat.label}>
                  {cat.label}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
