'use client';

import { useEffect, useState } from 'react';
import { Check, KeyRound, Settings2, X } from 'lucide-react';

export type AiProvider = 'deepseek' | 'mimo';

export interface AiSettingsDraft {
  provider: AiProvider;
  apiKey: string;
  model: string;
}

interface AiSettingsDrawerProps {
  initialSettings: AiSettingsDraft;
  onClose: () => void;
  onSaveDraft: (settings: AiSettingsDraft) => void;
  onRequestTest: () => void;
}

const providerOptions: Record<AiProvider, Array<{ value: string; label: string }>> = {
  deepseek: [
    { value: 'deepseek-v4-flash', label: 'DeepSeek-V4-Flash（推荐）' },
    { value: 'deepseek-v4-pro', label: 'DeepSeek-V4-Pro' },
  ],
  mimo: [
    { value: 'mimo-v2.5-pro', label: 'MiMo-V2.5-Pro（推荐）' },
    { value: 'mimo-v2.5', label: 'MiMo-V2.5' },
  ],
};

export function AiSettingsDrawer({ initialSettings, onClose, onSaveDraft, onRequestTest }: AiSettingsDrawerProps) {
  const [settings, setSettings] = useState<AiSettingsDraft>(initialSettings);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const setProvider = (provider: AiProvider) => {
    setSettings({ provider, apiKey: settings.apiKey, model: providerOptions[provider][0].value });
  };

  const saveDraft = () => {
    if (!settings.apiKey.trim()) return;
    onSaveDraft({ ...settings, apiKey: settings.apiKey.trim() });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="关闭 AI 设置" className="absolute inset-0 cursor-default bg-slate-950/20" onClick={onClose} />

      <aside aria-label="AI 出题设置" className="relative flex h-full w-full max-w-[440px] flex-col border-l-2 border-slate-800 bg-[#fff9e8] shadow-[-5px_0_0_#7d9b68]">
        <header className="flex items-start justify-between gap-4 border-b-2 border-slate-800 bg-[#e2f3d0] px-5 py-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-black text-emerald-900"><Settings2 size={18} />AI 出题设置</p>
            <p className="mt-1 text-xs text-slate-600">选择用于当前文章测验的模型。</p>
          </div>
          <button type="button" aria-label="关闭 AI 设置" onClick={onClose} className="border-2 border-slate-800 bg-[#fff9e8] p-1 text-slate-800 transition hover:bg-amber-300"><X size={18} /></button>
        </header>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
          <section>
            <p className="mb-2 text-xs font-black text-slate-800">AI 厂商</p>
            <div className="grid grid-cols-2 gap-2">
              {(['deepseek', 'mimo'] as AiProvider[]).map((provider) => (
                <button
                  key={provider}
                  type="button"
                  onClick={() => setProvider(provider)}
                  className={`border-2 px-3 py-3 text-sm font-black transition ${settings.provider === provider ? 'border-emerald-800 bg-[#e2f3d0] text-emerald-950 shadow-[2px_2px_0_#166534]' : 'border-slate-700 bg-[#fffdf4] text-slate-600 hover:bg-[#fff4cc]'}`}
                >
                  {provider === 'deepseek' ? 'DeepSeek' : 'MiMo'}
                </button>
              ))}
            </div>
          </section>

          <label className="block">
            <span className="mb-2 flex items-center gap-1.5 text-xs font-black text-slate-800"><KeyRound size={14} />API Key</span>
            <input
              type="password"
              autoComplete="new-password"
              value={settings.apiKey}
              onChange={(event) => setSettings({ ...settings, apiKey: event.target.value })}
              placeholder={settings.provider === 'deepseek' ? '输入 DeepSeek API Key' : '输入 MiMo API Key'}
              className="w-full border-2 border-slate-700 bg-[#fffdf4] px-3 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-700"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-black text-slate-800">出题模型</span>
            <select
              value={settings.model}
              onChange={(event) => setSettings({ ...settings, model: event.target.value })}
              className="w-full border-2 border-slate-700 bg-[#fffdf4] px-3 py-3 text-sm font-medium text-slate-800 outline-none focus:border-emerald-700"
            >
              {providerOptions[settings.provider].map((model) => <option key={model.value} value={model.value}>{model.label}</option>)}
            </select>
            <p className="mt-2 text-xs leading-5 text-slate-500">第 5 步将从厂商接口刷新模型列表，替换这里的初始选项。</p>
          </label>

          <div className="border-l-4 border-amber-500 bg-[#fff4cc] p-3 text-xs leading-5 text-slate-700">
            当前阶段不会将 Key 写入浏览器或数据库；关闭页面后，这份临时配置会消失。
          </div>
        </div>

        <footer className="grid grid-cols-2 gap-3 border-t-2 border-slate-800 bg-[#fffdf4] p-5">
          <button type="button" onClick={onRequestTest} disabled={!settings.apiKey.trim()} className="border-2 border-emerald-800 bg-[#e2f3d0] px-3 py-3 text-sm font-black text-emerald-950 transition hover:bg-[#cfeab5] disabled:cursor-not-allowed disabled:opacity-50">
            测试连接
          </button>
          <button type="button" onClick={saveDraft} disabled={!settings.apiKey.trim()} className="flex items-center justify-center gap-1.5 border-2 border-slate-800 bg-amber-300 px-3 py-3 text-sm font-black text-slate-900 shadow-[3px_3px_0_#7c2d12] transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50">
            <Check size={16} />暂存设置
          </button>
        </footer>
      </aside>
    </div>
  );
}
