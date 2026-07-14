'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Sparkles } from 'lucide-react';
import { AuthForm } from '@/components/AuthForm';
import { Loading } from '@/components/Loading';

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [showAuth, setShowAuth] = useState(false);

  if (status === 'loading') return <Loading />;

  const isReturningUser = status === 'authenticated';

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f6dfaa] text-white">
      <div
        aria-hidden="true"
        className={`absolute inset-x-0 top-0 bg-[url('/images/come-background-v1.png')] bg-cover bg-center transition-all duration-700 ease-out ${
          showAuth ? 'h-[28vh] bg-[position:center_62%]' : 'h-full'
        }`}
      />

      <section className={showAuth ? 'relative z-10 flex min-h-screen flex-col pt-[28vh]' : 'absolute bottom-[calc(12%+6rem)] left-[5%] right-[5%] z-10'}>
        {!showAuth ? (
          <div className="max-w-3xl animate-fade-in-up">
            {!isReturningUser && <p className="mb-3 inline-flex items-center gap-2 border-2 border-amber-200 bg-slate-900/85 px-3 py-1 text-xs font-bold tracking-[0.18em] text-amber-100 shadow-[4px_4px_0_#0f172a]">
              <Sparkles size={14} /> PIXEL ENGLISH TOWN
            </p>}
            <h1 className="text-[clamp(2rem,5vw,4.5rem)] font-black leading-[1.08] drop-shadow-[4px_4px_0_#0f172a]">
              {isReturningUser ? `欢迎回到小镇，${session?.user?.name || '学习者'}` : '在小镇里，开始今天的英语冒险'}
            </h1>
            <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-[#55320f] sm:mt-4 sm:text-base sm:leading-7">
              阅读、练习、收集徽章。学习广场已经亮起灯火，等你加入。
            </p>
          </div>
        ) : (
          <div className="min-h-[72vh] w-full border-t-4 border-[#55320f] bg-[#f6dfaa] px-5 py-8 text-slate-900 shadow-[0_-6px_0_rgba(85,50,15,.25)] md:px-10 md:py-12">
            <div className="mx-auto w-full max-w-md animate-fade-in-up">
              <button
                onClick={() => setShowAuth(false)}
                className="mb-5 text-sm font-bold text-[#55320f] hover:text-amber-700"
              >
                ← 返回小镇
              </button>
              <AuthForm />
            </div>
          </div>
        )}
      </section>
      {!showAuth && <button
        onClick={() => isReturningUser ? router.push('/town') : setShowAuth(true)}
        className="absolute bottom-[12%] left-1/2 z-20 w-[30%] min-w-[240px] max-w-[505px] -translate-x-1/2 transition duration-150 hover:-translate-y-1 hover:drop-shadow-[0_0_18px_rgba(255,224,111,.95)] focus:outline-none focus:ring-4 focus:ring-amber-200"
        aria-label="点击进入小镇"
      >
        <img src="/images/ui/enter-town-button-v2.png" alt="点击进入小镇" className="h-auto w-full" />
      </button>}
    </main>
  );
}
