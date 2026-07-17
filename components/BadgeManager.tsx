'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { DEFAULT_BADGES, type BadgeDefinition, type BadgeRuleMetric } from '@/lib/badges';

type BadgeRow = BadgeDefinition & { earnedUserCount: number };
type ApiResult = { success: boolean; message: string; data: BadgeRow[] | null };
const metrics: Array<{ value: BadgeRuleMetric; label: string }> = [
  { value: 'totalArticlesCompleted', label: '完成文章数' },
  { value: 'currentStreak', label: '连续打卡天数' },
  { value: 'beginnerCount', label: '初级文章数' },
  { value: 'intermediateCount', label: '中级文章数' },
  { value: 'advancedCount', label: '高级文章数' },
];

export default function BadgeManager() {
  const [badges, setBadges] = useState<BadgeRow[]>([]);
  const [keyword, setKeyword] = useState('');
  const [filter, setFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [message, setMessage] = useState('');
  useEffect(() => {
    fetch('/api/admin/badges')
      .then(async (r) => {
        const d = (await r.json()) as ApiResult;
        if (r.ok && d.data) {
          setBadges(d.data);
        } else setMessage(d.message);
      })
      .catch(() => setMessage('获取徽章配置失败'));
  }, []);
  const visible = useMemo(
    () =>
      badges.filter(
        (badge) =>
          (filter === 'all' || (filter === 'enabled') === badge.enabled) &&
          `${badge.name}${badge.description}`.includes(keyword),
      ),
    [badges, filter, keyword],
  );
  const change = (id: string, patch: Partial<BadgeDefinition>) =>
    setBadges((items) => {
      const next = items.map((item) => (item.id === id ? { ...item, ...patch, rule: patch.rule || item.rule } : item));
      return next;
    });
  return (
    <div className="badge-manager max-w-none">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-800">徽章管理</h1>
          <p className="mt-1 text-sm text-gray-600">配置学习成就徽章，启用后才会在前台显示并授予用户。</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/badges/new" className="flex items-center gap-2 bg-green-600 px-4 py-2 text-white">
            新建徽章
          </Link>
        </div>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          ['徽章总数', badges.length],
          ['已启用', badges.filter((b) => b.enabled).length],
          ['已禁用', badges.filter((b) => !b.enabled).length],
          ['获得用户总数', badges.reduce((sum, b) => sum + (Number(b.earnedUserCount) || 0), 0)],
        ].map(([label, value]) => (
          <div key={String(label)} className="bg-white p-5 shadow">
            <p className="text-sm text-gray-600">{label}</p>
            <p className="mt-1 text-3xl font-black">{value}</p>
          </div>
        ))}
      </div>
      <div className="bg-white shadow">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-slate-800 p-5">
          <h2 className="text-xl font-black">徽章列表</h2>
          <div className="flex gap-2">
            <label className="flex items-center border-2 border-slate-800 bg-white px-2">
              <Search size={16} />
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="搜索徽章名称"
                className="border-0 bg-transparent px-2 py-2 outline-none"
              />
            </label>
            <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
              <option value="all">全部状态</option>
              <option value="enabled">已启用</option>
              <option value="disabled">已禁用</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[950px] w-full">
            <thead>
              <tr>
                <th>徽章</th>
                <th>名称与描述</th>
                <th>规则</th>
                <th>状态</th>
                <th>获得用户</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((badge) => (
                <tr key={badge.id}>
                  <td>
                    <input
                      value={badge.icon}
                      onChange={(e) => change(badge.id, { icon: e.target.value })}
                      className="w-14 text-center text-2xl"
                    />
                  </td>
                  <td>
                    <input
                      value={badge.name}
                      onChange={(e) => change(badge.id, { name: e.target.value })}
                      className="mb-2 w-full font-bold"
                    />
                    <input
                      value={badge.description}
                      onChange={(e) => change(badge.id, { description: e.target.value })}
                      className="w-full text-sm"
                    />
                  </td>
                  <td>
                    <select
                      value={badge.rule.metric}
                      onChange={(e) =>
                        change(badge.id, { rule: { ...badge.rule, metric: e.target.value as BadgeRuleMetric } })
                      }
                    >
                      {metrics.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                    <span className="mx-2">≥</span>
                    <input
                      type="number"
                      min="1"
                      value={badge.rule.minimum}
                      onChange={(e) => change(badge.id, { rule: { ...badge.rule, minimum: Number(e.target.value) } })}
                      className="w-16"
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => change(badge.id, { enabled: !badge.enabled })}
                      className={
                        badge.enabled ? 'bg-green-600 px-3 py-1 text-white' : 'bg-gray-400 px-3 py-1 text-white'
                      }
                    >
                      {badge.enabled ? '启用' : '禁用'}
                    </button>
                  </td>
                  <td>{Number(badge.earnedUserCount) || 0}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => setBadges((items) => items.filter((item) => item.id !== badge.id))}
                      className="text-red-600"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {message && <p className="m-5 border-2 border-slate-800 bg-[#fff4cc] p-3 font-bold">{message}</p>}
      </div>
    </div>
  );
}
