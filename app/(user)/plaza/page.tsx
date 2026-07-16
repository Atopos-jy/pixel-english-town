'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Loading } from '@/components/Loading';

export default function PlazaPage() {
  const { status } = useSession();
  const router = useRouter();

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
          backgroundImage: "url('/images/plaza/plaza-overview-v3.png')",
          backgroundSize: '100% 100%',
        }}
        aria-label="学习广场"
      >
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
          disabled
          className="absolute left-[81.5%] top-[23.4%] h-[40.4%] w-[17.9%] cursor-not-allowed"
          aria-label="学习榜，即将开放"
          title="学习榜：即将开放"
        />
      </section>
    </div>
  );
}
