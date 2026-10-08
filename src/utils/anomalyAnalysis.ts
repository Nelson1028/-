import { VendorSewageData, AbnormalSummary, AbnormalCheck, AbnormalSeverity, DailyBillingRecord } from '../types';

/**
 * 標準化並解析抄表日期，轉換為標準 YYYY/MM/DD 與 timestamp
 */
function parseBillingDate(dStr?: string): { cleanDate: string; timestamp: number } | null {
  if (!dStr) return null;
  const raw = String(dStr).split('T')[0].split(' ')[0].trim().replace(/-/g, '/');
  const parts = raw.split('/');
  if (parts.length === 3) {
    const y = parts[0].padStart(4, '0');
    const m = parts[1].padStart(2, '0');
    const d = parts[2].padStart(2, '0');
    const cleanDate = `${y}/${m}/${d}`;
    const timestamp = new Date(`${y}-${m}-${d}T00:00:00Z`).getTime();
    return { cleanDate, timestamp: isNaN(timestamp) ? 0 : timestamp };
  }
  return { cleanDate: raw, timestamp: 0 };
}

/**
 * 針對單一水錶資料進行多維度「異常排放初步分析」
 * 嚴格以「抄表日期 (billingDate)」作為時間先後的比較基準，避免因清單排序顛倒（如降冪）導致讀值倒退誤判。
 */
