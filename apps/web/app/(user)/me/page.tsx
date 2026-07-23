'use client';

import { useAuth } from '@/contexts/AuthContext';
import { KeyRound, MapPinned, Sparkles } from 'lucide-react';
import { Loading } from '@/components/Loading';
import { StatsDashboard } from '@/components/StatsDashboard';
import { useProgress } from '@/contexts/ProgressContext';
import { useRouter } from 'next/navigation';

export default function MePage() {
  const { user, status } = useAuth();
  const { progress, loading } = useProgress();
  const router = useRouter();

  if (status === 'loading' || loading) return <Loading />;
  if (status !== 'authenticated' || !progress) {
    router.replace('/');
    return <Loading />;
  }

  const userName = user?.name || '学习者';

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#dbe8cf] px-4 py-6 md:px-8 md:py-10">
      <div className="mx-auto max-w-5xl">
        <section className="relative overflow-hidden border-2 border-slate-900 bg-[#f7e7a8] p-1 shadow-[6px_6px_0_#7c5b35]">
          <div className="border-2 border-[#b8793e] bg-[#fff7d6] px-5 py-6 md:px-8 md:py-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="flex items-center gap-2 text-xs font-black tracking-[0.18em] text-[#87512c]">
                  <Sparkles size={15} /> MY CABIN
                </p>
                <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">{userName}的小屋</h1>
                <p className="mt-2 max-w-xl text-sm font-bold leading-6 text-[#5e4b3a]">
                  这里记录你的学习足迹，也陈列着每一枚努力收集的徽章。
                </p>
              </div>
              <button
                type="button"
                onClick={() => router.push('/town')}
                className="inline-flex shrink-0 items-center justify-center gap-2 border-2 border-slate-900 bg-[#7bcf7a] px-4 py-2.5 text-sm font-black text-slate-900 shadow-[3px_3px_0_#365b45] transition-transform hover:-translate-y-0.5 active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_#365b45]"
              >
                <MapPinned size={17} /> 返回小镇
              </button>
            </div>
          </div>
        </section>

        <aside className="mt-5 flex items-start gap-2 border-2 border-slate-900 bg-[#d9eaff] px-4 py-3 text-xs font-bold leading-5 text-slate-800 shadow-[3px_3px_0_#64748b]">
          <KeyRound className="mt-0.5 shrink-0 text-[#375a7f]" size={16} />
          AI Key 仅在学习页当前会话保存，不会显示或保存在小屋中。
        </aside>

        <div className="mt-8">
          <StatsDashboard stats={progress.stats} />
        </div>
      </div>
    </div>
  );
}
