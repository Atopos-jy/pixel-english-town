'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { usePathname } from 'next/navigation';

import type { PlazaRealtimeEvent, PlazaSnapshot } from '@/types/plaza';

type PlazaSnapshotResponse = {
  success: boolean;
  message: string;
  data: PlazaSnapshot | null;
};

type OnlineUpdatePayload = {
  count: number;
};

const initialState: PlazaSnapshot = {
  onlineCount: 0,
  activities: [],
  leaderboards: {
    daily: [],
    streak: [],
  },
  version: 0,
};

const PlazaContext = createContext<PlazaSnapshot>(initialState);

export function PlazaProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState<PlazaSnapshot>(initialState);

  useEffect(() => {
    if (pathname !== '/plaza') return;

    const loadSnapshot = async () => {
      try {
        const response = await fetch('/api/plaza/snapshot');
        const text = await response.text();

        if (!response.ok || !text) {
          console.error('[plaza] 获取广场快照失败', { status: response.status });
          return;
        }

        const result = JSON.parse(text) as PlazaSnapshotResponse;
        if (result.success && result.data) {
          setState(result.data);
        }
      } catch (error: unknown) {
        console.error('[plaza] 获取广场快照失败', error);
      }
    };

    void loadSnapshot();

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
    const socket = io(socketUrl, { withCredentials: true, path: '/socket.io/' });

    socket.on('connect', () => {
      console.warn('[plaza] Socket.IO 已连接', { socketId: socket.id });
    });
    socket.on('connect_error', (error: Error) => {
      console.error('[plaza] Socket.IO 连接失败', error.message);
    });
    socket.on('disconnect', (reason) => {
      console.warn('[plaza] Socket.IO 已断开', { reason });
    });
    socket.on('plaza:online-update', ({ count }: OnlineUpdatePayload) => {
      setState((current) => ({ ...current, onlineCount: count }));
    });
    socket.on('plaza:feed', (event: PlazaRealtimeEvent) => {
      if (!event.activity) return;
      setState((current) => ({
        ...current,
        version: Math.max(current.version, event.version),
        activities: current.activities.some((activity) => activity.id === event.activity?.id)
          ? current.activities
          : [event.activity, ...current.activities].slice(0, 50),
      }));
    });
    socket.on('plaza:leaderboard-update', () => {
      void loadSnapshot();
    });

    return () => {
      socket.disconnect();
    };
  }, [pathname]);

  return <PlazaContext.Provider value={state}>{children}</PlazaContext.Provider>;
}

export function usePlaza() {
  return useContext(PlazaContext);
}
