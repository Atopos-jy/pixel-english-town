'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Loading } from '@/components/Loading';
import { TownMap } from '@/components/TownMap';

export default function TownPage() {
  const { status } = useAuth();
  const router = useRouter();

  if (status === 'loading') return <Loading />;
  if (status === 'unauthenticated') {
    router.replace('/');
    return <Loading />;
  }

  return (
    <div className="h-[calc(100vh-4rem)] min-h-[580px] overflow-hidden bg-[#182536]">
      <div className="relative h-full">
        <TownMap onOpenPlaza={() => router.push('/plaza')} />
      </div>
    </div>
  );
}
