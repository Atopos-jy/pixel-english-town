'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { usePathname } from 'next/navigation';

import type { PlazaActivity, PlazaRealtimeEvent, PlazaSnapshot } from '@/types/plaza';

type PlazaSnapshotResponse = {
  code: number;
  message: string;
  data: PlazaSnapshot | null;
};

type OnlineUpdatePayload = {
  count: number;
};

type PlazaContextValue = PlazaSnapshot & {
  realtimeActivity: PlazaActivity | null;
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

const initialContextValue: PlazaContextValue = {
  ...initialState,
  realtimeActivity: null,
};

const PlazaContext = createContext<PlazaContextValue>(initialContextValue);

export function PlazaProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState<PlazaSnapshot>(initialState);
  const [realtimeActivity, setRealtimeActivity] = useState<PlazaActivity | null>(null);

  useEffect(() => {
    if (pathname !== '/plaza') return;

    const loadSnapshot = async () => {
      try {
        const response = await fetch('/api/v1/plaza/snapshot');
        const text = await response.text();

        if (!response.ok || !text) {
          console.error('[plaza] 获取广场快照失败', { status: response.status });
          return;
        }

        const result = JSON.parse(text) as PlazaSnapshotResponse;
        if (result.code === 0 && result.data) {
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
      const activity = event.activity;
      if (!activity) return;

      setRealtimeActivity(activity);
      setState((current) => ({
        ...current,
        version: Math.max(current.version, event.version),
        activities: current.activities.some((currentActivity) => currentActivity.id === activity.id)
          ? current.activities
          : [activity, ...current.activities].slice(0, 50),
      }));
    });
    socket.on('plaza:leaderboard-update', () => {
      void loadSnapshot();
    });

    return () => {
      socket.disconnect();
      setRealtimeActivity(null);
    };
  }, [pathname]);

  return <PlazaContext.Provider value={{ ...state, realtimeActivity }}>{children}</PlazaContext.Provider>;
}

export function usePlaza() {
  return useContext(PlazaContext);
}
