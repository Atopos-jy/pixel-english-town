'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

import { Loading } from '@/components/Loading';
import { PlazaDialog } from '@/components/plaza/PlazaDialog';
import { usePlaza } from '@/contexts/PlazaContext';

type ActiveLeaderboard = 'daily' | 'streak';
type OpenPanel = 'activities' | 'leaderboard' | null;
type ToastMessage = {
  id: string;
  content: string;
};

function formatActivityTime(createdAt: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(createdAt));
}

export default function PlazaPage() {
  const { status } = useSession();
  const router = useRouter();
  const { onlineCount, activities, leaderboards, realtimeActivity } = usePlaza();
  const [activeLeaderboard, setActiveLeaderboard] = useState<ActiveLeaderboard>('daily');
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);
  const [toast, setToast] = useState<ToastMessage | null>({
    id: 'local-welcome',
    content: '欢迎来到学习广场',
  });

  useEffect(() => {
    if (!realtimeActivity) return;
    setToast({
      id: realtimeActivity.id,
      content: realtimeActivity.content,
    });
  }, [realtimeActivity]);

  useEffect(() => {
    if (!toast) return;
    const timeoutId = window.setTimeout(() => setToast(null), 4_500);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

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
        {toast && (
          <div
            key={toast.id}
            role="status"
            className="absolute left-1/2 top-4 z-30 max-w-[90%] -translate-x-1/2 border-2 border-slate-900 bg-amber-50 px-4 py-2 text-center font-bold text-slate-900 shadow-[4px_4px_0_#172033]"
          >
            {toast.content}
          </div>
        )}

        <aside className="absolute right-4 top-4 z-10 border-2 border-slate-900 bg-white px-3 py-2 text-sm font-black text-slate-900 shadow-[4px_4px_0_#172033]">
          广场在线：{onlineCount}
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
          onClick={() => setOpenPanel('activities')}
          className="absolute left-[66.7%] top-[21.8%] h-[30.3%] w-[16.8%] cursor-pointer outline-none focus-visible:ring-4 focus-visible:ring-amber-200"
          aria-label="打开广场公告栏"
          title="查看最近广场动态"
        />
        <button
          type="button"
          onClick={() => setOpenPanel('leaderboard')}
          className="absolute left-[81.5%] top-[23.4%] h-[40.4%] w-[17.9%] cursor-pointer outline-none focus-visible:ring-4 focus-visible:ring-amber-200"
          aria-label="打开学习排行榜"
          title="查看学习排行榜"
        />

        {openPanel === 'activities' && (
          <PlazaDialog title="广场公告栏" onClose={() => setOpenPanel(null)}>
            {activities.length ? (
              <ol className="space-y-2">
                {activities.map((activity) => (
                  <li
                    key={activity.id}
                    className="flex items-start justify-between gap-4 border-2 border-slate-900 bg-white p-3 text-sm"
                  >
                    <span className="font-bold">{activity.content}</span>
                    <time dateTime={activity.createdAt} className="shrink-0 text-xs text-slate-500">
                      {formatActivityTime(activity.createdAt)}
                    </time>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="py-8 text-center font-bold text-slate-500">还没有广场动态</p>
            )}
          </PlazaDialog>
        )}

        {openPanel === 'leaderboard' && (
          <PlazaDialog title="学习排行榜" onClose={() => setOpenPanel(null)}>
            <div className="mb-4 flex gap-2 border-b-2 border-slate-900 pb-3">
              <button
                type="button"
                onClick={() => setActiveLeaderboard('daily')}
                className={`border-2 border-slate-900 px-3 py-2 text-sm font-black shadow-[2px_2px_0_#172033] ${
                  activeLeaderboard === 'daily' ? 'bg-amber-300' : 'bg-white'
                }`}
              >
                今日排行榜
              </button>
              <button
                type="button"
                onClick={() => setActiveLeaderboard('streak')}
                className={`border-2 border-slate-900 px-3 py-2 text-sm font-black shadow-[2px_2px_0_#172033] ${
                  activeLeaderboard === 'streak' ? 'bg-amber-300' : 'bg-white'
                }`}
              >
                连续学习榜
              </button>
            </div>

            {activeLeaderboard === 'daily' &&
              (leaderboards.daily.length ? (
                <ol className="space-y-2">
                  {leaderboards.daily.map((entry) => (
                    <li
                      key={entry.userId}
                      className="grid grid-cols-[3rem_1fr_auto] items-center gap-2 border-2 border-slate-900 bg-white p-3"
                    >
                      <span className="font-black">#{entry.rank}</span>
                      <span className="font-bold">{entry.name}</span>
                      <span className="font-black">{entry.completedArticles} 篇</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="py-8 text-center font-bold text-slate-500">今天还没有学习记录</p>
              ))}

            {activeLeaderboard === 'streak' &&
              (leaderboards.streak.length ? (
                <ol className="space-y-2">
                  {leaderboards.streak.map((entry) => (
                    <li
                      key={entry.userId}
                      className="grid grid-cols-[3rem_1fr_auto] items-center gap-2 border-2 border-slate-900 bg-white p-3"
                    >
                      <span className="font-black">#{entry.rank}</span>
                      <span className="font-bold">{entry.name}</span>
                      <span className="text-right font-black">
                        {entry.streakDays} 天 · {entry.completedArticles} 篇
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="py-8 text-center font-bold text-slate-500">还没有连续学习记录</p>
              ))}
          </PlazaDialog>
        )}
      </section>
    </div>
  );
}
