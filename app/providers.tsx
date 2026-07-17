'use client';

import { SessionProvider } from 'next-auth/react';
import { ProgressProvider } from '@/contexts/ProgressContext';
import { PlazaProvider } from '@/contexts/PlazaContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ProgressProvider>
        <PlazaProvider>{children}</PlazaProvider>
      </ProgressProvider>
    </SessionProvider>
  );
}
