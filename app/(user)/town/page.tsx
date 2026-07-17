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
  }, [status, welcomeStorageKey]);

  const closeWelcome = () => {
    window.localStorage.setItem(welcomeStorageKey, 'dismissed');
    setIsWelcomeVisible(false);
  };

  const enterLearning = () => {
    window.localStorage.setItem(welcomeStorageKey, 'dismissed');
    router.push('/learn');
  };

  if (status === 'loading') return <Loading />;
  if (status === 'unauthenticated') {
    router.replace('/');
    return <Loading />;
  }

  return <div className="h-[calc(100vh-4rem)] min-h-[580px] overflow-hidden bg-[#182536]">
    <div className="relative h-full w-full overflow-hidden bg-slate-900">
      <TownMap onOpenPlaza={() => router.push('/plaza')} />

      {isWelcomeVisible && <section role="dialog" aria-modal="true" aria-labelledby="fox-guide-title" className="absolute inset-0 z-30 grid place-items-center bg-[#172033]/55 p-4">
        <div className="relative w-full max-w-xl">
          <img src="/images/town/fox-guide.png" alt="小狐狸向导" draggable={false} className="absolute bottom-0 left-0 z-10 w-28 [image-rendering:pixelated] sm:w-44" />
          <div className="relative min-h-[13rem] bg-[url('/images/ui/fox-dialogue-bubble.png')] bg-[length:100%_100%] bg-no-repeat pb-7 pl-28 pr-8 pt-8 text-[#3f2618] sm:min-h-[14rem] sm:px-11 sm:pl-48 sm:pt-10">
            <button onClick={closeWelcome} aria-label="关闭学习引导" className="absolute right-5 top-5 grid h-7 w-7 place-items-center text-[#6e4427] hover:text-[#bd4b2d]">
              <X size={19} strokeWidth={3} />
            </button>
            <p className="text-xs font-black tracking-[0.14em] text-[#9f6230]">FOX GUIDE</p>
            <h1 id="fox-guide-title" className="mt-2 pr-5 text-lg font-black leading-7 sm:text-xl">你好，{session?.user?.name || '学习者'}！</h1>
            <p className="mt-1 text-sm font-bold leading-6 sm:text-base">准备好进入今天的学习了吗？</p>
            <button onClick={enterLearning} className="mt-4 border-2 border-[#6d391d] bg-[#f5a627] px-5 py-2 text-sm font-black text-[#3f2618] shadow-[3px_3px_0_#6d391d] hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0_#6d391d]">进入学习</button>
          </div>
        </div>
      </section>}

      <button onClick={() => setIsWelcomeVisible(true)} aria-label="打开学习引导" title="学习引导" className="absolute right-4 top-4 z-20 grid h-10 w-10 place-items-center border-2 border-slate-900 bg-white text-slate-900 shadow-[3px_3px_0_#0b101a] hover:bg-amber-300">
        <MessageCircleMore size={19} strokeWidth={2.5} />
      </button>
    </div>
  </div>;
}
