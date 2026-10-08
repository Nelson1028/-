import { WeatherStation, RainfallRecord } from '../types';

/**
 * 交通部中央氣象署 (CWA) 氣象資料開放平臺 / CODIS 氣象測站清單
 * 依據臺南市各主要工業區地理位置配置對應氣象測站
 */
export const CWA_WEATHER_STATIONS: WeatherStation[] = [
  // 柳科工業區 (柳營科技工業區) 鄰近測站
  {
    id: 'C0X090',
    name: '柳營 (C0X090)',
    stnType: 'auto',
    parkId: 'LiouYing',
    isDefault: true,
    desc: '臺南市柳營區 (柳科工業區主要測站)',
  },
  {
    id: '467470',
    name: '新營 (467470)',
    stnType: 'cwb',
    parkId: 'LiouYing',
    desc: '臺南市新營區 (有人氣象站/標準基準站)',
  },
  {
    id: 'C0X060',
    name: '東山 (C0X060)',
    stnType: 'auto',
    parkId: 'LiouYing',
    desc: '臺南市東山區 (東山集水區測站)',
  },
  {
    id: 'C0X080',
    name: '官田 (C0X080)',
    stnType: 'auto',
    parkId: 'LiouYing',
    desc: '臺南市官田區 (官田/六甲測站)',
  },
  {
    id: 'C0X050',
    name: '白河 (C0X050)',
    stnType: 'auto',
    parkId: 'LiouYing',
    desc: '臺南市白河區 (白河測站)',
  },

  // 新吉工業區 鄰近測站
  {
    id: 'C0X250',
    name: '安南 (C0X250)',
    stnType: 'auto',
    parkId: 'SinJi',
    isDefault: true,
    desc: '臺南市安南區 (新吉工業區主要測站)',
  },
  {
    id: 'C0X190',
    name: '安定 (C0X190)',
    stnType: 'auto',
    parkId: 'SinJi',
    desc: '臺南市安定區 (安定/新吉交界測站)',
  },
  {
    id: '467420',
    name: '永康 (467420)',
    stnType: 'cwb',
    parkId: 'SinJi',
    desc: '臺南市永康區 (永康有人氣象站)',
  },
  {
    id: '467410',
    name: '臺南 (467410)',
    stnType: 'cwb',
    parkId: 'SinJi',
    desc: '臺南市中西區 (臺南歷史標準氣象站)',
  },
  {
    id: 'C0X180',
    name: '西港 (C0X180)',
    stnType: 'auto',
    parkId: 'SinJi',
    desc: '臺南市西港區 (西港測站)',
  },
  {
    id: 'C0X210',
    name: '七股 (C0X210)',
    stnType: 'auto',
    parkId: 'SinJi',
    desc: '臺南市七股區 (七股沿海測站)',
  },

  // 臺南周邊其他常用自動氣象站
  {
    id: 'C0X110',
    name: '善化 (C0X110)',
    stnType: 'auto',
    parkId: 'all',
    desc: '臺南市善化區 (南科/善化測站)',
  },
  {
    id: 'C0X170',
    name: '佳里 (C0X170)',
    stnType: 'auto',
    parkId: 'all',
    desc: '臺南市佳里區 (佳里測站)',
  },
  {
    id: 'C0X150',
    name: '麻豆 (C0X150)',
    stnType: 'auto',
    parkId: 'all',
    desc: '臺南市麻豆區 (麻豆測站)',
  },
  {
    id: 'C0X220',
    name: '仁德 (C0X220)',
    stnType: 'auto',
    parkId: 'all',
    desc: '臺南市仁德區 (仁德測站)',
  },
];

/**
 * 預設工業區對應氣象測站 (相同工業區採用相同測站)
 */
export const DEFAULT_PARK_STATION_MAP: Record<string, string> = {
  LiouYing: 'C0X090', // 柳科工業區 -> 柳營測站
  SinJi: 'C0X250',    // 新吉工業區 -> 安南測站
  default: 'C0X090',
};

/**
 * 輔助依據工業區名稱或代碼獲取預設測站 ID
 */
export function getStationIdForPark(parkNameOrId?: string, customMap?: Record<string, string>): string {
  const map = { ...DEFAULT_PARK_STATION_MAP, ...customMap };
  if (!parkNameOrId) return map.default || 'C0X090';

  if (parkNameOrId.includes('柳') || parkNameOrId.toLowerCase().includes('liou')) {
    return map.LiouYing || 'C0X090';
  }
  if (parkNameOrId.includes('新吉') || parkNameOrId.toLowerCase().includes('sinji')) {
    return map.SinJi || 'C0X250';
  }

  return map[parkNameOrId] || map.default || 'C0X090';
}
