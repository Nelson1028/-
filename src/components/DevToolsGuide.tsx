import React, { useState } from 'react';
import { Terminal, Copy, Check, Code, ExternalLink, HelpCircle, Sparkles, Layers, ShieldCheck } from 'lucide-react';
import { generateDevToolsScript } from '../utils/devtoolsScript';

export const DevToolsGuide: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const [maxPages, setMaxPages] = useState(10);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [activeTab, setActiveTab] = useState<'script' | 'dom' | 'token'>('script');

  const script = generateDevToolsScript({ maxPages, period, delayMs: 150 });

  const handleCopy = () => {
    navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs mb-8">
      {/* Header */}
      <div className="px-6 py-5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-100 text-cyan-700 flex items-center justify-center shadow-xs">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              Edge DevTools 自動擷取腳本與 DOM 解析指引
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                相容 Edge / Chrome
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              專為 <code className="text-cyan-800 font-mono">v-col v-col-auto align-self-center py-2</code> 前12個月平均每日污水水量欄位設計
            </p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-xs text-xs">
          <button
            onClick={() => setActiveTab('script')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === 'script' ? 'bg-cyan-600 text-white font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            一鍵 DevTools 腳本
          </button>
          <button
            onClick={() => setActiveTab('dom')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === 'dom' ? 'bg-cyan-600 text-white font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            DOM 代碼解析原理
          </button>
          <button
            onClick={() => setActiveTab('token')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === 'token' ? 'bg-cyan-600 text-white font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            手動複製 Token 說明
          </button>
        </div>
      </div>

      {/* Tab 1: Script */}
      {activeTab === 'script' && (
        <div className="p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <label className="text-slate-700 font-medium flex items-center gap-1">
                爬取頁數:
                <select
                  value={maxPages}
                  onChange={(e) => setMaxPages(Number(e.target.value))}
                  className="bg-white border border-slate-300 text-slate-800 rounded-lg px-2 py-1 ml-1 text-xs focus:outline-none focus:border-cyan-600"
                >
                  <option value={1}>1 頁</option>
                  <option value={3}>3 頁</option>
                  <option value={5}>5 頁</option>
                  <option value={10}>10 頁</option>
                  <option value={20}>20 頁</option>
                </select>
              </label>

              <label className="text-slate-700 font-medium flex items-center gap-1">
                目標年月:
                <input
                  type="month"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="bg-white border border-slate-300 text-slate-800 rounded-lg px-2 py-0.5 ml-1 text-xs font-mono focus:outline-none focus:border-cyan-600"
                />
              </label>
            </div>

            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 text-white hover:bg-cyan-700 text-xs font-bold transition-all shadow-xs"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
              {copied ? '已複製腳本！' : '一鍵複製 DevTools 腳本'}
            </button>
          </div>

          {/* Script Box */}
          <div className="relative">
            <pre className="p-4 bg-slate-900 text-slate-200 border border-slate-800 rounded-2xl text-xs font-mono overflow-x-auto max-h-72">
              {script}
            </pre>
          </div>

          {/* Usage Steps */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
              <span className="font-bold text-cyan-700 block mb-1">步驟 1. 開啟目標網站</span>
              <span className="text-slate-600">
                登入臺南市園區管理平臺並前往水錶管理頁面。
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
              <span className="font-bold text-cyan-700 block mb-1">步驟 2. 開啟控制台</span>
              <span className="text-slate-600">
                按下鍵盤 <kbd className="bg-white px-1 py-0.5 rounded border border-slate-300 font-mono">F12</kbd> 切換至 Console 控制台。
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
              <span className="font-bold text-cyan-700 block mb-1">步驟 3. 貼上並執行</span>
              <span className="text-slate-600">
                貼上上述代碼並按 Enter，系統將自動下載完整 JSON 與 CSV 數據！
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: DOM */}
      {activeTab === 'dom' && (
        <div className="p-6 space-y-4 text-xs text-slate-700">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-1.5">
              <Code className="w-4 h-4 text-cyan-600" />
              目標 DOM 標籤精準提取邏輯
            </h4>
            <p className="text-slate-600 leading-relaxed mb-3">
              平臺前端採用 Vuetify 3 框架，目標數值位於各水錶詳細頁面卡片內的以下 DOM 路徑：
            </p>
            <pre className="bg-slate-900 text-cyan-300 p-3 rounded-xl font-mono text-[11px] overflow-x-auto">
{`<div class="v-col v-col-auto align-self-center py-2">
  前12個月平均每日污水水量: <span class="font-weight-bold">128.5</span> (m³/日)
</div>`}
            </pre>
          </div>
        </div>
      )}

      {/* Tab 3: Token */}
      {activeTab === 'token' && (
        <div className="p-6 space-y-4 text-xs text-slate-700">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-cyan-600" />
              如何手動複製登入後的 Authorization Token？
            </h4>
            <ol className="list-decimal pl-5 space-y-1.5 text-slate-600">
              <li>在目標平臺登入後，按下鍵盤 <kbd className="bg-white px-1 py-0.5 rounded border border-slate-300 font-mono">F12</kbd>。</li>
              <li>點擊頂部 <strong>「應用程式 (Application)」</strong> 分頁。</li>
              <li>在左側展開 <strong>工作階段存放區 (Session Storage)</strong>，點擊網站域名。</li>
              <li>在右側鍵值表中找到 <strong>token</strong> 或 <strong>access_token</strong> 項目，雙擊複製其值即可。</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
};
