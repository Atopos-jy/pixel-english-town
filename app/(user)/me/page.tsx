'use client';

import { useSession } from 'next-auth/react';
import { KeyRound, MapPinned } from 'lucide-react';
import { Loading } from '@/components/Loading';
import { StatsDashboard } from '@/components/StatsDashboard';
import { useProgress } from '@/contexts/ProgressContext';
import { useRouter } from 'next/navigation';

export default function MePage() {
  const { data: session, status } = useSession();
  const { progress, loading } = useProgress();
  const router = useRouter();
  if (status === 'loading' || loading) return <Loading />;
  if (status !== 'authenticated' || !progress) { router.replace('/'); return <Loading />; }
  return <div className="min-h-[calc(100vh-4rem)] bg-[#dbe8cf] p-4 md:p-8"><div className="mx-auto max-w-4xl"><section className="border-2 border-slate-800 bg-[#172033] p-6 text-white shadow-[5px_5px_0_#7c5b35]"><p className="text-xs font-black tracking-[0.18em] text-amber-200">MY CABIN</p><h1 className="mt-1 text-3xl font-black">{session?.user?.name || '学习者'}的小屋</h1><p className="mt-2 text-sm text-slate-200">查看你的学习足迹与已收集的徽章。</p><div className="mt-5 flex flex-wrap gap-3"><button onClick={() => router.push('/town')} className="inline-flex items-center gap-2 border border-slate-400 px-3 py-2 text-sm font-bold hover:bg-slate-700"><MapPinned size={16} />返回小镇</button><span className="inline-flex items-center gap-2 border border-violet-300 bg-violet-950/50 px-3 py-2 text-sm text-violet-100"><KeyRound size={16} />AI Key 仅在学习页当前会话保存</span></div></section><div className="mt-7"><StatsDashboard stats={progress.stats} /></div></div></div>;
}
