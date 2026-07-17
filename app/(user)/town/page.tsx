'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { Loading } from '@/components/Loading';
import { TownMap } from '@/components/TownMap';

export default function TownPage() {
  const { status } = useSession();
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (status === 'authenticated' && !localStorage.getItem('pixel-town-welcome')) setVisible(true);
  }, [status]);
  if (status === 'loading') return <Loading />;
  if (status === 'unauthenticated') {
    router.replace('/');
    return <Loading />;
  }
  const close = () => {
    localStorage.setItem('pixel-town-welcome', 'dismissed');
    setVisible(false);
  };
  return (
    <div className="h-[calc(100vh-4rem)] min-h-[580px] overflow-hidden bg-[#182536]">
      <div className="relative h-full">
        <TownMap onOpenPlaza={() => router.push('/plaza')} />
        {visible && (
          <section className="absolute inset-0 z-30 grid place-items-center bg-[#172033]/55 p-4">
            <div className="relative min-h-[10rem] w-full max-w-md bg-[url('/images/ui/fox-dialogue-bubble.png')] bg-[length:100%_100%] bg-no-repeat px-11 pt-10 text-[#3f2618]">
              <button
                onClick={close}
                aria-label="关闭欢迎提示"
                className="absolute right-6 top-5 z-10 grid h-8 w-8 place-items-center border-2 border-[#6d391d] bg-white text-[#6d391d]"
              >
                <X size={18} strokeWidth={3} />
              </button>
              <h1 className="mt-4 text-xl font-black">欢迎来到小镇</h1>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
