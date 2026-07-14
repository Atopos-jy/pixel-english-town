'use client';

import { useState } from 'react';
import { LockKeyhole } from 'lucide-react';

type Building = {
  id: string;
  name: string;
  src: string;
  x: number;
  y: number;
  width: number;
  isOpen?: boolean;
};

const buildings: Building[] = [
  { id: 'reading', name: '阅读小屋', src: '/images/map/reading-hut.png', x: 17, y: 24, width: 15 },
  { id: 'grammar', name: '语法塔楼', src: '/images/map/grammar-tower.png', x: 39, y: 21, width: 12 },
  { id: 'spelling', name: '拼写蜂巢', src: '/images/map/spelling-beehive.png', x: 61, y: 22, width: 14 },
  { id: 'arena', name: '单词竞技场', src: '/images/map/word-arena.png', x: 82, y: 22, width: 16 },
  { id: 'cafe', name: '对话咖啡馆', src: '/images/map/dialogue-cafe.png', x: 17, y: 48, width: 17 },
  { id: 'plaza', name: '学习广场', src: '/images/map/learning-plaza.png', x: 51, y: 46, width: 18, isOpen: true },
  { id: 'writing', name: '写作工坊', src: '/images/map/writing-workshop.png', x: 76, y: 49, width: 16 },
  { id: 'pronunciation', name: '发音邮局', src: '/images/map/pronunciation-post.png', x: 23, y: 72, width: 15 },
  { id: 'daily', name: '每日任务屋', src: '/images/map/daily-task-house.png', x: 50, y: 72, width: 15 },
  { id: 'listening', name: '听力小屋', src: '/images/map/listening-hut.png', x: 75, y: 72, width: 14 },
  { id: 'vocabulary', name: '词汇宝库', src: '/images/map/vocabulary-treasure-house.png', x: 16, y: 88, width: 14 },
  { id: 'dock', name: '远航码头', src: '/images/map/dock-ship.png', x: 86, y: 87, width: 17 },
];

export function TownMap({ onOpenPlaza }: { onOpenPlaza: () => void }) {
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#73c6f1]">
      <img src="/images/map/terrain-background-v1.png" alt="像素英语小镇草地与道路地图" className="absolute inset-0 h-full w-full object-cover object-center" />
      {buildings.map((building) => (
        <button
          key={building.id}
          aria-label={building.isOpen ? `进入${building.name}` : `${building.name}，建设中`}
          title={building.isOpen ? `进入${building.name}` : `${building.name}正在建设中`}
          onClick={() => building.isOpen ? onOpenPlaza() : setMessage(`${building.name}正在建设中，敬请期待！`)}
          className={`group absolute z-10 -translate-x-1/2 -translate-y-1/2 outline-none ${building.isOpen ? 'cursor-pointer' : 'cursor-not-allowed opacity-70 grayscale-[0.25]'}`}
          style={{ left: `${building.x}%`, top: `${building.y}%`, width: `${building.width}%` }}
        >
          <img src={building.src} alt="" draggable={false} className={`h-auto w-full drop-shadow-[3px_4px_0_rgba(43,28,12,.42)] transition duration-150 ${building.isOpen ? 'group-hover:-translate-y-1 group-hover:brightness-110' : 'group-hover:brightness-75'}`} />
          <span className={`pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap border-2 border-[#55320f] px-2 py-1 text-[10px] font-black shadow-[2px_2px_0_#1f2937] ${building.isOpen ? 'bg-amber-300 text-slate-900' : 'bg-slate-800 text-slate-100'}`}>
            {!building.isOpen && <LockKeyhole className="mr-1 inline-block h-3 w-3" />}{building.name}
          </span>
        </button>
      ))}
      {message && <button onClick={() => setMessage(null)} className="absolute bottom-4 left-1/2 z-30 -translate-x-1/2 border-2 border-slate-900 bg-amber-300 px-4 py-3 text-sm font-black text-slate-900 shadow-[4px_4px_0_#7c2d12]">{message}</button>}
    </div>
  );
}
