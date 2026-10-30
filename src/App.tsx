/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Table as TableIcon,
  TrendingUp,
  Waves,
  ShieldCheck,
  LogOut,
  CheckCircle2,
  Trash2,
} from 'lucide-react';

import { VendorSewageData, ParkOption, WeatherStation, RainfallRecord } from './types';
import { DETECTED_PARKS_LIST, extractParksFromVendors } from './data/mockData';
import { CWA_WEATHER_STATIONS, DEFAULT_PARK_STATION_MAP, getStationIdForPark } from './data/weatherStations';
import { enrichVendorDataWithAnalysis } from './utils/anomalyAnalysis';
import { StatsCards } from './components/StatsCards';
import { ChartsView } from './components/ChartsView';
import { DataTable } from './components/DataTable';
import { DetailModal } from './components/DetailModal';
import { LiveCrawler } from './components/LiveCrawler';

export default function App() {
  const [vendors, setVendors] = useState<VendorSewageData[]>([]);
  const [rawVendors, setRawVendors] = useState<VendorSewageData[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<VendorSewageData | null>(null);
  const [activeView, setActiveView] = useState<'crawler' | 'charts'>('crawler');
  const [parksList, setParksList] = useState<ParkOption[]>(DETECTED_PARKS_LIST);

  // Weather station mapping per industrial park (相同工業區採用相同測站)
  const [parkStationMap, setParkStationMap] = useState<Record<string, string>>(DEFAULT_PARK_STATION_MAP);
  // Rainfall records cache: stationId -> Record<cleanDate, rainfallMM>
  const [stationRainfallMap, setStationRainfallMap] = useState<Record<string, Record<string, number>>>({});
  // Rainfall records list for charts: stationId -> RainfallRecord[]
  const [stationRainfallRecords, setStationRainfallRecords] = useState<Record<string, RainfallRecord[]>>({});

  // Synchronized filter states between Overview and DataTable
  const [tableAnomalyFilter, setTableAnomalyFilter] = useState<string>('all');
  const [tableParkFilter, setTableParkFilter] = useState<string>('');

  // User authentication state
  const [currentUser, setCurrentUser] = useState<{
    userName: string;
    loginType: 'sso' | 'normal';
    token?: string;
  } | null>(null);

  // 自動從廠商資料中計算水錶抄錶區間 (YYYY-MM-DD 與 YYYY-MM)
  const vendorsDateRange = useMemo(() => {
    let minD = '';
    let maxD = '';
    rawVendors.forEach((v) => {
      (v.waterBillingDays || []).forEach((d) => {
        if (!d.billingDate) return;
        const clean = d.billingDate.split('T')[0].split(' ')[0].replace(/\//g, '-');
        if (!minD || clean < minD) minD = clean;
        if (!maxD || clean > maxD) maxD = clean;
      });
      if (v.billingDate) {
        const clean = v.billingDate.split('T')[0].split(' ')[0].replace(/\//g, '-');
        if (!minD || clean < minD) minD = clean;
        if (!maxD || clean > maxD) maxD = clean;
      }
    });
    return {
      startDate: minD,
      endDate: maxD,
      startPeriod: minD ? minD.slice(0, 7) : new Date().toISOString().slice(0, 7),
      endPeriod: maxD ? maxD.slice(0, 7) : new Date().toISOString().slice(0, 7),
    };
  }, [rawVendors]);

  // Fetch rainfall data for stations (支援指定測站、起始結束年月與日期過濾)
  const fetchRainfallForStations = async (
    stationsToFetch: string[],
    startPeriodStr?: string,
    endPeriodStr?: string,
    startDateStr?: string,
    endDateStr?: string
  ) => {
    const sPeriod = startPeriodStr || vendorsDateRange.startPeriod || new Date().toISOString().slice(0, 7);
    const ePeriod = endPeriodStr || vendorsDateRange.endPeriod || sPeriod;
    const newRainfallMap: Record<string, Record<string, number>> = { ...stationRainfallMap };
    const newRecordsMap: Record<string, RainfallRecord[]> = { ...stationRainfallRecords };

    for (const stnId of stationsToFetch) {
      try {
        let url = `/api/proxy/cwa/rainfall?stationId=${encodeURIComponent(stnId)}&startPeriod=${encodeURIComponent(sPeriod)}&endPeriod=${encodeURIComponent(ePeriod)}`;
        if (startDateStr) url += `&startDate=${encodeURIComponent(startDateStr)}`;
        if (endDateStr) url += `&endDate=${encodeURIComponent(endDateStr)}`;

        const res = await fetch(url);
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          const map: Record<string, number> = { ...(newRainfallMap[stnId] || {}) };
          json.data.forEach((r: any) => {
            if (r.date) {
              const cleanDate = r.date.replace(/-/g, '/');
              map[cleanDate] = Number(r.rainfall || 0);
            }
          });
          newRainfallMap[stnId] = map;
          newRecordsMap[stnId] = json.data;
        }
      } catch (err) {
        console.error('Failed to fetch rainfall for station', stnId, err);
      }
    }

    setStationRainfallMap(newRainfallMap);
    setStationRainfallRecords(newRecordsMap);
    return newRainfallMap;
  };

  // Initial fetch for default stations (柳科 -> C0X320 柳營, 新吉 -> C2O950 安南, C0X250 新營)
  useEffect(() => {
    fetchRainfallForStations(['C0X320', 'C2O950', 'C0X250']);
  }, []);

  // 當廠商資料載入或水錶區間變更時，自動為該期間重新精準抓取測站降水量
  useEffect(() => {
    if (rawVendors.length > 0) {
      const activeStations = ['C0X320', 'C2O950', 'C0X250'];
      Object.values(parkStationMap).forEach((stn) => {
        if (!activeStations.includes(stn)) activeStations.push(stn);
      });
      fetchRainfallForStations(
        activeStations,
        vendorsDateRange.startPeriod,
        vendorsDateRange.endPeriod,
        vendorsDateRange.startDate,
        vendorsDateRange.endDate
      );
    }
  }, [rawVendors, vendorsDateRange.startPeriod, vendorsDateRange.endPeriod]);

  // Update park station selection (相同工業區採用相同測站)
  const handleUpdateParkStation = async (parkKey: string, stationId: string) => {
    const updated = { ...parkStationMap, [parkKey]: stationId };
    setParkStationMap(updated);

    // Fetch rainfall for this station if not yet cached
    if (!stationRainfallMap[stationId]) {
      await fetchRainfallForStations(
        [stationId],
        vendorsDateRange.startPeriod,
        vendorsDateRange.endPeriod,
        vendorsDateRange.startDate,
        vendorsDateRange.endDate
      );
    }
  };

  // Re-enrich vendor data whenever rawVendors or stationRainfallMap or parkStationMap changes
  useEffect(() => {
    if (rawVendors.length === 0) {
      setVendors([]);
      return;
    }

    const enriched = rawVendors.map((v) => {
      const stnId = getStationIdForPark(v.parkName, parkStationMap);
      const rainMap = stationRainfallMap[stnId] || stationRainfallMap['C0X320'] || {};
      const stnInfo = CWA_WEATHER_STATIONS.find((s) => s.id === stnId);
      
      const analyzed = enrichVendorDataWithAnalysis(v, rainMap);
      return {
        ...analyzed,
        stationId: stnId,
        stationName: stnInfo?.name || stnId,
      };
    });

    setVendors(enriched);

    // If modal is open, keep selected vendor in sync
    if (selectedVendor) {
      const updatedSel = enriched.find((item) => item.waterId === selectedVendor.waterId);
      if (updatedSel) setSelectedVendor(updatedSel);
    }
  }, [rawVendors, stationRainfallMap, parkStationMap]);

  // Fetch detected parks on mount or when token is updated
  useEffect(() => {
    const fetchParks = async () => {
      try {
        const headers: Record<string, string> = {};
        if (currentUser?.token) {
          headers['Authorization'] = `Bearer ${currentUser.token}`;
        }
        const res = await fetch('/api/proxy/parks', { headers });
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setParksList(json.data);
        }
      } catch {
        setParksList(DETECTED_PARKS_LIST);
      }
    };
    fetchParks();
  }, [currentUser]);

  // Handle data extracted
  const handleDataExtracted = (extracted: VendorSewageData[]) => {
    setRawVendors(extracted);
    const updatedParks = extractParksFromVendors(extracted);
    setParksList(updatedParks);
  };

  // Handle import data
  const handleImportData = (imported: VendorSewageData[]) => {
    setRawVendors(imported);
    const updatedParks = extractParksFromVendors(imported);
    setParksList(updatedParks);
    alert(`成功匯入 ${imported.length} 筆水錶排放數據！系統已自動連結氣象測站降水量，並完成污自比與疑似雨污混流異常初判。`);
  };

  // Clear data
  const handleClearData = () => {
    if (confirm('確定要清空目前已擷取的水錶數據清單嗎？')) {
      setRawVendors([]);
      setVendors([]);
      setSelectedVendor(null);
    }
  };


  // Handle successful login
  const handleLoginSuccess = (token: string, accountInfo: { userName: string; loginType: string }) => {
    setCurrentUser({
      userName: accountInfo.userName,
      loginType: accountInfo.loginType === 'normal' ? 'normal' : 'sso',
      token,
    });
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-900/30 ring-1 ring-white/20">
              <Waves className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  臺南經發局工業區園區廠商水錶檢核系統
                </h1>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                彙整每日污水量 · 自來水使用量 · 污自比 · 疑似異常初判
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* User Status Badge */}
            {currentUser && (
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <div className="flex flex-col text-left">
                  <span className="font-bold text-white text-[11px] flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                    {currentUser.loginType === 'sso' ? '公務' : '一般'}: {currentUser.userName}
                  </span>
                  <span className="text-[10px] text-emerald-400">已通過認證</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="ml-2 p-1 text-slate-400 hover:text-rose-400 transition-colors"
                  title="登出帳號"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* View Tabs: 保留且僅保留「水錶數據監測總覽」與「每日污水排放折線圖與趨勢」 */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-2 overflow-x-auto pb-1 text-xs font-medium border-t border-slate-900">
          <button
            onClick={() => setActiveView('crawler')}
            className={`px-5 py-2.5 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap text-xs ${
              activeView === 'crawler'
                ? 'border-cyan-400 text-cyan-400 font-bold bg-slate-900/60 shadow-sm'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <TableIcon className="w-4 h-4" />
            水錶數據監測總覽 ({vendors.length})
          </button>
          <button
            onClick={() => setActiveView('charts')}
            className={`px-5 py-2.5 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap text-xs ${
              activeView === 'charts'
                ? 'border-cyan-400 text-cyan-400 font-bold bg-slate-900/60 shadow-sm'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            每日污水排放折線圖與趨勢
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* View 1: 水錶數據監測總覽 */}
        {activeView === 'crawler' && (
          <div className="space-y-6">
            {/* Live Crawler with Graphical Captcha Login */}
            <LiveCrawler
              onDataExtracted={handleDataExtracted}
              currentToken={currentUser?.token}
              parksList={parksList}
              onLoginSuccess={handleLoginSuccess}
            />

            {/* 總覽資訊：包含選擇工業區、統計區間、自來水使用量、污水排放量、疑似異常項目 */}
            <StatsCards
              data={vendors}
              parksList={parksList}
              onParkChange={(p) => setTableParkFilter(p)}
              onFilterAnomaly={(type) => setTableAnomalyFilter(type)}
            />

            {/* Quick Action Bar if data exists */}
            {vendors.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-xs">
                <div className="flex items-center gap-2 text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>
                    目前已載入 <strong className="text-white font-mono">{vendors.length}</strong> 筆水錶排放數據（目標工業區：
                    <span className="text-cyan-400 font-semibold">柳科工業區、新吉工業區</span>）
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setActiveView('charts')}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-600/20 text-cyan-300 hover:bg-cyan-600/30 border border-cyan-500/30 transition-colors font-medium"
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    查看每日折線圖
                  </button>
                  <button
                    onClick={handleClearData}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-rose-400 hover:bg-slate-700 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    清空數據
                  </button>
                </div>
              </div>
            )}

            {/* 用水量與排放抄錶成果清單 (支援選擇不同統計年月日) */}
            <DataTable
              data={vendors}
              parksList={parksList}
              onSelectVendor={(v) => setSelectedVendor(v)}
              onImportData={handleImportData}
              presetAnomalyFilter={tableAnomalyFilter}
              presetParkFilter={tableParkFilter}
            />
          </div>
        )}

        {/* View 2: 每日污水排放折線圖與趨勢 */}
        {activeView === 'charts' && (
          <div className="space-y-6">
            {/* Overview with filters */}
            <StatsCards
              data={vendors}
              parksList={parksList}
              onParkChange={(p) => setTableParkFilter(p)}
              onFilterAnomaly={(type) => setTableAnomalyFilter(type)}
            />

            {/* Charts View */}
            <ChartsView
              data={vendors}
              selectedParkFilter={tableParkFilter}
              onSelectVendor={(v) => setSelectedVendor(v)}
              stationRainfallMap={stationRainfallMap}
              stationRainfallRecords={stationRainfallRecords}
              parkStationMap={parkStationMap}
              onUpdateParkStation={handleUpdateParkStation}
              onFetchStationRainfall={(stnId) =>
                fetchRainfallForStations(
                  [stnId],
                  vendorsDateRange.startPeriod,
                  vendorsDateRange.endPeriod,
                  vendorsDateRange.startDate,
                  vendorsDateRange.endDate
                )
              }
            />
          </div>
        )}
      </main>

      {/* Vendor Detail Modal */}
      {selectedVendor && (
        <DetailModal
          vendor={selectedVendor}
          onClose={() => setSelectedVendor(null)}
        />
      )}

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 space-y-2">
          <p>
            臺南經發局工業區園區廠商水錶檢核系統 · 柳科工業區 & 新吉工業區用水量與排放抄錶成果智慧檢核
          </p>
          <p className="text-[11px] text-slate-600 font-mono">
            目標欄位代碼：.v-col.v-col-auto.align-self-center.py-2 | 前12個月平均每日污水水量 (m³/日)
          </p>
        </div>
      </footer>
    </div>
  );
}
