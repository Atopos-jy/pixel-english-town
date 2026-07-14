'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ArrowRight, BellRing, BookOpenCheck, Flame, Users } from 'lucide-react';
import { Loading } from '@/components/Loading';
import { useProgress } from '@/contexts/ProgressContext';

export default function PlazaPage() {
  const { status } = useSession();
  const { progress, loading } = useProgress();
  const router = useRouter();
  if (status === 'loading' || loading) return <Loading />;
  if (status === 'unauthenticated') { router.replace('/'); return <Loading />; }
  const stats = progress?.stats;
  return <div className="min-h-[calc(100vh-4rem)] bg-[#dbe8cf] p-5 md:p-8">
    <div className="mx-auto max-w-6xl">
      <div className="overflow-hidden border-2 border-slate-800 bg-[#1e3140] shadow-[6px_6px_0_#7c5b35]">
        <div className="h-56 bg-[url('/images/town-map.png')] bg-cover bg-center p-6 md:p-10"><div className="max-w-xl border-2 border-amber-100 bg-[#172033]/95 p-5 text-white shadow-[4px_4px_0_#0b101a]"><p className="text-xs font-black tracking-[0.18em] text-amber-200">LEARNING PLAZA</p><h1 className="mt-1 text-3xl font-black">学习广场</h1><p className="mt-2 text-sm text-slate-200">欢迎来到广场。完成一篇文章时，你的学习记录会出现在这里。</p></div></div>
        <div className="grid gap-5 bg-[#edf0df] p-5 md:grid-cols-[1.15fr_.85fr] md:p-7">
          <section className="border-2 border-slate-800 bg-white p-6 shadow-[4px_4px_0_#94a3b8]"><BookOpenCheck className="text-emerald-700" size={28} /><h2 className="mt-3 text-2xl font-black">今天去学习</h2><p className="mt-2 text-sm leading-6 text-slate-600">挑选文章，阅读、听读和练习。每完成一篇，都会推进你的连续学习和徽章进度。</p><button onClick={() => router.push('/learn')} className="mt-5 inline-flex items-center gap-2 border-2 border-slate-900 bg-emerald-500 px-4 py-3 font-black text-white shadow-[4px_4px_0_#166534] hover:bg-emerald-400">去学习 <ArrowRight size={18} /></button></section>
          <section className="border-2 border-slate-800 bg-white p-5 shadow-[4px_4px_0_#94a3b8]"><div className="flex items-center justify-between"><h2 className="font-black">广场状态</h2><span className="flex items-center gap-1 text-xs font-bold text-emerald-700"><span className="h-2 w-2 bg-emerald-500" />已连接</span></div><div className="mt-4 grid grid-cols-2 gap-3"><div className="bg-sky-50 p-3"><Users className="text-sky-700" size={19} /><p className="mt-1 text-2xl font-black">1</p><p className="text-xs text-slate-500">在线学习者</p></div><div className="bg-orange-50 p-3"><Flame className="text-orange-600" size={19} /><p className="mt-1 text-2xl font-black">{stats?.currentStreak || 0}</p><p className="text-xs text-slate-500">连续学习天数</p></div></div></section>
        </div>
      </div>
      <div className="mt-6 grid gap-6 md:grid-cols-2"><section className="border-2 border-slate-800 bg-white p-5 shadow-[4px_4px_0_#94a3b8]"><h2 className="flex items-center gap-2 font-black"><Flame size={18} className="text-orange-600" />学习榜（准备接入实时数据）</h2><ol className="mt-4 space-y-3 text-sm"><li className="flex justify-between border-b border-slate-100 pb-2"><span>1. 你</span><b>{stats?.totalArticlesCompleted || 0} 篇已完成</b></li><li className="text-slate-400">更多学习者会在实时服务接入后出现</li></ol></section><section className="border-2 border-slate-800 bg-white p-5 shadow-[4px_4px_0_#94a3b8]"><h2 className="flex items-center gap-2 font-black"><BellRing size={18} className="text-amber-600" />广场通知</h2><div className="mt-4 border-l-4 border-amber-400 bg-amber-50 p-3 text-sm">欢迎来到学习广场。开始今天的英语冒险吧！</div><p className="mt-3 text-xs text-slate-500">完成文章、获得徽章的动态将在实时服务接入后显示。</p></section></div>
    </div>
  </div>;
}
