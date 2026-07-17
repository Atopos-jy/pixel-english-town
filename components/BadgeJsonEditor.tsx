'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import { DEFAULT_BADGES, parseBadgeDefinitions } from '@/lib/badges';

type ApiResult = { success: boolean; message: string; data: unknown[] | null };

const initialBadge = {
  ...DEFAULT_BADGES[0],
  id: 'badge-new',
  name: '新徽章',
  description: '填写徽章说明',
  icon: '🏅',
  enabled: true,
};

export default function BadgeJsonEditor() {
  const router = useRouter();
  const [value, setValue] = useState(JSON.stringify(initialBadge, null, 2));
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    let badge: unknown;
    try {
      badge = JSON.parse(value) as unknown;
    } catch {
      setMessage('JSON 格式错误，请检查逗号、引号和括号。');
      return;
    }
    const parsed = parseBadgeDefinitions([badge]);
    if (!parsed) {
      setMessage('徽章字段或规则无效。minimum 必须为不小于 1 的整数。');
      return;
    }
    setSaving(true);
    try {
      const currentResponse = await fetch('/api/admin/badges');
      const current = (await currentResponse.json()) as ApiResult;
      if (!currentResponse.ok || !current.success || !current.data) {
        setMessage(current.message);
        return;
      }
      const allBadges = [...current.data, parsed[0]];
      const response = await fetch('/api/admin/badges', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ badges: allBadges }),
      });
      const result = (await response.json()) as ApiResult;
      if (!response.ok || !result.success) {
        setMessage(result.message);
        return;
      }
      router.push('/admin/badges');
    } catch {
      setMessage('保存徽章配置失败。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl">
      <Link href="/admin/badges" className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-gray-700">
        <ArrowLeft size={17} />
        返回徽章列表
      </Link>
      <h1 className="text-3xl font-black text-gray-800">新建徽章</h1>
      <p className="mt-2 text-sm text-gray-600">通过 JSON 定义单个徽章。保存后将追加到现有徽章配置。</p>
      <section className="mt-6 bg-white p-6 shadow">
        <label className="mb-2 block text-sm font-black">徽章 JSON</label>
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="min-h-[480px] w-full font-mono text-sm"
          spellCheck={false}
        />
        <p className="mt-3 text-xs text-gray-600">
          必填字段：id、name、description、icon、enabled、rule.metric、rule.minimum。
        </p>
        {message && <p className="mt-4 border-2 border-slate-800 bg-[#fff4cc] p-3 text-sm font-bold">{message}</p>}
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="mt-5 flex items-center gap-2 bg-green-600 px-4 py-2 text-white disabled:opacity-50"
        >
          <Save size={17} />
          {saving ? '保存中…' : '保存新徽章'}
        </button>
      </section>
    </div>
  );
}
