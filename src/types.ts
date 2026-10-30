export interface TwelveMonthRecord {
  year: number;
  month: number;
  date: string; // e.g., "2026/08"
  avgDayWwVolume: number;
}

export interface DailyBillingRecord {
  dayBillingId?: string;
  billingDate: string; // e.g., "2026/09/01" or "2026-09-01"
  dayWwVolume: number | null; // 當日污水水量(m³/日)
  dayWaterVolume: number | null; // 當日自來水水量(m³/日)
  wwAccumulate?: number | null; // 污水水錶累計讀值 (m³)
  waterAccumulate?: number | null; // 自來水水錶累計讀值 (m³)
  remark?: string; // 備註 (例如：連續7日未排放污水、讀值倒退等)
  isModifyWwWater?: boolean;
  isModifyWater?: boolean;
}

export type AbnormalSeverity = 'normal' | 'warning' | 'danger';

export interface AbnormalCheck {
  id: string;
  type: 'ratio' | 'consecutive_zero' | 'rollback' | 'surge' | 'exceed_approved' | 'missing_water' | 'rain_inflow';
  title: string;
  severity: AbnormalSeverity;
  description: string;
  detail?: string;
  date?: string;
}

export interface AbnormalSummary {
  hasAnomaly: boolean;
  severity: AbnormalSeverity;
  tags: string[];
  reasons: string[];
  checks: AbnormalCheck[];
  notes?: string[]; // 資訊備註 (如自來水數據異動，僅作備註不跳警示)
}

export interface RainfallRecord {
  date: string; // e.g., "2026/09/01"
  rainfall: number; // 降水量 (mm/日)
  hourlyMax?: number;
  stationId?: string;
  stationName?: string;
}

export interface WeatherStation {
  id: string;
  name: string;
  stnType: 'cwb' | 'auto' | 'auto_C0' | 'agr';
  parkId: 'LiouYing' | 'SinJi' | 'all';
  isDefault?: boolean;
  desc?: string;
}

export interface VendorSewageData {
  waterId: string;
  parkName: string;
  name: string;
  waterName: string;
  billingDate: string;
  twelveAvg: number | null; // 前12個月平均每日污水水量（m³/日）
  wwVolume: number | null; // 本月目前累積污水排放量 (m³)
  waterVolume: number | null; // 本月累積自來水使用量 (m³)
  ratio: number | null; // 本月目前污自比 (目前累積污水排放量 / 本月累積自來水使用量)
  approvedWwVolume?: number | null; // 廠商核准量(m³/日)
  wastewaterVolume?: number | null; // 日容許排放量(m³/日)
  exWwAccumulate?: number | null; // 前期污水水錶累計讀值
  exWaterAccumulate?: number | null; // 前期自來水水錶累計讀值
  billingId?: string;
  twelveMonthDays?: TwelveMonthRecord[];
  waterBillingDays?: DailyBillingRecord[]; // 每日污水量與自來水量排放紀錄
  anomaly?: AbnormalSummary; // 異常排放初步分析
  stationId?: string; // 對應氣象測站
  stationName?: string;
  extractedAt?: string;
  status?: 'success' | 'error' | 'pending';
  error?: string;
}

export interface ParkOption {
  id: string;
  name: string;
  code?: string;
}

export interface CrawlProgress {
  status: 'idle' | 'running' | 'completed' | 'paused' | 'error';
  progress: number; // 0 - 100
  message: string;
  currentVendor?: string;
  processed: number;
  total: number;
  logs: Array<{
    id: string;
    timestamp: string;
    level: 'info' | 'success' | 'warning' | 'error';
    text: string;
  }>;
}

export interface CrawlConfig {
  token: string;
  parkId: string;
  keyword: string;
  period: string; // YYYY-MM
  maxPages: number;
  delayMs: number;
}