export function analyzeVendorAnomaly(vendor: Partial<VendorSewageData>): AbnormalSummary {
  const checks: AbnormalCheck[] = [];
  const reasons: string[] = [];
  const tags: string[] = [];
  const notes: string[] = [];

  const wwVol = vendor.wwVolume !== null && vendor.wwVolume !== undefined ? Number(vendor.wwVolume) : null;
  const waterVol = vendor.waterVolume !== null && vendor.waterVolume !== undefined ? Number(vendor.waterVolume) : null;
  const twelveAvg = vendor.twelveAvg !== null && vendor.twelveAvg !== undefined ? Number(vendor.twelveAvg) : null;
  const days: DailyBillingRecord[] = vendor.waterBillingDays || [];

  // 計算累積污水/自來水比 (污自比)
  let ratio: number | null = null;
  if (wwVol !== null && waterVol !== null && waterVol > 0) {
    ratio = wwVol / waterVol;
  }

  // 1. 污自比異常檢測 (Sewage to Water Ratio)
  const isZeroBoth = (!wwVol || wwVol === 0) && (!waterVol || waterVol === 0);

  if (ratio !== null) {
    const ratioPct = (ratio * 100).toFixed(1);
    if (ratio > 1.2) {
      // 污自比超過 120% 調整為「嚴重異常水錶」
      const severity: AbnormalSeverity = 'danger';
      const msg = `本月目前污自比達 ${ratioPct}%（超過 120% 警戒上限），可能存在地下水/未申報自備水源納管，或水錶計量偏差，列為嚴重異常水錶。`;
      checks.push({
        id: 'ratio_high',
        type: 'ratio',
        title: '污自比超過120%（嚴重異常）',
        severity,
        description: msg,
        detail: `目前累積污水 ${wwVol?.toLocaleString()} m³ / 自來水 ${waterVol?.toLocaleString()} m³ = ${ratioPct}% (> 120%)`,
      });
      reasons.push(`污自比超過120% (${ratioPct}%)`);
      tags.push(`污自比>120% (嚴重異常)`);
    } else if (ratio > 1.0) {
      // 污自比 > 100% 及 <= 120% 列為「警戒異常」
      const severity: AbnormalSeverity = 'warning';
      const msg = `本月目前污自比達 ${ratioPct}%（介於 100% ~ 120% 之間），污水排放量已大於自來水使用量，列為警戒關注水錶。`;
      checks.push({
        id: 'ratio_warning',
        type: 'ratio',
        title: '污自比 100%~120%（警戒）',
        severity,
        description: msg,
        detail: `目前累積污水 ${wwVol?.toLocaleString()} m³ / 自來水 ${waterVol?.toLocaleString()} m³ = ${ratioPct}% (100%~120%)`,
      });
      reasons.push(`污自比100%~120% (${ratioPct}%)`);
      tags.push(`污自比100%~120% (警戒)`);
    } else if (ratio < 0.35 && (waterVol || 0) >= 30) {
      // 污自比偏低調整為「警戒異常」
      const severity: AbnormalSeverity = 'warning';
      const msg = `本月目前污自比僅 ${ratioPct}%（低於正常基準 35%），可能存在廠內漏水、冷卻蒸發損耗大或污水未全數納管排放，列為警戒異常。`;
      checks.push({
        id: 'ratio_low',
        type: 'ratio',
        title: '污自比偏低（警戒異常）',
        severity,
        description: msg,
        detail: `目前累積污水 ${wwVol?.toLocaleString()} m³ / 自來水 ${waterVol?.toLocaleString()} m³ = ${ratioPct}% (< 35%)`,
      });
      reasons.push(`污自比偏低 (${ratioPct}%)`);
      tags.push(`污自比偏低 (警戒異常)`);
    }
  } else if (isZeroBoth) {
    // 無用水無排水：列為正常（無用水無排水）
    notes.push(`本期自來水使用量與污水排放量皆為 0 m³（無用水無排水，列為正常）`);
  } else if (wwVol && wwVol > 0 && (!waterVol || waterVol === 0)) {
    // 自來水錶無數據：僅作備註說明，不跳警示
    notes.push(`本期自來水使用量為 0 m³（污水排放 ${wwVol.toLocaleString()} m³，疑似自備水源或自來水錶未抄錄）`);
  } else if ((!wwVol || wwVol === 0) && waterVol && waterVol > 50) {
    // 自來水有用水零污水：僅作備註說明，不跳警示
    notes.push(`本期自來水使用量達 ${waterVol.toLocaleString()} m³，目前無污水排放記錄`);
  }

  // 2. 每日數據分析 (以實際抄表日期進行時間排序)
  if (days.length > 0) {
    // 依抄表日期 (billingDate) 嚴格由早到晚 (升冪 ascending) 排序
    const sortedDays = days
      .map((d) => {
        const parsed = parseBillingDate(d.billingDate);
        return {
          ...d,
          _cleanDate: parsed?.cleanDate || '',
          _timestamp: parsed?.timestamp || 0,
        };
      })
      .filter((d) => d._cleanDate)
      .sort((a, b) => {
        if (a._timestamp !== b._timestamp) {
          return a._timestamp - b._timestamp;
        }
        return a._cleanDate.localeCompare(b._cleanDate);
      });

    let consecutiveZeros = 0;
    let maxConsecutiveZeros = 0;
    let hasRollback = false;
    const rollbackItems: string[] = [];
    let surgeCount = 0;
    let surgeMax = 0;
    let surgeDate = '';
    let hasExceedApproved = false;
    let exceedDetail = '';

    const approvedVol = vendor.approvedWwVolume || vendor.wastewaterVolume || null;

    for (let i = 0; i < sortedDays.length; i++) {
      const d = sortedDays[i];
      const dayWw = d.dayWwVolume !== null && d.dayWwVolume !== undefined ? Number(d.dayWwVolume) : 0;

      // 檢查備註官方警示
      if (d.remark && d.remark.includes('連續7日未排放')) {
        consecutiveZeros = Math.max(consecutiveZeros, 7);
      }

      // 連續未排放計數 (依時間順序)
      if (dayWw === 0) {
        consecutiveZeros++;
        if (consecutiveZeros > maxConsecutiveZeros) maxConsecutiveZeros = consecutiveZeros;
      } else {
        consecutiveZeros = 0;
      }

      // 嚴格依照「抄表日期前後天」檢查讀值倒退 (後天累積讀值不可低於前天累積讀值)
      if (i > 0) {
        const prev = sortedDays[i - 1];
        // 確保當前記錄的抄表日期確實晚於前一記錄
        if (d._cleanDate > prev._cleanDate) {
          // (A) 檢查污水水錶累計讀值 (污水水錶讀值倒退需跳異常警示)
          if (
            d.wwAccumulate !== null &&
            d.wwAccumulate !== undefined &&
            prev.wwAccumulate !== null &&
            prev.wwAccumulate !== undefined
          ) {
            const curWwAcc = Number(d.wwAccumulate);
            const prevWwAcc = Number(prev.wwAccumulate);
            if (!isNaN(curWwAcc) && !isNaN(prevWwAcc) && curWwAcc < prevWwAcc) {
              hasRollback = true;
              rollbackItems.push(
                `${d._cleanDate} 污水累計讀值 (${curWwAcc.toLocaleString()} m³) 低於前日 ${prev._cleanDate} (${prevWwAcc.toLocaleString()} m³)`
              );
            }
          }

          // (B) 檢查自來水水錶累計讀值 (自來水錶有異常數據不跳警示，僅作備註)
          if (
            d.waterAccumulate !== null &&
            d.waterAccumulate !== undefined &&
            prev.waterAccumulate !== null &&
            prev.waterAccumulate !== undefined
          ) {
            const curWaterAcc = Number(d.waterAccumulate);
            const prevWaterAcc = Number(prev.waterAccumulate);
            if (!isNaN(curWaterAcc) && !isNaN(prevWaterAcc) && curWaterAcc < prevWaterAcc) {
              // 僅加入備註，不觸發 hasRollback 與警示
              notes.push(
                `${d._cleanDate} 自來水累計讀值 (${curWaterAcc.toLocaleString()} m³) 低於前日 ${prev._cleanDate} (${prevWaterAcc.toLocaleString()} m³)`
              );
            }
          }
        }
      }

      // 單日突增檢測 (與前12個月日均對比)
      if (twelveAvg && twelveAvg > 5 && dayWw > twelveAvg * 2.5 && dayWw > 20) {
        surgeCount++;
        if (dayWw > surgeMax) {
          surgeMax = dayWw;
          surgeDate = d._cleanDate;
        }
      }

      // 超出核准量/容許排放量
      if (approvedVol && dayWw > approvedVol) {
        hasExceedApproved = true;
        exceedDetail = `${d._cleanDate} 單日排放 ${dayWw} m³ 超過核准/容許量 ${approvedVol} m³/日`;
      }
    }

    // 彙整連續未排放 (調整為「嚴重異常」；若為無用水無排水則列為正常)
    if (maxConsecutiveZeros >= 7 && !isZeroBoth) {
      checks.push({
        id: 'consecutive_zero',
        type: 'consecutive_zero',
        title: '連續 7 日以上未排放污水（嚴重異常）',
        severity: 'danger',
        description: `監測到連續 ${maxConsecutiveZeros} 日污水量為 0 m³/日（符合官方系統連續 7 日零排放重大異常判定），可能為水錶故障、未申報停工或排放管線問題。`,
        detail: `最長連續零排放天數: ${maxConsecutiveZeros} 天`,
      });
      reasons.push(`連續 ${maxConsecutiveZeros} 日零排放 (嚴重異常)`);
      tags.push(`連續${maxConsecutiveZeros}日未排放 (嚴重異常)`);
    }

    // 彙整讀值倒退 (僅針對污水水錶讀值倒退)
    if (hasRollback) {
      const detailSummary = rollbackItems.slice(0, 2).join('；') + (rollbackItems.length > 2 ? ` 等共 ${rollbackItems.length} 處` : '');
      checks.push({
        id: 'meter_rollback',
        type: 'rollback',
        title: '污水水錶累計讀值倒退異常',
        severity: 'danger',
        description: `監測到污水水錶累計讀值低於前一日之實際抄表讀值，疑似更換水錶未校正或抄錶人工筆誤。`,
        detail: detailSummary,
      });
      reasons.push('污水讀值倒退異常');
      tags.push('污水讀值倒退');
    }

    // 彙整單日突增
    if (surgeCount > 0 && twelveAvg) {
      checks.push({
        id: 'daily_surge',
        type: 'surge',
        title: '單日污水排放量突增',
        severity: 'warning',
        description: `監測到 ${surgeCount} 次單日排放突增（最高於 ${surgeDate} 達 ${surgeMax} m³/日，為12個月日均 ${twelveAvg} m³/日的 ${(surgeMax / twelveAvg).toFixed(1)} 倍）。`,
        detail: `最高單日: ${surgeMax} m³/日 (日期: ${surgeDate})`,
        date: surgeDate,
      });
      reasons.push(`單日突增 (${surgeMax} m³)`);
      tags.push(`單日突增`);
    }

    // 彙整超額排放
    if (hasExceedApproved) {
      checks.push({
        id: 'exceed_limit',
        type: 'exceed_approved',
        title: '超出核准/容許排放量',
        severity: 'danger',
        description: `單日污水排放量超出官方核准或日容許排放量，需通報園區查核。`,
        detail: exceedDetail,
      });
      reasons.push('超額排放');
      tags.push('超出核准量');
    }
  }

  // 決定整體嚴重程度 (僅由污水指標決定)
  let severity: AbnormalSeverity = 'normal';
  if (checks.some((c) => c.severity === 'danger')) {
    severity = 'danger';
  } else if (checks.some((c) => c.severity === 'warning')) {
    severity = 'warning';
  }

  return {
    hasAnomaly: checks.length > 0,
    severity,
    tags: tags.length > 0 ? tags : (isZeroBoth ? ['正常 (無用水無排水)'] : ['排放正常']),
    reasons: reasons.length > 0 ? reasons : (isZeroBoth ? ['無用水無排水 (正常)'] : ['各項指標均於正常範圍內']),
    checks,
    notes,
  };
}

/**
 * 批次為所有水錶資料附加異常分析報告與計算污自比
 */
export function enrichVendorDataWithAnalysis(
  vendor: VendorSewageData,
  _rainMap?: Record<string, number>
): VendorSewageData {
  const wwVol = vendor.wwVolume !== null && vendor.wwVolume !== undefined ? Number(vendor.wwVolume) : null;
  const waterVol = vendor.waterVolume !== null && vendor.waterVolume !== undefined ? Number(vendor.waterVolume) : null;
  
  let ratio: number | null = null;
  if (wwVol !== null && waterVol !== null && waterVol > 0) {
    ratio = Number((wwVol / waterVol).toFixed(4));
  }

  const anomaly = analyzeVendorAnomaly({
    ...vendor,
    wwVolume: wwVol,
    waterVolume: waterVol,
  });

  return {
    ...vendor,
    wwVolume: wwVol,
    waterVolume: waterVol,
    ratio,
    anomaly,
  };
}
