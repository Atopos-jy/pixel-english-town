'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserProgress } from '@/types';
import { getProgress } from '@/services/storageService';
import { useAuth } from '@/contexts/AuthContext';

interface ProgressContextType {
  progress: UserProgress | null;
  loading: boolean;
  error: string | null;
  refreshProgress: () => Promise<void>;
}

const ProgressContext = createContext<ProgressContextType | undefined>(undefined);

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isFetchingRef = React.useRef(false); // 防止并发请求
  const hasFetchedRef = React.useRef(false); // 标记是否已经获取过

  // 只在登录状态变为 authenticated 时获取一次
  useEffect(() => {
    // 如果正在请求中，跳过
    if (isFetchingRef.current) {
      return;
    }

    if (status === 'authenticated' && !hasFetchedRef.current) {
      isFetchingRef.current = true;

      getProgress()
        .then((data) => {
          setProgress(data);
          setError(null);
          hasFetchedRef.current = true;
        })
        .catch((err) => {
          console.error('[ProgressContext] 获取进度失败:', err);
          setError(err instanceof Error ? err.message : '获取进度失败');
        })
        .finally(() => {
          setLoading(false);
          isFetchingRef.current = false;
        });
    } else if (status === 'unauthenticated') {
      // 登出时重置
      setProgress(null);
      setLoading(false);
      setError(null);
      hasFetchedRef.current = false;
      isFetchingRef.current = false;
    } else if (status === 'loading') {
      setLoading(true);
    }
  }, [status]); // 只依赖 status

  const refreshProgress = useCallback(async () => {
    if (status !== 'authenticated') return;

    try {
      setLoading(true);
      setError(null);
      const data = await getProgress();
      setProgress(data);
    } catch (err) {
      console.error('[ProgressContext] 刷新进度失败:', err);
      setError(err instanceof Error ? err.message : '刷新进度失败');
    } finally {
      setLoading(false);
    }
  }, [status]);

  return (
    <ProgressContext.Provider value={{ progress, loading, error, refreshProgress }}>
      {children}
    </ProgressContext.Provider>
  );
}

export function useProgress() {
  const context = useContext(ProgressContext);
  if (context === undefined) {
    throw new Error('useProgress 必须在 ProgressProvider 内使用');
  }
  return context;
}
