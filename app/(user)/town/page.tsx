'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { MapPin, UserRound } from 'lucide-react';
import { Loading } from '@/components/Loading';
import { TownMap } from '@/components/TownMap';

export default function TownPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  if (status === 'loading') return <Loading />;
  if (status === 'unauthenticated') { router.replace('/'); return <Loading />; }

  return <div className="h-[calc(100vh-4rem)] min-h-[580px] overflow-hidden bg-[#182536]">
    <div className="relative h-full w-full overflow-hidden bg-slate-900">
      <TownMap onOpenPlaza={() => router.push('/plaza')} />
      <section className="absolute left-4 top-4 max-w-sm border-2 border-amber-100 bg-[#172033]/95 p-4 text-white shadow-[4px_4px_0_#0b101a] md:left-7 md:top-7">
        <p className="text-xs font-black tracking-[0.15em] text-amber-200">WELCOME HOME</p>
        <h1 className="mt-1 text-xl font-black">{session?.user?.name || '学习者'}，欢迎回到小镇</h1>
        <p className="mt-2 text-sm leading-6 text-slate-200">中央学习广场正在开放。其他建筑仍在建设，未来会逐步点亮。</p>
      </section>
      <button onClick={() => router.push('/me')} className="absolute bottom-5 right-4 flex items-center gap-2 border-2 border-slate-900 bg-white px-3 py-2 text-sm font-black shadow-[3px_3px_0_#0b101a]"><UserRound size={16} />我的小屋</button>
      <div className="absolute right-4 top-4 flex items-center gap-1 border-2 border-slate-900 bg-white px-3 py-2 text-xs font-black"><MapPin size={15} className="text-red-600" />学习广场已开放</div>
    </div>
  </div>;
}
