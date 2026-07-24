'use client';

import { AuthProvider } from '@/contexts/AuthContext';
import { ProgressProvider } from '@/contexts/ProgressContext';
import { PlazaProvider } from '@/contexts/PlazaContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ProgressProvider>
        <PlazaProvider>{children}</PlazaProvider>
      </ProgressProvider>
    </AuthProvider>
  );
}
