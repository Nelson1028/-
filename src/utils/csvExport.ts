import { VendorSewageData } from '../types';

/**
 * 標準化並解析抄表日期，轉換為標準 YYYY/MM/DD 格式
 */
export function normalizeDate(dStr?: string): string {
  if (!dStr) return '';
  const raw = String(dStr).split('T')[0].split(' ')[0].trim().replace(/-/g, '/');
  const parts = raw.split('/');
  if (parts.length === 3) {
    return `${parts[0].padStart(4, '0')}/${parts[1].padStart(2, '0')}/${parts[2].padStart(2, '0')}`;
  }
  return raw;
}

/**
 * 取得水錶廠商之最新抄錶日期
 */
export function getVendorLatestBillingDate(vendor: VendorSewageData): string {
  const days = vendor.waterBillingDays || [];
  if (days.length > 0) {
    const dates = days
      .map((d) => normalizeDate(d.billingDate))
      .filter(Boolean)
      .sort()
      .reverse();
    if (dates[0]) return dates[0];
  }
  if (vendor.billingDate) {
    return normalizeDate(vendor.billingDate);
  }
  return '-';
}

/**
 * 匯出每日明細 Excel (CSV with UTF-8 BOM 格式)
 * X 軸（橫向欄位標題）依序為：
 * 1. 工業區
 * 2. 廠商名稱
 * 3. 水錶名稱
 * 4. 前12個月日平均污水量
 * 5. 每日污水量（第一天到最後一天）
 * 6. 異常初判狀態
 * 7. 異常診斷原因
 * 8. 本月目前累積污水排放量 (m³)
 * 9. 本月累積自來水使用量 (m³)
 * 10. 污自比
 */
