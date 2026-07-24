import React, { useEffect, useState } from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Book, Calendar, Flame, Lock } from 'lucide-react';
import { UserStats } from '../types';
import { DEFAULT_BADGES, type BadgeDefinition } from '@/lib/badges';

interface StatsDashboardProps {
  stats: UserStats;
}

const getActivityColor = (count: number) => {
  if (count === 0) return 'bg-[#f3edd5]';
  if (count === 1) return 'bg-[#bce2a5]';
  if (count === 2) return 'bg-[#82c77a]';
  if (count === 3) return 'bg-[#57a864]';
  return 'bg-[#28734e]';
};

const PixelPanel = ({ children, className = '' }: React.PropsWithChildren<{ className?: string }>) => (
  <section className={`border-2 border-slate-900 bg-[#fffbea] p-1 shadow-[4px_4px_0_#7c5b35] ${className}`}>
    <div className="h-full border border-[#c79755] p-4 md:p-5">{children}</div>
  </section>
);

const HeatmapCalendar: React.FC<{ activityLog: Record<string, number> }> = ({ activityLog }) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 364 - startDate.getDay());
  const currentDate = new Date(startDate);
  const weeks: Array<Array<{ date: string; count: number }>> = [];

  for (let weekIndex = 0; weekIndex < 53; weekIndex += 1) {
    const week: Array<{ date: string; count: number }> = [];
    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const date = currentDate.toISOString().split('T')[0];
      week.push({ date, count: activityLog[date] || 0 });
      currentDate.setDate(currentDate.getDate() + 1);
    }
    weeks.push(week);
  }

  return (
    <PixelPanel>
      <h3 className="flex items-center gap-2 text-lg font-black text-slate-900">
        <Calendar className="text-[#3b7f57]" size={20} /> 学习热度
      </h3>
      <div className="mt-4 overflow-x-auto pb-1">
        <div className="min-w-max">
          <div className="flex gap-1">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-1">
                {week.map((day) => (
                  <div
                    key={day.date}
                    title={`${day.date}: 完成 ${day.count} 篇`}
                    className={`h-3 w-3 border border-[#d1c4a3] ${getActivityColor(day.count)}`}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] font-bold text-[#685741]">
            <span>少</span>
            {[0, 1, 2, 3, 4].map((count) => (
              <span key={count} className={`h-3 w-3 border border-[#d1c4a3] ${getActivityColor(count)}`} />
            ))}
            <span>多</span>
          </div>
        </div>
      </div>
    </PixelPanel>
  );
};

export const StatsDashboard: React.FC<StatsDashboardProps> = ({ stats }) => {
  const [badges, setBadges] = useState<BadgeDefinition[]>(DEFAULT_BADGES);

  useEffect(() => {
    fetch('/api/v1/badges')
      .then(async (response) => {
        const result = (await response.json()) as { code: number; data: BadgeDefinition[] | null };
        if (response.ok && result.code === 0 && result.data) setBadges(result.data);
      })
      .catch(() => undefined);
  }, []);
  const difficultyData = [
    { name: '初级', count: stats.articlesByDifficulty.Beginner || 0, color: '#78bd78' },
    { name: '中级', count: stats.articlesByDifficulty.Intermediate || 0, color: '#e4ad4b' },
    { name: '高级', count: stats.articlesByDifficulty.Advanced || 0, color: '#d96c5f' },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-7 pb-12">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <section className="border-2 border-slate-900 bg-[#e8824d] p-1 shadow-[4px_4px_0_#7c3d2b]">
          <div className="border border-[#ffd184] px-4 py-5 text-slate-900">
            <div className="flex items-center gap-2 text-sm font-black">
              <Flame size={20} /> 连续打卡
            </div>
            <div className="mt-2 text-4xl font-black">
              {stats.currentStreak}
              <span className="ml-1 text-lg">天</span>
            </div>
            <div className="mt-2 text-xs font-bold text-[#633021]">最佳记录：{stats.longestStreak} 天</div>
          </div>
        </section>
        <section className="border-2 border-slate-900 bg-[#91c981] p-1 shadow-[4px_4px_0_#365b45]">
          <div className="border border-[#e6f6b2] px-4 py-5 text-slate-900">
            <div className="flex items-center gap-2 text-sm font-black">
              <Book size={20} /> 已读文章
            </div>
            <div className="mt-2 text-4xl font-black">
              {stats.totalArticlesCompleted}
              <span className="ml-1 text-lg">篇</span>
            </div>
            <div className="mt-2 text-xs font-bold text-[#365b45]">累计完成篇数</div>
          </div>
        </section>
      </div>

      <HeatmapCalendar activityLog={stats.activityLog || {}} />

      <PixelPanel>
        <h3 className="flex items-center gap-2 text-lg font-black text-slate-900">
          <BarChart2Icon /> 难度分布
        </h3>
        <div className="mt-4 h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={difficultyData}>
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#5e4b3a', fontSize: 12, fontWeight: 700 }}
              />
              <YAxis
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#5e4b3a', fontSize: 12, fontWeight: 700 }}
              />
              <Tooltip
                cursor={{ fill: '#f5e7b8' }}
                contentStyle={{
                  borderRadius: 0,
                  border: '2px solid #172033',
                  boxShadow: '3px 3px 0 #7c5b35',
                  fontWeight: 700,
                }}
              />
              <Bar dataKey="count">
                {difficultyData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </PixelPanel>

      <section>
        <h3 className="mb-4 text-lg font-black text-slate-900">成就徽章</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {badges
            .filter((badge) => badge.enabled)
            .map((badge) => {
              const isUnlocked = stats.badges.includes(badge.id);
              return (
                <div
                  key={badge.id}
                  className={`border-2 border-slate-900 p-1 shadow-[3px_3px_0_#7c5b35] ${isUnlocked ? 'bg-[#fffbea]' : 'bg-[#d5d4c6]'}`}
                >
                  <div
                    className={`flex min-h-36 flex-col items-center justify-center border p-3 text-center ${isUnlocked ? 'border-[#c79755]' : 'border-[#a8a79d] grayscale'}`}
                  >
                    <div className="relative mb-2 text-3xl">
                      {badge.icon}
                      {!isUnlocked && <Lock className="absolute inset-0 m-auto text-slate-700" size={20} />}
                    </div>
                    <div className="text-xs font-black text-slate-900">{badge.name}</div>
                    <div className="mt-1 text-[10px] font-bold leading-4 text-[#685741]">{badge.description}</div>
                  </div>
                </div>
              );
            })}
        </div>
      </section>
    </div>
  );
};

const BarChart2Icon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="text-[#3b7f57]"
  >
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);
