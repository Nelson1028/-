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
