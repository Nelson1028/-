import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Download,
  FileSpreadsheet,
  FileCode,
  Upload,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ExternalLink,
  Eye,
  Info,
  CheckSquare,
  Square,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Droplets,
  Waves,
  Zap,
  Gauge,
  TrendingUp,
  Calendar,
} from 'lucide-react';
import { VendorSewageData, ParkOption } from '../types';
import { exportMergedReportCSV, getVendorLatestBillingDate } from '../utils/csvExport';
import { DETECTED_PARKS_LIST } from '../data/mockData';

interface DataTableProps {
  data: VendorSewageData[];
  parksList?: ParkOption[];
  onSelectVendor: (vendor: VendorSewageData) => void;
  onImportData?: (items: VendorSewageData[]) => void;
  presetAnomalyFilter?: string;
  presetParkFilter?: string;
}

type SortField =
  | 'name'
  | 'parkName'
  | 'waterName'
  | 'twelveAvg'
  | 'periodWw'
  | 'periodWater'
  | 'periodRatio'
  | 'wwVolume'
  | 'waterVolume'
  | 'ratio'
  | 'billingDate'
  | 'anomaly';

export const DataTable: React.FC<DataTableProps> = ({
  data,
  parksList = DETECTED_PARKS_LIST,
  onSelectVendor,
  onImportData,
  presetAnomalyFilter,
  presetParkFilter,
}) => {
  const [keyword, setKeyword] = useState('');
  const [selectedPark, setSelectedPark] = useState(presetParkFilter || '');
  const [anomalyFilter, setAnomalyFilter] = useState<'all' | 'anomaly_only' | 'danger' | 'warning' | 'normal' | string>(presetAnomalyFilter || 'all');
  const [volumeFilter, setVolumeFilter] = useState<'all' | 'high' | 'medium' | 'low' | 'nodata'>('all');

  // Statistical Year-Month Range Selection (起始年月 ~ 結束年月，不需到日)
  const [periodFilterMode, setPeriodFilterMode] = useState<'all' | 'range'>('all');
  const [startMonth, setStartMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [endMonth, setEndMonth] = useState<string>(new Date().toISOString().slice(0, 7));

  const [sortField, setSortField] = useState<SortField>('wwVolume');
  const [sortDesc, setSortDesc] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Extract available months from data
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    data.forEach((v) => {
      (v.waterBillingDays || []).forEach((d) => {
        if (d.billingDate) {
          const ym = d.billingDate.slice(0, 7).replace('/', '-');
          if (ym.length === 7) months.add(ym);
        }
      });
      (v.twelveMonthDays || []).forEach((m) => {
        if (m.year && m.month) {
          months.add(`${m.year}-${String(m.month).padStart(2, '0')}`);
        }
      });
      if (v.billingDate) {
        const ym = v.billingDate.slice(0, 7).replace('/', '-');
        if (ym.length === 7) months.add(ym);
      }
    });
    return Array.from(months).sort().reverse();
  }, [data]);

  // Sync preset filters if passed from parent
  React.useEffect(() => {
    if (presetParkFilter !== undefined) {
      setSelectedPark(presetParkFilter);
    }
  }, [presetParkFilter]);

  React.useEffect(() => {
    if (presetAnomalyFilter) {
      setAnomalyFilter(presetAnomalyFilter);
    }
  }, [presetAnomalyFilter]);

  // 1. Data mapping & Month Range calculation (計算指定年月區間內的水量)
  const enrichedDataWithMonthRange = useMemo(() => {
    const sM = startMonth <= endMonth ? startMonth : endMonth;
    const eM = startMonth <= endMonth ? endMonth : startMonth;

    return data.map((item) => {
      let periodWw: number = 0;
      let periodWater: number = 0;
      let hasDaysInRange = false;

      (item.waterBillingDays || []).forEach((d) => {
        if (d.billingDate) {
          const dMonth = d.billingDate.slice(0, 7).replace('/', '-');
          if (dMonth >= sM && dMonth <= eM) {
            periodWw += d.dayWwVolume || 0;
            periodWater += d.dayWaterVolume || 0;
            hasDaysInRange = true;
          }
        }
      });

      if (!hasDaysInRange) {
        // Fallback to monthly summary
        const vMonth = (item.billingDate || '').slice(0, 7).replace('/', '-');
        if (!vMonth || (vMonth >= sM && vMonth <= eM)) {
          periodWw = item.wwVolume !== null && item.wwVolume !== undefined ? Number(item.wwVolume) : 0;
          periodWater = item.waterVolume !== null && item.waterVolume !== undefined ? Number(item.waterVolume) : 0;
        }
      }

      let periodRatio: number | null = null;
      if (periodWater > 0) {
        periodRatio = periodWw / periodWater;
      }

      return {
        ...item,
        periodWw: periodFilterMode === 'range' ? periodWw : (item.wwVolume ?? 0),
        periodWater: periodFilterMode === 'range' ? periodWater : (item.waterVolume ?? 0),
        periodRatio: periodFilterMode === 'range' ? periodRatio : (item.ratio ?? null),
      };
    });
  }, [data, periodFilterMode, startMonth, endMonth]);

  // 2. Filtering
  const filteredData = useMemo(() => {
    return enrichedDataWithMonthRange.filter((item) => {
      // Park filter
      if (selectedPark) {
        const itemP = (item.parkName || '').toLowerCase();
        const selP = selectedPark.toLowerCase();
        if (selP === 'liouying' && !itemP.includes('柳') && !itemP.includes('liou')) return false;
        if (selP === 'sinji' && !itemP.includes('新吉') && !itemP.includes('sinji')) return false;
        if (selP !== 'liouying' && selP !== 'sinji' && item.parkName !== selectedPark) return false;
      }

      // Anomaly filter
      if (anomalyFilter === 'anomaly_only' && !item.anomaly?.hasAnomaly) return false;
      if (anomalyFilter === 'danger' && item.anomaly?.severity !== 'danger') return false;
      if (anomalyFilter === 'warning' && item.anomaly?.severity !== 'warning') return false;
      if (anomalyFilter === 'normal' && item.anomaly?.hasAnomaly) return false;
      if (anomalyFilter === 'zero_both') {
        const isZB = (!item.periodWw || item.periodWw === 0) && (!item.periodWater || item.periodWater === 0);
        if (!isZB) return false;
      }
      if (['ratio_high', 'ratio_warning', 'ratio_low', 'consecutive_zero', 'rollback', 'surge', 'missing_water', 'exceed_approved'].includes(anomalyFilter)) {
        const hasCheck = (item.anomaly?.checks || []).some(
          (c) => c.type === anomalyFilter || c.id === anomalyFilter
        );
        if (!hasCheck) return false;
      }

      // Volume filter
      const avg = item.twelveAvg;
      if (volumeFilter === 'nodata' && avg !== null && avg !== undefined) return false;
      if (volumeFilter === 'high' && (avg === null || avg <= 200)) return false;
      if (volumeFilter === 'medium' && (avg === null || avg < 50 || avg > 200)) return false;
      if (volumeFilter === 'low' && (avg === null || avg >= 50)) return false;

      // Keyword filter
      if (keyword.trim()) {
        const q = keyword.toLowerCase().trim();
        const matchName = (item.name || '').toLowerCase().includes(q);
        const matchPark = (item.parkName || '').toLowerCase().includes(q);
        const matchWaterName = (item.waterName || '').toLowerCase().includes(q);
        const matchId = (item.waterId || '').toLowerCase().includes(q);
        const matchTags = (item.anomaly?.tags || []).some((t) => t.toLowerCase().includes(q));
        if (!matchName && !matchPark && !matchWaterName && !matchId && !matchTags) return false;
      }

      return true;
    });
  }, [enrichedDataWithMonthRange, selectedPark, anomalyFilter, volumeFilter, keyword]);

  // 3. Sorting
  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      if (sortField === 'anomaly') {
        // 嚴重異常 (danger: 2) > 警戒關注 (warning: 1) > 正常合格 (normal: 0)
        const getWeight = (item: any) => {
          if (!item.anomaly?.hasAnomaly) return 0;
          if (item.anomaly.severity === 'danger') return 2;
          if (item.anomaly.severity === 'warning') return 1;
          return 0;
        };
        const wA = getWeight(a);
        const wB = getWeight(b);
        if (wA !== wB) {
          return sortDesc ? wB - wA : wA - wB;
        }
        // 次要以污自比或污水量排序
        const rA = a.periodRatio ?? -1;
        const rB = b.periodRatio ?? -1;
        return sortDesc ? rB - rA : rA - rB;
      }

      let valA: any = (a as any)[sortField];
      let valB: any = (b as any)[sortField];

      if (valA === null || valA === undefined) valA = sortDesc ? -Infinity : Infinity;
      if (valB === null || valB === undefined) valB = sortDesc ? -Infinity : Infinity;

      if (typeof valA === 'string') {
        return sortDesc ? valB.localeCompare(valA) : valA.localeCompare(valB);
      }
      return sortDesc ? valB - valA : valA - valB;
    });
  }, [filteredData, sortField, sortDesc]);

  // 4. Pagination
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const pagedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  // Handle Sort Toggle
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDesc(!sortDesc);
    } else {
      setSortField(field);
      setSortDesc(true);
    }
    setCurrentPage(1);
  };

  // Select all on page
  const handleSelectAllOnPage = () => {
    const next = new Set(selectedIds);
    const allSelected = pagedData.every((item) => next.has(item.waterId));
    if (allSelected) {
      pagedData.forEach((item) => next.delete(item.waterId));
    } else {
      pagedData.forEach((item) => next.add(item.waterId));
    }
    setSelectedIds(next);
  };

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectedData = useMemo(() => {
    if (selectedIds.size === 0) return data;
    return data.filter((d) => selectedIds.has(d.waterId));
  }, [data, selectedIds]);

  // 計算目前水錶資料中整體的最新抄錶日期
  const overallLatestDate = useMemo(() => {
    let latest = '';
    data.forEach((vendor) => {
      const vDate = getVendorLatestBillingDate(vendor);
      if (vDate && vDate !== '-' && vDate > latest) {
        latest = vDate;
      }
    });
    return latest || new Date().toISOString().slice(0, 10).replace(/-/g, '/');
  }, [data]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden mb-8">
      {/* Table Header Controls */}
      <div className="p-5 border-b border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2.5 flex-wrap">
              <Waves className="w-5 h-5 text-cyan-400" />
              用水量與排放抄錶成果
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
                {filteredData.length} / {data.length} 支水錶
              </span>
              <span className="text-xs px-3 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono flex items-center gap-1.5 font-bold shadow-sm">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                最新抄錶日期：{overallLatestDate}
              </span>
            </h2>
          </div>

          {/* Export Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => exportMergedReportCSV(selectedData)}
              disabled={data.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600/25 text-emerald-300 hover:bg-emerald-600/35 border border-emerald-500/40 text-xs font-bold transition-all disabled:opacity-40 shadow-sm"
              title="匯出每日明細 Excel 檔 (X軸：工業區、廠商名稱、水錶名稱、前12個月日平均污水量、每日污水量第一天到最後一天)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              匯出每日明細 Excel
            </button>
          </div>
        </div>

        {/* Statistical Year-Month Range Bar (指定統計年月：選擇起始年月與結束年月，不需要到日) */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-cyan-400" />
              指定統計年月：
            </span>

            <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-700">
              <button
                type="button"
                onClick={() => setPeriodFilterMode('all')}
                className={`px-3 py-1 rounded text-xs font-medium ${
                  periodFilterMode === 'all' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                當前全期累計
              </button>
              <button
                type="button"
                onClick={() => setPeriodFilterMode('range')}
                className={`px-3 py-1 rounded text-xs font-medium ${
                  periodFilterMode === 'range' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                指定起始年月 ~ 結束年月
              </button>
            </div>

            {/* Year-Month Range Inputs (起始年月 ~ 結束年月) */}
            {periodFilterMode === 'range' && (
              <div className="flex items-center gap-1.5">
                <input
                  type="month"
                  value={startMonth}
                  onChange={(e) => {
                    setStartMonth(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-slate-900 border border-slate-700 text-cyan-300 px-2.5 py-1 rounded-lg text-xs font-mono focus:outline-none focus:border-cyan-500"
                  title="起始年月"
                />
                <span className="text-slate-400 font-bold">~</span>
                <input
                  type="month"
                  value={endMonth}
                  onChange={(e) => {
                    setEndMonth(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-slate-900 border border-slate-700 text-cyan-300 px-2.5 py-1 rounded-lg text-xs font-mono focus:outline-none focus:border-cyan-500"
                  title="結束年月"
                />
              </div>
            )}
          </div>

          <div className="text-[11px] text-slate-400 font-mono">
            {periodFilterMode === 'range' ? (
              <span className="text-cyan-300 font-bold">
                📅 統計區間：{startMonth} ~ {endMonth}
              </span>
            ) : (
              <span>當前模式：全期水錶抄錶水量成果</span>
            )}
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {/* Keyword Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="搜尋廠商名稱、水錶名稱或編號..."
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          {/* Park Filter (Strictly target site detected parks: LiouYing & SinJi) */}
          <div className="relative">
            <select
              value={selectedPark}
              onChange={(e) => {
                setSelectedPark(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors"
            >
              {parksList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Anomaly Filter */}
          <div className="relative">
            <select
              value={anomalyFilter}
              onChange={(e) => {
                setAnomalyFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors"
            >
              <option value="all">異常狀態：全部水錶</option>
              <option value="anomaly_only">⚠️ 僅顯示疑似異常/警戒水錶</option>
              <option value="danger">🔴 嚴重異常水錶</option>
              <option value="warning">🟡 警戒關注水錶</option>
              <option value="normal">✔ 排放正常水錶</option>
              <option value="zero_both">⚪ 正常 (無用水無排水)</option>
              <option value="ratio_high">⚡ 污自比超過 120% (嚴重異常)</option>
              <option value="ratio_warning">⚡ 污自比 100% ~ 120% (警戒關注)</option>
              <option value="ratio_low">💧 污自比偏低 (&lt;35% 警戒異常)</option>
              <option value="consecutive_zero">⚪ 連續 7 日未排放 (嚴重異常)</option>
              <option value="rollback">🔄 水錶讀值倒退</option>
              <option value="surge">📈 單日排放突增</option>
            </select>
          </div>

          {/* Volume Filter */}
          <div className="relative">
            <select
              value={volumeFilter}
              onChange={(e) => {
                setVolumeFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors"
            >
              <option value="all">日均排水量：全部量級</option>
              <option value="high">高排放 (&gt; 200 m³/日)</option>
              <option value="medium">中排放 (50 ~ 200 m³/日)</option>
              <option value="low">輕度 (&lt; 50 m³/日)</option>
              <option value="nodata">無有效數據</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300 border-collapse">
          <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold border-b border-slate-800 tracking-wider">
            <tr>
              <th className="py-3 px-3 text-center w-10">
                <button
                  onClick={handleSelectAllOnPage}
                  className="text-slate-400 hover:text-white"
                  title="全選本頁"
                >
                  {pagedData.length > 0 && pagedData.every((item) => selectedIds.has(item.waterId)) ? (
                    <CheckSquare className="w-4 h-4 text-cyan-400" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>
              </th>
              <th className="py-3 px-3 text-center w-12">#</th>
              <th
                onClick={() => handleSort('parkName')}
                className="py-3 px-3 cursor-pointer hover:text-white transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>工業區</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                onClick={() => handleSort('name')}
                className="py-3 px-3 cursor-pointer hover:text-white transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>廠商名稱</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                onClick={() => handleSort('waterName')}
                className="py-3 px-3 cursor-pointer hover:text-white transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>水錶名稱</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>

              {/* Latest Billing Date */}
              <th
                onClick={() => handleSort('billingDate')}
                className="py-3 px-3 text-center cursor-pointer hover:text-white transition-colors whitespace-nowrap"
              >
                <div className="flex items-center justify-center gap-1 text-slate-300 font-semibold">
                  <span>最新抄錶日</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>

              {/* Sewage Volume */}
              <th
                onClick={() => handleSort('periodWw')}
                className="py-3 px-3 text-right cursor-pointer hover:text-cyan-300 transition-colors"
              >
                <div className="flex items-center justify-end gap-1 text-cyan-400 font-bold">
                  <span>{periodFilterMode === 'range' ? '區間污水量 (m³)' : '污水排放量 (m³)'}</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>

              {/* Water Volume */}
              <th
                onClick={() => handleSort('periodWater')}
                className="py-3 px-3 text-right cursor-pointer hover:text-blue-300 transition-colors"
              >
                <div className="flex items-center justify-end gap-1 text-blue-400 font-bold">
                  <span>{periodFilterMode === 'range' ? '區間自來水 (m³)' : '自來水使用量 (m³)'}</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>

              {/* Ratio */}
              <th
                onClick={() => handleSort('periodRatio')}
                className="py-3 px-3 text-center cursor-pointer hover:text-white transition-colors"
              >
                <div className="flex items-center justify-center gap-1 text-amber-300 font-bold">
                  <span>污自比</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>

              {/* 12M Daily Average */}
              <th
                onClick={() => handleSort('twelveAvg')}
                className="py-3 px-3 text-right cursor-pointer hover:text-white transition-colors"
              >
                <div className="flex items-center justify-end gap-1 text-teal-300 font-bold">
                  <span>前12月日均 (m³/日)</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>

              <th
                onClick={() => handleSort('anomaly')}
                className="py-3 px-3 text-center cursor-pointer hover:text-white transition-colors"
                title="點擊依異常嚴重程度進行排序 (嚴重異常 🔴 > 警戒關注 🟡 > 正常合格 🟢)"
              >
                <div className="flex items-center justify-center gap-1 font-bold text-amber-300">
                  <span>疑似異常初判</span>
                  <ArrowUpDown className={`w-3 h-3 ${sortField === 'anomaly' ? 'text-cyan-400' : 'text-slate-400'}`} />
                </div>
              </th>
              <th className="py-3 px-3 text-center w-20">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
            {pagedData.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <Droplets className="w-8 h-8 text-slate-600 animate-pulse" />
                    <span>目前尚無水錶廠商抄錶成果數據</span>
                    <span className="text-[11px] text-slate-500">
                      請於上方啟動線上即時批次爬蟲，或調整統計年月條件。
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              pagedData.map((item, index) => {
                const isSelected = selectedIds.has(item.waterId);
                const ratio = item.periodRatio;
                const ratioPct = ratio !== null ? (ratio * 100).toFixed(1) : null;
                const isRatioDanger = ratio !== null && ratio > 1.2;
                const isRatioWarning = ratio !== null && ((ratio > 1.0 && ratio <= 1.2) || ratio < 0.35);
                const latestDate = getVendorLatestBillingDate(item);

                return (
                  <tr
                    key={item.waterId}
                    className={`hover:bg-slate-800/50 transition-colors ${
                      isSelected ? 'bg-cyan-950/20' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => handleToggleSelect(item.waterId)}
                        className="text-slate-400 hover:text-white"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-cyan-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </td>

                    {/* Row Index */}
                    <td className="py-3 px-3 text-center font-mono text-slate-500 text-[11px]">
                      {(currentPage - 1) * pageSize + index + 1}
                    </td>

                    {/* Park Name */}
                    <td className="py-3 px-3 font-medium text-slate-300 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[11px]">
                        {item.parkName || '柳科工業區'}
                      </span>
                    </td>

                    {/* Vendor Name */}
                    <td className="py-3 px-3 font-bold text-white max-w-xs truncate">
                      <span title={item.name}>{item.name}</span>
                    </td>

                    {/* Water Name */}
                    <td className="py-3 px-3 text-slate-300 font-mono text-xs">
                      <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                        {item.waterName}
                      </span>
                    </td>

                    {/* Latest Billing Date */}
                    <td className="py-3 px-3 text-center font-mono text-xs text-slate-300 whitespace-nowrap">
                      <span className="bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800 text-cyan-300 font-medium">
                        {latestDate}
                      </span>
                    </td>

                    {/* Sewage Volume */}
                    <td className="py-3 px-3 text-right font-mono font-bold text-cyan-300">
                      {item.periodWw !== null && item.periodWw !== undefined ? (
                        <span>{item.periodWw.toLocaleString()}</span>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>

                    {/* Water Volume */}
                    <td className="py-3 px-3 text-right font-mono font-bold text-blue-300">
                      {item.periodWater !== null && item.periodWater !== undefined ? (
                        <span>{item.periodWater.toLocaleString()}</span>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>

                    {/* Ratio */}
                    <td className="py-3 px-3 text-center font-mono">
                      {ratioPct !== null ? (
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          isRatioDanger
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : isRatioWarning
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        }`}>
                          {ratioPct}%
                        </span>
                      ) : (
                        <span className="text-slate-600 text-xs">-</span>
                      )}
                    </td>

                    {/* 12M Daily Average (m³/日) */}
                    <td className="py-3 px-3 text-right font-mono">
                      {item.twelveAvg !== null && item.twelveAvg !== undefined ? (
                        <span className="text-teal-300 font-bold bg-teal-950/40 px-2 py-0.5 rounded border border-teal-500/30">
                          {item.twelveAvg}
                        </span>
                      ) : (
                        <span className="text-slate-600 text-xs">無數據</span>
                      )}
                    </td>

                    {/* Anomaly Diagnosis */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {item.anomaly?.hasAnomaly ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.anomaly.severity === 'danger'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          }`}
                          title={[...item.anomaly.reasons, ...(item.anomaly.notes || [])].join('\n')}
                        >
                          <AlertTriangle className="w-3 h-3" />
                          {item.anomaly.tags[0] || '異常'}
                        </span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium ${
                            item.anomaly?.tags?.[0]?.includes('無用水無排水') || ((item.periodWw === 0 || item.periodWw === null) && (item.periodWater === 0 || item.periodWater === null))
                              ? 'bg-slate-800 text-slate-300 border border-slate-700 font-normal'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}
                          title={item.anomaly?.notes && item.anomaly.notes.length > 0 ? item.anomaly.notes.join('\n') : (item.anomaly?.reasons?.[0] || '正常')}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          {item.anomaly?.tags?.[0] || '正常'}
                        </span>
                      )}
                    </td>

                    {/* Action button */}
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => onSelectVendor(item)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-cyan-500/30 transition-all font-medium text-[11px]"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        詳細
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="text-slate-400 flex items-center gap-2">
          <span>
            顯示第 <span className="text-white font-semibold">{(currentPage - 1) * pageSize + (sortedData.length > 0 ? 1 : 0)}</span> 至{' '}
            <span className="text-white font-semibold">{Math.min(currentPage * pageSize, sortedData.length)}</span> 筆，
            共 <span className="text-white font-semibold">{sortedData.length}</span> 筆水錶抄錶成果
          </span>
          {selectedIds.size > 0 && (
            <span className="text-cyan-400 bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-500/30 font-semibold">
              已勾選 {selectedIds.size} 筆
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded-lg px-2 py-1 focus:outline-none"
          >
            <option value={10}>每頁 10 筆</option>
            <option value={15}>每頁 15 筆</option>
            <option value={30}>每頁 30 筆</option>
            <option value={50}>每頁 50 筆</option>
            <option value={100}>每頁 100 筆</option>
          </select>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded bg-slate-900 border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-900"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 text-slate-400 font-mono">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="p-1 rounded bg-slate-900 border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-900"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
