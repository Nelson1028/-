import { ParkOption, VendorSewageData } from '../types';

/**
 * 目標平臺目前實際在線之工業區名單：
 * 目標平臺 (https://industrialmgr.tainan.gov.tw/paymentBill/sewageMeter) 僅建置柳科工業區與新吉工業區。
 * 其他無資料之工業區已排除。
 */
export const DETECTED_PARKS_LIST: ParkOption[] = [
  { id: '', name: '全部工業區' },
  { id: 'LiouYing', name: '柳科工業區 (柳營科技工業區)' },
  { id: 'SinJi', name: '新吉工業區' },
];

export const PARKS_LIST = DETECTED_PARKS_LIST;

/**
 * 依據廠商清單，自動動態彙整與同步工業區選項
 */
export function extractParksFromVendors(vendors: VendorSewageData[]): ParkOption[] {
  const parkMap = new Map<string, string>();
  
  // 預設已偵測的有效工業區
  parkMap.set('LiouYing', '柳科工業區 (柳營科技工業區)');
  parkMap.set('SinJi', '新吉工業區');

  // 從實際資料中動態抽取
  vendors.forEach((v) => {
    if (v.parkName && v.parkName.trim()) {
      const pName = v.parkName.trim();
      if (pName.includes('柳') || pName.toLowerCase().includes('liou')) {
        parkMap.set('LiouYing', pName);
      } else if (pName.includes('新吉') || pName.toLowerCase().includes('sinji')) {
        parkMap.set('SinJi', pName);
      } else {
        parkMap.set(pName, pName);
      }
    }
  });

  const list: ParkOption[] = [{ id: '', name: '全部工業區' }];
  for (const [id, name] of parkMap.entries()) {
    list.push({ id, name });
  }

  return list;
}

// 0 筆初始資料，完全由線上擷取或匯入
export const SAMPLE_VENDORS: VendorSewageData[] = [];