export function exportMergedReportCSV(
  data: VendorSewageData[],
  filename = '臺南經發局工業區水錶每日明細表'
): void {
  if (!data || data.length === 0) {
    alert('目前無水錶數據可匯出！');
    return;
  }

  // 1. 蒐集並排序所有水錶中出現過的所有抄錶日期（第一天到最後一天）
  const dateSet = new Set<string>();
  data.forEach((vendor) => {
    (vendor.waterBillingDays || []).forEach((day) => {
      if (day.billingDate) {
        const clean = normalizeDate(day.billingDate);
        if (clean) dateSet.add(clean);
      }
    });
  });

  const sortedDates = Array.from(dateSet).sort((a, b) => a.localeCompare(b));

  if (sortedDates.length === 0) {
    alert('目前所選水錶清單中尚無每日抄錶數據可匯出！');
    return;
  }

  // 2. 建立 X 軸橫向欄位標題
  const headers = [
    '工業區',
    '廠商名稱',
    '水錶名稱',
    '前12個月日平均污水量',
    ...sortedDates.map((date) => `"${date} 每日污水量(m³)"`),
    '異常初判狀態',
    '異常診斷原因',
    '本月目前累積污水排放量 (m³)',
    '本月累積自來水使用量 (m³)',
    '污自比',
  ];

  // 3. 逐筆水錶組裝資料
  const rows = data.map((vendor) => {
    const ratioStr = vendor.ratio !== null && vendor.ratio !== undefined ? `${(vendor.ratio * 100).toFixed(1)}%` : '-';
    const anomalyStatus = vendor.anomaly?.hasAnomaly
      ? vendor.anomaly.severity === 'danger'
        ? '嚴重異常'
        : '警戒關注'
      : '正常合格';
    const anomalyReasons = vendor.anomaly?.reasons?.join('; ') || '無異常';

    const dayMap = new Map<string, number | null>();
    (vendor.waterBillingDays || []).forEach((day) => {
      const clean = normalizeDate(day.billingDate);
      if (clean) {
        dayMap.set(clean, day.dayWwVolume !== undefined && day.dayWwVolume !== null ? day.dayWwVolume : null);
      }
    });

    const dailyCols = sortedDates.map((date) => {
      const val = dayMap.get(date);
      if (val !== undefined && val !== null) {
        return String(val);
      }
      return '';
    });

    return [
      `"${(vendor.parkName || '').replace(/"/g, '""')}"`,
      `"${(vendor.name || '').replace(/"/g, '""')}"`,
      `"${(vendor.waterName || '').replace(/"/g, '""')}"`,
      vendor.twelveAvg !== null && vendor.twelveAvg !== undefined ? String(vendor.twelveAvg) : '',
      ...dailyCols,
      `"${anomalyStatus}"`,
      `"${anomalyReasons.replace(/"/g, '""')}"`,
      vendor.wwVolume !== null && vendor.wwVolume !== undefined ? vendor.wwVolume : '',
      vendor.waterVolume !== null && vendor.waterVolume !== undefined ? vendor.waterVolume : '',
      `"${ratioStr}"`,
    ];
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const startStr = sortedDates[0]?.replace(/\//g, '') || '';
  const endStr = sortedDates[sortedDates.length - 1]?.replace(/\//g, '') || '';
  const rangeName = startStr && endStr ? `_${startStr}-${endStr}` : `_${new Date().toISOString().slice(0, 10)}`;
  link.setAttribute('download', `${filename}${rangeName}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// 相容別名導出
export const exportDailyDetailCSV = exportMergedReportCSV;
export const exportToCSV = exportMergedReportCSV;

/**
 * 降雨強度分級評等
 */
export function getRainGrade(rainfall: number): string {
  if (rainfall <= 0) return '無雨 (0mm)';
  if (rainfall < 10) return `小雨 (${rainfall}mm)`;
  if (rainfall < 50) return `中雨 (${rainfall}mm)`;
  if (rainfall < 80) return `大雨 (${rainfall}mm)`;
  return `豪雨 (${rainfall}mm)`;
}

/**
 * 雨污混流疑似關聯分析
 */
export function diagnoseRainInflow(
  dayWw: number | null,
  dayWater: number | null,
  rainfall: number,
  twelveAvg: number | null
): string {
  const isZero = (!dayWw || dayWw === 0) && (!dayWater || dayWater === 0);
  if (isZero) return '正常 (無用水無排水)';

  const ww = dayWw || 0;
  if (rainfall >= 15) {
    if (twelveAvg && twelveAvg > 0 && ww >= twelveAvg * 1.8 && ww >= 10) {
      return `🔴 疑似雨水滲入 (雨量 ${rainfall}mm，排放量達日均 ${(ww / twelveAvg).toFixed(1)} 倍)`;
    } else if (twelveAvg && twelveAvg > 0 && ww >= twelveAvg * 1.3) {
      return `🟡 輕微雨水混入警戒 (雨量 ${rainfall}mm，排放量高於日均)`;
    }
    return `🟢 正常 (雨天排水無異常)`;
  }

  if (rainfall < 5 && twelveAvg && twelveAvg > 0 && ww >= twelveAvg * 2.5 && ww >= 20) {
    return `🟡 晴天異常突增 (無降雨但排放量暴增)`;
  }

  return '🟢 正常合格';
}

/**
 * 匯出單一廠商水錶與指定氣象測站之日降雨量比對成果 (Excel / CSV)
 */
export function exportRainfallComparisonCSV(
  vendor: VendorSewageData,
  stationId: string,
  stationName: string,
  rainfallMap: Record<string, number>,
  filename = '水錶每日排放量與氣象署測站降雨量比對成果'
): void {
  const days = vendor.waterBillingDays || [];
  if (days.length === 0) {
    alert('該水錶尚無每日抄錶數據可供匯出比對！');
    return;
  }

  const sortedDays = [...days].sort((a, b) =>
    (a.billingDate || '').localeCompare(b.billingDate || '')
  );

  const headers = [
    '抄錶日期',
    '工業區',
    '廠商名稱',
    '水錶名稱',
    '水錶編號',
    '氣象署測站編號',
    '氣象署測站名稱',
    '氣象資料來源網址',
    '當日降雨量 (mm)',
    '雨量分級',
    '當日污水排放量 (m³/日)',
    '當日自來水用量 (m³/日)',
    '當日污自比',
    '前12個月日平均污水量 (m³/日)',
    '較日均增減比率',
    '雨污混流初判診斷',
    '抄錶備註',
  ];

  const rows = sortedDays.map((d) => {
    const cleanDate = normalizeDate(d.billingDate);
    const rain = rainfallMap[cleanDate] ?? 0;
    const dayWw = d.dayWwVolume !== null && d.dayWwVolume !== undefined ? d.dayWwVolume : null;
    const dayWater = d.dayWaterVolume !== null && d.dayWaterVolume !== undefined ? d.dayWaterVolume : null;
    const ratioStr =
      dayWw !== null && dayWater !== null && dayWater > 0
        ? `${((dayWw / dayWater) * 100).toFixed(1)}%`
        : '-';

    let diffAvgStr = '-';
    if (dayWw !== null && vendor.twelveAvg && vendor.twelveAvg > 0) {
      const diffPct = (((dayWw - vendor.twelveAvg) / vendor.twelveAvg) * 100).toFixed(1);
      diffAvgStr = `${Number(diffPct) >= 0 ? '+' : ''}${diffPct}%`;
    }

    const inflowDiag = diagnoseRainInflow(dayWw, dayWater, rain, vendor.twelveAvg);

    return [
      `"${cleanDate}"`,
      `"${(vendor.parkName || '').replace(/"/g, '""')}"`,
      `"${(vendor.name || '').replace(/"/g, '""')}"`,
      `"${(vendor.waterName || '').replace(/"/g, '""')}"`,
      `"${vendor.waterId || ''}"`,
      `"${stationId}"`,
      `"${stationName}"`,
      `"https://codis.cwa.gov.tw/StationData"`,
      rain,
      `"${getRainGrade(rain)}"`,
      dayWw !== null ? dayWw : '',
      dayWater !== null ? dayWater : '',
      `"${ratioStr}"`,
      vendor.twelveAvg !== null && vendor.twelveAvg !== undefined ? vendor.twelveAvg : '',
      `"${diffAvgStr}"`,
      `"${inflowDiag.replace(/"/g, '""')}"`,
      `"${(d.remark || '').replace(/"/g, '""')}"`,
    ];
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const cleanVendorName = (vendor.name || '廠商').replace(/[\\/:*?"<>|]/g, '_');
  link.setAttribute('download', `${cleanVendorName}_${stationName}_${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 批次匯出所有水錶與對應氣象測站之降雨量與污水排放比對總表 (Excel / CSV)
 */
export function exportBatchRainfallComparisonCSV(
  vendors: VendorSewageData[],
  stationRainfallMap: Record<string, Record<string, number>>,
  getStationName: (stnId: string) => string,
  filename = '臺南工業區廠商水錶排放與氣象署降雨量批次比對總表'
): void {
  if (!vendors || vendors.length === 0) {
    alert('目前尚無水錶資料可供批次比對匯出！');
    return;
  }

  const headers = [
    '抄錶日期',
    '工業區',
    '廠商名稱',
    '水錶名稱',
    '水錶編號',
    '氣象測站編號',
    '氣象測站名稱',
    '資料來源',
    '當日降雨量 (mm)',
    '雨量分級',
    '當日污水量 (m³/日)',
    '當日自來水量 (m³/日)',
    '當日污自比',
    '12個月日均量 (m³/日)',
    '雨污關聯初判',
  ];

  const rows: string[][] = [];

  vendors.forEach((vendor) => {
    const stnId = vendor.stationId || 'C0X090';
    const stnName = getStationName(stnId);
    const rainMap = stationRainfallMap[stnId] || {};
    const days = vendor.waterBillingDays || [];

    days.forEach((d) => {
      const cleanDate = normalizeDate(d.billingDate);
      const rain = rainMap[cleanDate] ?? 0;
      const dayWw = d.dayWwVolume !== null && d.dayWwVolume !== undefined ? d.dayWwVolume : null;
      const dayWater = d.dayWaterVolume !== null && d.dayWaterVolume !== undefined ? d.dayWaterVolume : null;
      const ratioStr =
        dayWw !== null && dayWater !== null && dayWater > 0
          ? `${((dayWw / dayWater) * 100).toFixed(1)}%`
          : '-';

      const inflowDiag = diagnoseRainInflow(dayWw, dayWater, rain, vendor.twelveAvg);

      rows.push([
        `"${cleanDate}"`,
        `"${(vendor.parkName || '').replace(/"/g, '""')}"`,
        `"${(vendor.name || '').replace(/"/g, '""')}"`,
        `"${(vendor.waterName || '').replace(/"/g, '""')}"`,
        `"${vendor.waterId || ''}"`,
        `"${stnId}"`,
        `"${stnName}"`,
        `"https://codis.cwa.gov.tw/StationData"`,
        String(rain),
        `"${getRainGrade(rain)}"`,
        dayWw !== null ? String(dayWw) : '',
        dayWater !== null ? String(dayWater) : '',
        `"${ratioStr}"`,
        vendor.twelveAvg !== null && vendor.twelveAvg !== undefined ? String(vendor.twelveAvg) : '',
        `"${inflowDiag.replace(/"/g, '""')}"`,
      ]);
    });
  });

  if (rows.length === 0) {
    alert('所選水錶清單中尚無每日抄錶明細可匯出！');
    return;
  }

  // 依日期與廠商名稱排序
  rows.sort((a, b) => a[0].localeCompare(b[0]) || a[2].localeCompare(b[2]));

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

