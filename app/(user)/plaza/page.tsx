'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

import { Loading } from '@/components/Loading';
import { usePlaza } from '@/contexts/PlazaContext';

type ActiveLeaderboard = 'daily' | 'streak';

export default function PlazaPage() {
  const { status } = useSession();
  const router = useRouter();
  const { onlineCount, activities, leaderboards } = usePlaza();
  const [activeLeaderboard, setActiveLeaderboard] = useState<ActiveLeaderboard>('daily');
  const [showWelcomeToast, setShowWelcomeToast] = useState(true);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setShowWelcomeToast(false), 4_500);
    return () => window.clearTimeout(timeoutId);
  }, []);

  if (status === 'loading') return <Loading />;
  if (status === 'unauthenticated') {
    router.replace('/');
    return <Loading />;
  }

  return (
    <div className="relative h-[calc(100vh-4rem)] overflow-hidden bg-[#183c2b]">
      <section
        className="absolute inset-0 bg-center"
        style={{
          backgroundImage: "url('/images/plaza/plaza-overview.png')",
          backgroundSize: '100% 100%',
        }}
        aria-label="学习广场"
      >
        {showWelcomeToast && (
          <div
            role="status"
            className="absolute left-1/2 top-4 z-20 -translate-x-1/2 border-2 border-slate-900 bg-amber-50 px-4 py-2 font-bold text-slate-900 shadow-[4px_4px_0_#172033]"
          >
            欢迎来到学习广场
          </div>
        )}

        <aside className="absolute right-4 top-4 z-10 w-80 border-2 border-slate-900 bg-white p-3 text-slate-900 shadow-[4px_4px_0_#172033]">
          <p className="font-black text-slate-900">广场在线：{onlineCount}</p>

          <div className="mt-3 flex gap-2 border-b-2 border-slate-900 pb-2">
            <button
              type="button"
              onClick={() => setActiveLeaderboard('daily')}
              className={`border-2 border-slate-900 px-2 py-1 text-xs font-bold ${
                activeLeaderboard === 'daily' ? 'bg-amber-300' : 'bg-white'
              }`}
            >
              今日学习榜
            </button>
            <button
              type="button"
              onClick={() => setActiveLeaderboard('streak')}
              className={`border-2 border-slate-900 px-2 py-1 text-xs font-bold ${
                activeLeaderboard === 'streak' ? 'bg-amber-300' : 'bg-white'
              }`}
            >
              连续学习榜
            </button>
          </div>

          <ol className="mt-2 min-h-24 space-y-1 text-xs">
            {activeLeaderboard === 'daily' &&
              (leaderboards.daily.length ? (
                leaderboards.daily.slice(0, 5).map((entry) => (
                  <li key={entry.userId} className="flex justify-between gap-3">
                    <span>
                      {entry.rank}. {entry.name}
                    </span>
                    <span className="font-bold">{entry.completedArticles} 篇</span>
                  </li>
                ))
              ) : (
                <li className="text-slate-500">今天还没有学习记录</li>
              ))}
            {activeLeaderboard === 'streak' &&
              (leaderboards.streak.length ? (
                leaderboards.streak.slice(0, 5).map((entry) => (
                  <li key={entry.userId} className="flex justify-between gap-3">
                    <span>
                      {entry.rank}. {entry.name}
                    </span>
                    <span className="font-bold">
                      {entry.streakDays} 天 / {entry.completedArticles} 篇
                    </span>
                  </li>
                ))
              ) : (
                <li className="text-slate-500">还没有连续学习记录</li>
              ))}
          </ol>

          <p className="mt-3 border-t-2 border-slate-900 pt-2 text-xs font-black">广场动态</p>
          <div className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs text-slate-700">
            {activities.length ? (
              activities.map((activity) => <p key={activity.id}>{activity.content}</p>)
            ) : (
              <p>等待广场动态…</p>
            )}
          </div>
        </aside>
        <button
          type="button"
          onClick={() => router.push('/learn')}
          className="absolute left-[1.2%] top-[15.9%] h-[37.2%] w-[29.3%] cursor-pointer outline-none focus-visible:ring-4 focus-visible:ring-amber-200"
          aria-label="从图书拱门去学习"
          title="去学习"
        />
        <button
          type="button"
          disabled
          className="absolute left-[66.7%] top-[21.8%] h-[30.3%] w-[16.8%] cursor-not-allowed"
          aria-label="公告栏，即将开放"
          title="公告栏：即将开放"
        />
        <button
          type="button"
          onClick={() => setActiveLeaderboard((current) => (current === 'daily' ? 'streak' : 'daily'))}
          className="absolute left-[81.5%] top-[23.4%] h-[40.4%] w-[17.9%] cursor-pointer outline-none focus-visible:ring-4 focus-visible:ring-amber-200"
          aria-label="切换学习排行榜"
          title="切换学习排行榜"
        />
      </section>
    </div>
  );
}
