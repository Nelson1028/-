import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Square,
  Key,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Layers,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Waves,
  Gauge,
  Zap,
  User,
  Lock,
  Eye,
  EyeOff,
  LogIn,
} from 'lucide-react';
import { VendorSewageData, CrawlProgress, ParkOption } from '../types';
import { DETECTED_PARKS_LIST } from '../data/mockData';
import { enrichVendorDataWithAnalysis } from '../utils/anomalyAnalysis';

interface LiveCrawlerProps {
  onDataExtracted: (items: VendorSewageData[]) => void;
  currentToken?: string;
  parksList?: ParkOption[];
  onLoginSuccess?: (token: string, accountInfo: { userName: string; loginType: string }) => void;
}

export const LiveCrawler: React.FC<LiveCrawlerProps> = ({
  onDataExtracted,
  currentToken,
  parksList = DETECTED_PARKS_LIST,
  onLoginSuccess,
}) => {
  const [token, setToken] = useState(currentToken || '');
  const [parkId, setParkId] = useState('');
  const [keyword, setKeyword] = useState('');
  const [startPeriod, setStartPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [endPeriod, setEndPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [maxPages, setMaxPages] = useState(5);

  // Embedded Login state
  const [loginMethod, setLoginMethod] = useState<'account' | 'token'>(currentToken ? 'token' : 'account');
  const [loginType, setLoginType] = useState<'sso' | 'normal'>('sso');
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [captchaId, setCaptchaId] = useState('');
  const [captchaImage, setCaptchaImage] = useState<string | null>(null);
  const [loadingCaptcha, setLoadingCaptcha] = useState(false);
  const [submittingLogin, setSubmittingLogin] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSuccessMsg, setLoginSuccessMsg] = useState<string | null>(null);

  // Fetch Captcha
  const fetchCaptcha = async () => {
    setLoadingCaptcha(true);
    setLoginError(null);
    try {
      const res = await fetch('/api/proxy/captcha');
      const data = await res.json();
      const cid = data.data?.captchaId || data.captchaId || data.id || '';
      let b64 = data.data?.captchaBase64 || data.captchaBase64 || data.captchaImage || '';

      if (b64) {
        if (!b64.startsWith('data:image')) {
          b64 = `data:image/png;base64,${b64}`;
        }
        setCaptchaId(cid);
        setCaptchaImage(b64);
        setCaptcha('');
      } else {
        setLoginError('未能取得驗證碼，請點擊「換一張」重試');
      }
    } catch (err: any) {
      setLoginError(err.message || '取得驗證碼連線失敗');
    } finally {
      setLoadingCaptcha(false);
    }
  };

  useEffect(() => {
    fetchCaptcha();
  }, []);

  useEffect(() => {
    if (currentToken) {
      setToken(currentToken);
      setLoginMethod('token');
      setTokenStatus({
        tested: true,
        valid: true,
        message: '已帶入目前登入之官方認證憑證 (Token)',
      });
    }
  }, [currentToken]);

  const [verifying, setVerifying] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<{
    tested: boolean;
    valid: boolean;
    message: string;
    total?: number;
  }>({ tested: false, valid: false, message: '' });

  const [progress, setProgress] = useState<CrawlProgress>({
    status: 'idle',
    progress: 0,
    message: '等待開始...',
    processed: 0,
    total: 0,
    logs: [],
  });

  const [showLogs, setShowLogs] = useState(true);
  const eventSourceRef = useRef<EventSource | null>(null);
  const logContainerRef = useRef<HTMLDivElement | null>(null);
  const extractedBufferRef = useRef<VendorSewageData[]>([]);

  // Auto scroll logs to bottom
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [progress.logs]);

  const addLog = (level: 'info' | 'success' | 'warning' | 'error', text: string) => {
    setProgress((prev) => ({
      ...prev,
      logs: [
        ...prev.logs,
        {
          id: Math.random().toString(),
          timestamp: new Date().toTimeString().slice(0, 8),
          level,
          text,
        },
      ],
    }));
  };

  // Handle embedded account login
  const handleAccountLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!userName.trim()) {
      setLoginError('請輸入帳號');
      return;
    }
    if (!password) {
      setLoginError('請輸入密碼');
      return;
    }
    if (!captcha.trim()) {
      setLoginError('請輸入圖形驗證碼');
      return;
    }

    setSubmittingLogin(true);
    setLoginError(null);
    setLoginSuccessMsg(null);

    try {
      const res = await fetch('/api/proxy/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userName: userName.trim(),
          password,
          captcha: captcha.trim(),
          captchaId,
          loginType,
        }),
      });

      const data = await res.json();

      if (data.success && data.data?.token) {
        const receivedToken = data.data.token;
        setToken(receivedToken);
        setLoginSuccessMsg('登入成功！憑證已就緒，可立即點擊下方開始全自動擷取');
        setTokenStatus({
          tested: true,
          valid: true,
          message: '已通過帳密與驗證碼認證',
        });

        if (onLoginSuccess) {
          onLoginSuccess(receivedToken, {
            userName: userName.trim(),
            loginType: loginType === 'sso' ? '公務帳號' : '一般帳號',
          });
        }
      } else {
        setLoginError(data.message || '登入失敗，請確認帳號、密碼或驗證碼');
        fetchCaptcha();
      }
    } catch (err: any) {
      setLoginError(err.message || '登入連線失敗，請檢查網路');
      fetchCaptcha();
    } finally {
      setSubmittingLogin(false);
    }
  };

  // Verify Token against backend
  const handleVerifyToken = async () => {
    if (!token.trim()) {
      setTokenStatus({ tested: true, valid: false, message: '請先輸入 Token' });
      return;
    }

    setVerifying(true);
    setTokenStatus({ tested: false, valid: false, message: '正在驗證 Token...' });

    try {
      const res = await fetch('/api/proxy/verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() }),
      });
      const data = await res.json();

      if (data.success) {
        setTokenStatus({
          tested: true,
          valid: true,
          message: `連線成功！平臺線上共約 ${data.total || 0} 筆水錶資料`,
          total: data.total,
        });
      } else {
        setTokenStatus({
          tested: true,
          valid: false,
          message: data.message || 'Token 驗證失敗',
        });
      }
    } catch (err: any) {
      setTokenStatus({
        tested: true,
        valid: false,
        message: err?.message || '伺服器網路異常',
      });
    } finally {
      setVerifying(false);
    }
  };

  // Start Crawl using Server-Sent Events (SSE)
  const handleStartCrawl = () => {
    if (!token.trim()) {
      alert('請先輸入帳號、密碼與圖形驗證碼進行登入，或輸入 Token 憑證！');
      return;
    }

    // Stop any existing crawler
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    extractedBufferRef.current = [];

    setProgress({
      status: 'running',
      progress: 0,
      message: '正在建立伺服器即時串流連線...',
      processed: 0,
      total: 0,
      logs: [],
    });

    const sP = startPeriod <= endPeriod ? startPeriod : endPeriod;
    const eP = startPeriod <= endPeriod ? endPeriod : startPeriod;

    addLog('info', '啟動後端串流爬蟲程序...');
    addLog('info', `目標網址: https://industrialmgr.tainan.gov.tw/paymentBill/sewageMeter`);
    addLog('info', `過濾條件: 擷取區間 ${sP} ~ ${eP}（前12個月日均採用最新月 ${eP} 數據） | 最大頁數 ${maxPages} 頁 | 工業區: ${parkId ? (parksList.find(p => p.id === parkId)?.name || parkId) : '全工業區 (柳科/新吉)'}`);

    const q = new URLSearchParams({
      token: token.trim(),
      parkId,
      keyword,
      startPeriod: sP,
      endPeriod: eP,
      period: eP,
      maxPages: String(maxPages),
    });

    const es = new EventSource(`/api/proxy/batch-crawl-stream?${q.toString()}`);
    eventSourceRef.current = es;

    es.addEventListener('status', (e) => {
      try {
        const payload = JSON.parse(e.data);
        setProgress((prev) => ({
          ...prev,
          progress: payload.progress || prev.progress,
          message: payload.message || prev.message,
          total: payload.totalVendors || payload.totalCount || prev.total,
        }));
        addLog('info', payload.message);
      } catch (err) {
        console.error(err);
      }
    });

    es.addEventListener('item', (e) => {
      try {
        const payload = JSON.parse(e.data);
        const enriched = enrichVendorDataWithAnalysis(payload.item);
        extractedBufferRef.current.push(enriched);

        setProgress((prev) => ({
          ...prev,
          progress: payload.progress || prev.progress,
          processed: payload.processed || prev.processed,
          total: payload.total || prev.total,
          currentVendor: `${payload.item.name} (${payload.item.waterName})`,
          message: `正在擷取: ${payload.item.name} · 日均: ${payload.item.twelveAvg ?? '-'} m³/日`,
        }));

        const ratioText = enriched.ratio ? ` | 污自比: ${(enriched.ratio * 100).toFixed(1)}%` : '';
        const anomalyText = enriched.anomaly?.hasAnomaly ? ` ⚠ [${enriched.anomaly.tags.join(',')}]` : '';

        addLog(
          enriched.anomaly?.hasAnomaly ? 'warning' : 'success',
          `[${payload.processed}/${payload.total}] ✔ ${payload.item.name} (${payload.item.waterName}): 12M日均 ${payload.item.twelveAvg ?? '-'} m³/日 | 污水 ${payload.item.wwVolume ?? '-'} m³ | 自來水 ${payload.item.waterVolume ?? '-'} m³${ratioText}${anomalyText}`
        );

        // Update data state progressively
        onDataExtracted([...extractedBufferRef.current]);
      } catch (err) {
        console.error(err);
      }
    });

    es.addEventListener('complete', (e) => {
      try {
        const payload = JSON.parse(e.data);
        const allEnriched = (payload.data || []).map(enrichVendorDataWithAnalysis);

        setProgress((prev) => ({
          ...prev,
          status: 'completed',
          progress: 100,
          message: payload.message || '爬取完成！',
        }));
        addLog('success', `🎉 ${payload.message}`);

        onDataExtracted(allEnriched);
      } catch (err) {
        console.error(err);
      } finally {
        es.close();
        eventSourceRef.current = null;
      }
    });

    es.addEventListener('error', (e: any) => {
      try {
        const payload = e.data ? JSON.parse(e.data) : null;
        const errMsg = payload?.message || '連線中斷或伺服器逾時';
        setProgress((prev) => ({
          ...prev,
          status: 'error',
          message: `爬取失敗: ${errMsg}`,
        }));
        addLog('error', `❌ 錯誤: ${errMsg}`);
      } catch {
        setProgress((prev) => ({
          ...prev,
          status: 'error',
          message: '爬取中斷，請確認 Token 是否有效或網路連線。',
        }));
        addLog('error', '❌ 爬取中斷或連線失敗。請確認 Token 是否過期。');
      } finally {
        es.close();
        eventSourceRef.current = null;
      }
    });
  };

  const handleStopCrawl = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setProgress((prev) => ({
      ...prev,
      status: 'paused',
      message: '使用者已主動中止爬蟲程序',
    }));
    addLog('warning', '⏹ 爬取已中止');
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden mb-8">
      {/* Panel Header */}
      <div className="p-5 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Waves className="w-5 h-5 text-cyan-400" />
              線上即時批次爬蟲控制台
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
                SSE 即時串流
              </span>
            </h2>
          </div>

          {/* Login Mode Switcher */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setLoginMethod('account')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                loginMethod === 'account'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              帳號/密碼/圖形驗證碼
            </button>
            <button
              type="button"
              onClick={() => setLoginMethod('token')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                loginMethod === 'token'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              直接輸入 Token
            </button>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Method 1: Embedded Account, Password & Graphical Captcha */}
        {loginMethod === 'account' && (
          <form onSubmit={handleAccountLogin} className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-white">平臺官方身分認證</span>
                <span className="text-[11px] text-slate-400">(自動取得授權 Token)</span>
              </div>

              <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-700 text-xs">
                <button
                  type="button"
                  onClick={() => { setLoginType('sso'); fetchCaptcha(); }}
                  className={`px-2.5 py-1 rounded font-medium text-[11px] ${
                    loginType === 'sso' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  公務帳號 (市府)
                </button>
                <button
                  type="button"
                  onClick={() => { setLoginType('normal'); fetchCaptcha(); }}
                  className={`px-2.5 py-1 rounded font-medium text-[11px] ${
                    loginType === 'normal' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  一般帳號 (廠商)
                </button>
              </div>
            </div>

            {/* Login Alerts */}
            {loginError && (
              <div className="p-2.5 bg-rose-950/50 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}
            {loginSuccessMsg && (
              <div className="p-2.5 bg-emerald-950/50 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{loginSuccessMsg}</span>
              </div>
            )}

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Account */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-cyan-400" />
                  帳號 <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder={loginType === 'sso' ? '輸入公務帳號' : '輸入廠商帳號'}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-cyan-400" />
                    密碼 <span className="text-rose-400">*</span>
                  </span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="輸入密碼"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-3 pr-9 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Graphical Captcha Input + Image */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                    圖形驗證碼 <span className="text-rose-400">*</span>
                  </span>
                  <button
                    type="button"
                    onClick={fetchCaptcha}
                    disabled={loadingCaptcha}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingCaptcha ? 'animate-spin' : ''}`} />
                    換一張
                  </button>
                </label>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={captcha}
                    onChange={(e) => setCaptcha(e.target.value)}
                    maxLength={6}
                    placeholder="輸入驗證碼"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono uppercase tracking-widest font-bold"
                  />

                  {/* High Contrast Captcha Image */}
                  <div
                    onClick={fetchCaptcha}
                    title="點擊更換驗證碼圖片"
                    className="h-9 min-w-[125px] w-32 bg-white rounded-xl border-2 border-slate-500 hover:border-cyan-400 flex items-center justify-center cursor-pointer overflow-hidden relative group p-1 transition-all shadow-sm shrink-0"
                  >
                    {loadingCaptcha ? (
                      <div className="flex items-center gap-1 text-slate-700 text-[10px]">
                        <RefreshCw className="w-3 h-3 animate-spin text-cyan-600" />
                        <span>載入中...</span>
                      </div>
                    ) : captchaImage ? (
                      <img
                        src={captchaImage}
                        alt="圖形驗證碼"
                        className="h-full w-full object-contain select-none pointer-events-none"
                        onError={() => fetchCaptcha()}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={fetchCaptcha}
                        className="text-[10px] text-cyan-700 font-bold hover:underline flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        點擊載入
                      </button>
                    )}
                    <div className="absolute inset-0 bg-cyan-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-[10px] text-white font-bold backdrop-blur-[1px]">
                      換一張 🔄
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Login Trigger Button */}
            <div className="flex items-center justify-between pt-1">
              <div className="text-[11px] text-slate-400">
                {token ? (
                  <span className="text-emerald-400 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 已成功登入平臺
                  </span>
                ) : (
                  <span>輸入後點擊右側按鈕進行官方認證</span>
                )}
              </div>

              <button
                type="submit"
                disabled={submittingLogin}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md"
              >
                {submittingLogin ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    驗證中...
                  </>
                ) : (
                  <>
                    <LogIn className="w-3.5 h-3.5" />
                    登入認證
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Method 2: Direct Token Input */}
        {loginMethod === 'token' && (
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                <Key className="w-4 h-4 text-cyan-400" />
                平臺認證憑證 (Bearer Token)
              </label>
              <div className="flex items-center gap-2">
                {tokenStatus.tested && (
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                      tokenStatus.valid
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-medium'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {tokenStatus.valid ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                    {tokenStatus.message}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={token}
                onChange={(e) => {
                  setToken(e.target.value);
                  setTokenStatus({ tested: false, valid: false, message: '' });
                }}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-cyan-300 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
              />
              <button
                onClick={handleVerifyToken}
                disabled={verifying || !token.trim()}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 border border-slate-700 disabled:opacity-40"
              >
                {verifying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />}
                驗證連線
              </button>
            </div>
          </div>
        )}

        {/* Crawl Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Target Industrial Park */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">目標工業區 (平臺偵測名單)</label>
            <select
              value={parkId}
              onChange={(e) => setParkId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
            >
              {parksList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Period Range (起始年月 ~ 結束年月) */}
          <div className="space-y-1 sm:col-span-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <span>📅 擷取抄錶區間 (起始年月 ~ 結束年月)</span>
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="month"
                value={startPeriod}
                onChange={(e) => setStartPeriod(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                title="選擇起始年月"
              />
              <span className="text-slate-400 text-xs font-bold">~</span>
              <input
                type="month"
                value={endPeriod}
                onChange={(e) => setEndPeriod(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                title="選擇結束年月"
              />
            </div>
          </div>

          {/* Max Pages */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">爬取頁數上限 (每頁50筆)</label>
            <select
              value={maxPages}
              onChange={(e) => setMaxPages(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
            >
              <option value={1}>1 頁 (最多 50 筆水錶)</option>
              <option value={3}>3 頁 (最多 150 筆水錶)</option>
              <option value={5}>5 頁 (最多 250 筆水錶)</option>
              <option value={10}>10 頁 (最多 500 筆水錶)</option>
              <option value={20}>20 頁 (全量水錶)</option>
            </select>
          </div>

          {/* Keyword Filter */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">關鍵字篩選 (廠商/水錶)</label>
            <input
              type="text"
              placeholder="例如: 鋼鐵 / 電子 / 水錶"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Action Buttons & Status */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-4 border-t border-slate-800/80">
          <div className="flex items-center gap-3">
            {progress.status === 'running' ? (
              <button
                onClick={handleStopCrawl}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-lg flex items-center gap-2"
              >
                <Square className="w-4 h-4" />
                中止爬取
              </button>
            ) : (
              <button
                onClick={handleStartCrawl}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold transition-all shadow-lg shadow-cyan-900/30 flex items-center gap-2"
              >
                <Play className="w-4 h-4 fill-white" />
                開始全自動即時擷取
              </button>
            )}

            <button
              onClick={() => setShowLogs(!showLogs)}
              className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              {showLogs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {showLogs ? '收起終端日誌' : `展開日誌 (${progress.logs.length})`}
            </button>
          </div>

          <div className="text-xs text-slate-400 font-mono">
            {progress.status === 'running' && (
              <span className="text-cyan-400 flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                進度: {progress.progress}% ({progress.processed}/{progress.total || '?'})
              </span>
            )}
            {progress.status === 'completed' && (
              <span className="text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                已完成擷取 ({progress.processed} 筆水錶)
              </span>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {(progress.status === 'running' || progress.progress > 0) && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-medium truncate max-w-md">
                {progress.message}
              </span>
              <span className="text-cyan-400 font-mono font-bold">{progress.progress}%</span>
            </div>
            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
              <div
                className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${progress.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Console Logs Box */}
        {showLogs && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-mono text-[11px]">即時執行日誌 (DevTools .v-col.v-col-auto.align-self-center.py-2 擷取紀錄)</span>
              <span className="text-[11px] font-mono">共 {progress.logs.length} 條日誌</span>
            </div>
            <div
              ref={logContainerRef}
              className="h-44 bg-slate-950 rounded-xl p-3 font-mono text-xs overflow-y-auto space-y-1 border border-slate-800/80 shadow-inner"
            >
              {progress.logs.length === 0 ? (
                <div className="text-slate-600 text-center py-12">
                  點擊「開始全自動即時擷取」後，此處將即時串流顯示爬蟲進度與各水錶日均/每日排放量/污自比/異常初判解析...
                </div>
              ) : (
                progress.logs.map((log) => (
                  <div
                    key={log.id}
                    className={`leading-relaxed text-[11px] ${
                      log.level === 'error'
                        ? 'text-rose-400'
                        : log.level === 'warning'
                        ? 'text-amber-400'
                        : log.level === 'success'
                        ? 'text-emerald-400'
                        : 'text-slate-300'
                    }`}
                  >
                    <span className="text-slate-500 mr-2">[{log.timestamp}]</span>
                    {log.text}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
