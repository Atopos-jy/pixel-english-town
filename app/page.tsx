'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { AuthForm } from '@/components/AuthForm';
import { Loading } from '@/components/Loading';

const TYPEWRITER_INTERVAL_MS = 70;
const CHARACTERS_PER_LINE = 10;

type TypewriterTextProps = {
  text: string;
};

function TypewriterText({ text }: TypewriterTextProps) {
  const [visibleCount, setVisibleCount] = useState(0);
  const characters = Array.from(text);

  useEffect(() => {
    setVisibleCount(0);
    const intervalId = window.setInterval(() => {
      setVisibleCount((currentCount) => {
        if (currentCount >= characters.length) {
          window.clearInterval(intervalId);
          return currentCount;
        }
        return currentCount + 1;
      });
    }, TYPEWRITER_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [characters.length, text]);

  return (
    <span aria-label={text}>
      {characters.slice(0, visibleCount).map((character, index) => (
        <span key={`${character}-${index}`} aria-hidden="true">
          {character === '\n' ? <br /> : character}
          {character !== '\n' && (index + 1) % CHARACTERS_PER_LINE === 0 && <br />}
        </span>
      ))}
      {visibleCount < characters.length && <span aria-hidden="true">▌</span>}
    </span>
  );
}

export default function HomePage() {
  const { user, status } = useAuth();
  const router = useRouter();
  const [showAuth, setShowAuth] = useState(false);

  if (status === 'loading') return <Loading />;

  const isReturningUser = status === 'authenticated';
  const introText = isReturningUser
    ? `欢迎回到小镇，${user?.name || '学习者'}阅读、练习、收集徽章。学习广场已经亮起灯火，等你加入。`
    : 'PIXEL ENGLISH TOWN在小镇里，开始今天的英语冒险阅读、练习、收集徽章。学习广场已经亮起灯火，等你加入。';

  return (
    <main className="home-page relative min-h-[100dvh] overflow-hidden bg-[#f6dfaa] text-white">
      <div
        aria-hidden="true"
        className={`home-page__background absolute inset-x-0 top-0 bg-[url('/images/home/come-background.png')] transition-all duration-700 ease-out ${
          showAuth ? 'h-[28vh] bg-[position:center_62%]' : 'h-full'
        }`}
      />

      <section
        className={showAuth ? 'relative z-10 flex min-h-[100dvh] flex-col pt-[28vh]' : 'home-page__copy absolute z-10'}
      >
        {!showAuth ? (
          <div className="home-page__copy-inner animate-fade-in-up">
            <p className="relative h-[72px] overflow-hidden text-sm font-bold leading-6 text-[#55320f] sm:h-[84px] sm:text-base sm:leading-7">
              <span className="absolute bottom-0 left-0 block w-full">
                <TypewriterText text={introText} />
              </span>
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
      {!showAuth && (
        <button
          onClick={() => (isReturningUser ? router.push('/town') : setShowAuth(true))}
          className="home-page__enter-button absolute left-1/2 z-20 -translate-x-1/2 transition duration-150 hover:-translate-y-1 hover:drop-shadow-[0_0_18px_rgba(255,224,111,.95)] focus:outline-none focus:ring-4 focus:ring-amber-200"
          aria-label="点击进入小镇"
        >
          {/* 像素按钮使用原始 PNG 尺寸与硬边渲染，不交给图片优化器重采样。 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/home/enter-town-button.png" alt="点击进入小镇" className="h-auto w-full" />
        </button>
      )}
    </main>
  );
}
