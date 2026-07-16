'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { MessageCircleMore, X } from 'lucide-react';
import { Loading } from '@/components/Loading';
import { TownMap } from '@/components/TownMap';

export default function TownPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isWelcomeVisible, setIsWelcomeVisible] = useState(false);
  const welcomeStorageKey = `pixel-town-welcome-${session?.user?.email || session?.user?.name || 'guest'}`;

  useEffect(() => {
    if (status !== 'authenticated') return;
    if (window.localStorage.getItem(welcomeStorageKey)) return;

    setIsWelcomeVisible(true);
    const dismissTimer = window.setTimeout(() => {
      window.localStorage.setItem(welcomeStorageKey, 'dismissed');
      setIsWelcomeVisible(false);
    }, 3000);

    return () => window.clearTimeout(dismissTimer);
  }, [status, welcomeStorageKey]);

  const closeWelcome = () => {
    window.localStorage.setItem(welcomeStorageKey, 'dismissed');
    setIsWelcomeVisible(false);
  };

  if (status === 'loading') return <Loading />;
  if (status === 'unauthenticated') { router.replace('/'); return <Loading />; }

  return <div className="h-[calc(100vh-4rem)] min-h-[580px] overflow-hidden bg-[#182536]">
    <div className="relative h-full w-full overflow-hidden bg-slate-900">
      <TownMap onOpenPlaza={() => router.push('/plaza')} />

      {isWelcomeVisible && <section className="absolute right-5 top-1/2 z-30 w-[min(22rem,calc(100%-2.5rem))] -translate-y-1/2 border-2 border-amber-100 bg-[#172033]/80 p-4 text-white shadow-[4px_4px_0_#0b101a] backdrop-blur-[1px]">
        <button onClick={closeWelcome} aria-label="关闭欢迎消息" className="absolute right-2 top-2 grid h-6 w-6 place-items-center border border-amber-100 text-amber-100 hover:bg-white hover:text-slate-900"><X size={15} strokeWidth={3} /></button>
        <p className="pr-7 text-xs font-black tracking-[0.15em] text-amber-200">WELCOME HOME</p>
        <h1 className="mt-1 text-xl font-black">{session?.user?.name || 'cyd'}，欢迎回到小镇</h1>
        <p className="mt-2 text-sm leading-6 text-slate-100">📍中央学习广场现已开放，其余建筑持续建设中。</p>
      </section>}

      <button onClick={() => setIsWelcomeVisible(true)} aria-label="打开小镇消息" title="小镇消息" className="absolute right-4 top-4 z-20 grid h-10 w-10 place-items-center border-2 border-slate-900 bg-white text-slate-900 shadow-[3px_3px_0_#0b101a] hover:bg-amber-300"><MessageCircleMore size={19} strokeWidth={2.5} /></button>
    </div>
  </div>;
}
