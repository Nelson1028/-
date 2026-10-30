import { WeatherStation, RainfallRecord } from '../types';

/**
 * 交通部中央氣象署 (CWA) 官方氣象測站清單 (經中央氣象署 Open Data API 與 CODIS 實測驗證)
 * 依據臺南市各主要工業區地理位置配置對應氣象測站
 */
export const CWA_WEATHER_STATIONS: WeatherStation[] = [
  // 柳科工業區 (柳營科技工業區) 首要與鄰近測站
  {
    id: 'C0X320',
    name: '柳營 (C0X320)',
    stnType: 'auto_C0',
    parkId: 'LiouYing',
    isDefault: true,
    desc: '臺南市柳營區 (柳科工業區官方首選測站)',
  },
  {
    id: 'C0X250',
    name: '新營 (C0X250)',
    stnType: 'auto_C0',
    parkId: 'LiouYing',
    desc: '臺南市新營區 (鄰近柳科/新營主要測站)',
  },
  {
    id: 'C2X060',
    name: '下營 (C2X060 / C0X060)',
    stnType: 'agr',
    parkId: 'LiouYing',
    desc: '臺南市下營區 (原 C0X060，新舊資料自動相容切換)',
  },
  {
    id: 'C0X130',
    name: '官田 (C0X130)',
    stnType: 'auto_C0',
    parkId: 'LiouYing',
    desc: '臺南市官田區 (官田工業區/六甲鄰近測站)',
  },
  {
    id: 'C1X040',
    name: '東山東原 (C1X040)',
    stnType: 'auto_C0',
    parkId: 'LiouYing',
    desc: '臺南市東山區 (東山集水區測站)',
  },
  {
    id: 'C0X210',
    name: '白河 (C0X210)',
    stnType: 'auto_C0',
    parkId: 'LiouYing',
    desc: '臺南市白河區 (白河測站)',
  },
  {
    id: 'C0X260',
    name: '後壁 (C0X260)',
    stnType: 'auto_C0',
    parkId: 'LiouYing',
    desc: '臺南市後壁區 (蘭花生物科技園區鄰近測站)',
  },
  {
    id: 'C0X230',
    name: '鹽水 (C0X230)',
    stnType: 'auto_C0',
    parkId: 'LiouYing',
    desc: '臺南市鹽水區 (鹽水測站)',
  },

  // 新吉工業區 首要與鄰近測站
  {
    id: 'C2O950',
    name: '安南 (C2O950 / C0O950)',
    stnType: 'agr',
    parkId: 'SinJi',
    isDefault: true,
    desc: '臺南市安南區 (新吉工業區官方首選測站，自動相容 C0O950)',
  },
  {
    id: 'C0N020',
    name: '城西 (C0N020)',
    stnType: 'auto_C0',
    parkId: 'SinJi',
    desc: '臺南市安南區城西 (新吉工業區西側雨量站)',
  },
  {
    id: 'C0N030',
    name: '四草 (C0N030)',
    stnType: 'auto_C0',
    parkId: 'SinJi',
    desc: '臺南市安南區四草 (安南濱海測站)',
  },
  {
    id: 'C0X150',
    name: '安定 (C0X150)',
    stnType: 'auto_C0',
    parkId: 'SinJi',
    desc: '臺南市安定區 (安定/新吉交界首要測站)',
  },
  {
    id: 'C0X140',
    name: '西港 (C0X140)',
    stnType: 'auto_C0',
    parkId: 'SinJi',
    desc: '臺南市西港區 (西港測站，鄰近新吉北側)',
  },
  {
    id: '467420',
    name: '永康 (467420)',
    stnType: 'cwb',
    parkId: 'SinJi',
    desc: '臺南市永康區 (中央氣象署有人標準氣象站)',
  },
  {
    id: '467410',
    name: '臺南 (467410)',
    stnType: 'cwb',
    parkId: 'SinJi',
    desc: '臺南市中西區 (百年歷史基準標準氣象站)',
  },
  {
    id: 'C0X190',
    name: '安平 (C0X190)',
    stnType: 'auto_C0',
    parkId: 'SinJi',
    desc: '臺南市安平區 (安平港區測站)',
  },
  {
    id: '72N240',
    name: '七股 (72N240)',
    stnType: 'agr',
    parkId: 'SinJi',
    desc: '臺南市七股區 (七股沿海研究中心測站)',
  },

  // 臺南市其他常用工業區與重要行政區氣象測站
  {
    id: 'C0O900',
    name: '善化 (C0O900)',
    stnType: 'auto_C0',
    parkId: 'all',
    desc: '臺南市善化區 (南部科學園區核心測站)',
  },
  {
    id: 'C0O980',
    name: '新市 (C0O980)',
    stnType: 'auto_C0',
    parkId: 'all',
    desc: '臺南市新市區 (南科新市測站)',
  },
  {
    id: 'C0X080',
    name: '佳里 (C0X080)',
    stnType: 'auto_C0',
    parkId: 'all',
    desc: '臺南市佳里區 (佳里自動氣象站)',
  },
  {
    id: 'C0X120',
    name: '麻豆 (C0X120)',
    stnType: 'auto_C0',
    parkId: 'all',
    desc: '臺南市麻豆區 (麻豆自動氣象站)',
  },
  {
    id: 'C0X160',
    name: '仁德 (C0X160)',
    stnType: 'auto_C0',
    parkId: 'all',
    desc: '臺南市仁德區 (仁德工業區/保安測站)',
  },
  {
    id: 'C1N001',
    name: '歸仁沙崙 (C1N001)',
    stnType: 'auto_C0',
    parkId: 'all',
    desc: '臺南市歸仁區 (沙崙綠能科學城測站)',
  },
  {
    id: 'C0X170',
    name: '關廟 (C0X170)',
    stnType: 'auto_C0',
    parkId: 'all',
    desc: '臺南市關廟區 (關廟自動測站)',
  },
  {
    id: 'C0X220',
    name: '學甲 (C0X220)',
    stnType: 'auto_C0',
    parkId: 'all',
    desc: '臺南市學甲區 (學甲自動氣象站)',
  },
  {
    id: 'C0X280',
    name: '將軍 (C0X280)',
    stnType: 'auto_C0',
    parkId: 'all',
    desc: '臺南市將軍區 (將軍區測站)',
  },
  {
    id: 'C0X290',
    name: '北門 (C0X290)',
    stnType: 'auto_C0',
    parkId: 'all',
    desc: '臺南市北門區 (北門濱海測站)',
  },
  {
    id: 'C2O930',
    name: '玉井 (C2O930)',
    stnType: 'agr',
    parkId: 'all',
    desc: '臺南市玉井區 (玉井農業氣象站)',
  },
  {
    id: 'C1O921',
    name: '楠西 (C1O921)',
    stnType: 'auto_C0',
    parkId: 'all',
    desc: '臺南市楠西區 (楠西曾文水庫周邊測站)',
  },
  {
    id: 'C0O830',
    name: '南化北寮 (C0O830 / C2O880)',
    stnType: 'auto_C0',
    parkId: 'all',
    desc: '臺南市南化區 (南化水庫周邊測站，自動相容 C2O880)',
  },
];

/**
 * 預設工業區對應氣象測站 (相同工業區採用相同測站)
 * 柳科工業區 -> 柳營測站 (C0X320)
 * 新吉工業區 -> 安南測站 (C2O950)
 */
export const DEFAULT_PARK_STATION_MAP: Record<string, string> = {
  LiouYing: 'C0X320', // 柳科工業區 -> 柳營測站 (C0X320)
  SinJi: 'C2O950',    // 新吉工業區 -> 安南測站 (C2O950)
  default: 'C0X320',
};

/**
 * 輔助依據工業區名稱或代碼獲取預設測站 ID
 */
export function getStationIdForPark(parkNameOrId?: string, customMap?: Record<string, string>): string {
  const map = { ...DEFAULT_PARK_STATION_MAP, ...customMap };
  if (!parkNameOrId) return map.default || 'C0X320';

  if (parkNameOrId.includes('柳') || parkNameOrId.toLowerCase().includes('liou')) {
    return map.LiouYing || 'C0X320';
  }
  if (parkNameOrId.includes('新吉') || parkNameOrId.toLowerCase().includes('sinji')) {
    return map.SinJi || 'C2O950';
  }

  return map[parkNameOrId] || map.default || 'C0X320';
}
