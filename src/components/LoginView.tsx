import React, { useState, useEffect } from 'react';
import {
  Lock,
  User,
  ShieldCheck,
  RefreshCw,
  Eye,
  EyeOff,
  LogIn,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Building,
  Key,
  Sparkles,
} from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (token: string, accountInfo: { userName: string; loginType: string }) => void;
  onLogout: () => void;
  currentUser: { userName: string; loginType: string; token?: string } | null;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLoginSuccess,
  onLogout,
  currentUser,
}) => {
  const [loginType, setLoginType] = useState<'sso' | 'normal'>('sso');
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [captchaId, setCaptchaId] = useState('');
  const [captchaImage, setCaptchaImage] = useState<string | null>(null);
  const [loadingCaptcha, setLoadingCaptcha] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Fetch Captcha from backend proxy
  const fetchCaptcha = async () => {
    setLoadingCaptcha(true);
    setErrorMsg(null);
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
        setErrorMsg('未能取得圖形驗證碼，請點擊重試');
      }
    } catch (err: any) {
      setErrorMsg(err.message || '取得驗證碼連線失敗');
    } finally {
      setLoadingCaptcha(false);
    }
  };

  useEffect(() => {
    if (!currentUser) {
      fetchCaptcha();
    }
  }, [currentUser]);

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim() || !password) {
      setErrorMsg('請輸入帳號與密碼');
      return;
    }
    if (!captcha.trim()) {
      setErrorMsg('請輸入圖形驗證碼');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/proxy/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loginType,
          userName: userName.trim(),
          password,
          captcha: captcha.trim(),
          captchaId,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || '登入失敗，請確認帳號、密碼或驗證碼是否正確');
      }

      const token = data.data?.token || data.token || '';
      if (!token) {
        throw new Error('登入成功但伺服器未回傳 Token');
      }

      setSuccessMsg(`登入成功！已驗證授權身分: ${data.data?.name || userName}`);
      onLoginSuccess(token, {
        userName: data.data?.name || userName,
        loginType,
      });
    } catch (err: any) {
      setErrorMsg(err.message || '登入過程發生錯誤');
      fetchCaptcha();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-cyan-100 text-cyan-700 flex items-center justify-center shadow-xs">
          <Key className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">平臺帳號登入與認證</h2>
          <p className="text-xs text-slate-500">
            登入臺南市園區業務管理平臺以解鎖水錶抄錶資料即時爬取權限
          </p>
        </div>
      </div>

      {currentUser ? (
        <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">目前已成功登入授權</h3>
              <p className="text-xs text-slate-600">
                帳號身分：{currentUser.loginType === 'sso' ? '公務帳號 (SSO)' : '一般廠商帳號'} · {currentUser.userName}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold shadow-xs transition-colors"
            >
              <LogOut className="w-4 h-4" />
              登出目前帳號
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleLogin} className="space-y-4">
          {/* SSO vs Normal Radio */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setLoginType('sso')}
              className={`flex-1 py-2 rounded-lg font-semibold transition-all ${
                loginType === 'sso' ? 'bg-white text-cyan-700 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              公務帳號登入 (SSO)
            </button>
            <button
              type="button"
              onClick={() => setLoginType('normal')}
              className={`flex-1 py-2 rounded-lg font-semibold transition-all ${
                loginType === 'normal' ? 'bg-white text-cyan-700 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              廠商 / 一般帳號登入
            </button>
          </div>

          {/* Username */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              帳號
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="請輸入平臺帳號"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-cyan-600 shadow-xs"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              密碼
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="請輸入密碼"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-9 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-cyan-600 shadow-xs"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Captcha */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              圖形驗證碼
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="請輸入驗證碼"
                value={captcha}
                onChange={(e) => setCaptcha(e.target.value)}
                className="w-32 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-mono uppercase placeholder-slate-400 focus:outline-none focus:border-cyan-600 shadow-xs"
              />
              {captchaImage ? (
                <div
                  onClick={fetchCaptcha}
                  className="h-10 px-3 bg-white border border-slate-300 rounded-xl flex items-center justify-center cursor-pointer hover:border-cyan-500 shadow-xs overflow-hidden"
                  title="點擊換一張驗證碼"
                >
                  <img
                    src={captchaImage}
                    alt="Captcha"
                    className="h-8 w-auto object-contain select-none"
                  />
                </div>
              ) : (
                <div className="h-10 px-3 bg-slate-100 rounded-xl flex items-center text-xs text-slate-500">
                  {loadingCaptcha ? '載入驗證碼中...' : '無驗證碼圖片'}
                </div>
              )}
              <button
                type="button"
                onClick={fetchCaptcha}
                disabled={loadingCaptcha}
                className="p-2.5 text-slate-500 hover:text-cyan-700 transition-colors"
                title="重新取得驗證碼"
              >
                <RefreshCw className={`w-4 h-4 ${loadingCaptcha ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Message feedback */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-cyan-600 text-white hover:bg-cyan-700 text-xs font-bold transition-all shadow-md shadow-cyan-600/20 disabled:opacity-50"
          >
            <LogIn className="w-4 h-4" />
            {submitting ? '登入驗證中...' : '立即登入'}
          </button>
        </form>
      )}
    </div>
  );
};
