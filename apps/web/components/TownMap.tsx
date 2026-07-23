'use client';

import { BookOpen, LockKeyhole } from 'lucide-react';

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
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#73c6f1]">
      <img
        src="/images/map/terrain-background.png"
        alt="像素英语小镇草地与道路地图"
        draggable={false}
        className="absolute inset-0 h-full w-full object-fill [image-rendering:pixelated]"
      />

      <div aria-hidden className="pointer-events-none absolute right-0 top-[18%] h-[82%] w-[35%] overflow-hidden opacity-50 [clip-path:polygon(76%_0,100%_0,100%_100%,3%_100%,18%_80%,42%_66%,61%_43%,72%_21%)]">
        <span className="river-ripple absolute left-[34%] top-[13%] h-[2px] w-5 bg-[#9de8ff]" />
        <span className="river-ripple river-ripple-delay absolute left-[50%] top-[41%] h-[2px] w-7 bg-[#9de8ff]" />
        <span className="river-ripple river-ripple-slow absolute left-[29%] top-[66%] h-[2px] w-6 bg-[#9de8ff]" />
      </div>

      {buildings.map((building) => {
        const statusLabel = building.isOpen ? building.name : `${building.name} · 建设中`;
        const labelPositionClass = building.id === 'plaza'
          ? 'left-[calc(100%+14px)] top-1/2 -translate-y-1/2'
          : 'left-1/2 top-full mt-1 -translate-x-1/2';

        return (
          <button
            key={building.id}
            aria-label={building.isOpen ? `进入${building.name}` : `${building.name}，建设中`}
            aria-disabled={!building.isOpen}
            title={building.isOpen ? `进入${building.name}` : '敬请期待'}
            onClick={() => {
              if (building.isOpen) onOpenPlaza();
            }}
            className={`group absolute z-10 -translate-x-1/2 -translate-y-1/2 outline-none ${building.isOpen ? 'cursor-pointer' : 'cursor-not-allowed'}`}
            style={{ left: `${building.x}%`, top: building.id === 'plaza' ? `calc(${building.y}% - 10px)` : `${building.y}%`, width: `${building.width}%` }}
          >
            <img
              src={building.src}
              alt=""
              draggable={false}
              className={`h-auto w-full transition-transform duration-200 [image-rendering:pixelated] ${building.isOpen ? 'town-open-building group-hover:scale-[1.04] group-hover:[filter:drop-shadow(0_0_0_2px_#ffffff)]' : ''}`}
            />
            {building.id === 'plaza' && <span aria-hidden className="fountain-spray absolute left-1/2 top-[22%] h-1 w-1 -translate-x-1/2 bg-[#dff8ff]" />}
            {!building.isOpen && <img src={building.src} alt="" aria-hidden draggable={false} className="pointer-events-none absolute inset-0 h-auto w-full opacity-35 brightness-0 [image-rendering:pixelated]" />}
            <span className={`pointer-events-none absolute ${labelPositionClass} whitespace-nowrap border-2 border-[#55320f] px-2 py-1 text-[10px] font-black shadow-[2px_2px_0_#1f2937] ${building.isOpen ? 'bg-white text-slate-900' : 'bg-slate-700/80 text-slate-200'}`}>
              {building.isOpen ? <BookOpen className="mr-1 inline-block h-3 w-3" /> : <LockKeyhole className="mr-1 inline-block h-3 w-3" />}
              {statusLabel}
            </span>
            {building.isOpen && <span aria-hidden className={`absolute h-[3px] w-8 bg-amber-300 shadow-[0_2px_0_#55320f] ${building.id === 'plaza' ? 'left-[calc(100%+27px)] top-[calc(50%+20px)]' : 'left-1/2 top-[calc(100%+25px)] -translate-x-1/2'}`} />}
            {!building.isOpen && <span className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 hidden -translate-x-1/2 whitespace-nowrap border-2 border-slate-900 bg-slate-800 px-2 py-1 text-[10px] font-black text-slate-100 shadow-[2px_2px_0_#0b101a] group-hover:block">敬请期待</span>}
          </button>
        );
      })}

      <span aria-hidden className="pixel-sparkle absolute left-[31%] top-[74%] h-1 w-1 bg-amber-100" />
      <span aria-hidden className="tree-leaf absolute left-[7%] top-[27%] h-[2px] w-[2px] bg-[#d7ed75]" />
      <span aria-hidden className="tree-leaf tree-leaf-delay absolute left-[71%] top-[16%] h-[2px] w-[2px] bg-[#d7ed75]" />
      <span aria-hidden className="tree-leaf tree-leaf-slow absolute left-[79%] top-[63%] h-[2px] w-[2px] bg-[#d7ed75]" />
      <style jsx>{`
        .town-open-building { animation: town-building-pulse 2.4s steps(2, end) infinite; }
        .river-ripple { animation: river-ripple-move 4s steps(4, end) infinite; }
        .river-ripple-delay { animation-delay: -1.3s; }
        .river-ripple-slow { animation-duration: 5s; animation-delay: -2.1s; }
        .pixel-sparkle { animation: chest-sparkle 1.8s steps(2, end) infinite; box-shadow: 4px 0 0 #ffe36e, 0 4px 0 #ffe36e, 4px 4px 0 #fff4b8; }
        .fountain-spray { animation: fountain-spray 1.4s steps(3, end) infinite; box-shadow: -4px 4px 0 #dff8ff, 4px 4px 0 #dff8ff; }
        .tree-leaf { animation: tree-leaf-breeze 3.2s steps(2, end) infinite; }
        .tree-leaf-delay { animation-delay: -1s; }
        .tree-leaf-slow { animation-duration: 4.1s; animation-delay: -2.4s; }
        @keyframes town-building-pulse { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.14); } }
        @keyframes river-ripple-move { 0% { transform: translateX(-7px); opacity: .25; } 50% { opacity: .9; } 100% { transform: translateX(9px); opacity: .25; } }
        @keyframes chest-sparkle { 0%, 100% { opacity: .15; } 50% { opacity: 1; } }
        @keyframes fountain-spray { 0%, 100% { transform: translate(-50%, 4px); opacity: .3; } 50% { transform: translate(-50%, -5px); opacity: 1; } }
        @keyframes tree-leaf-breeze { 0%, 100% { transform: translateX(-1px); opacity: .35; } 50% { transform: translateX(2px); opacity: .8; } }
      `}</style>
    </div>
  );
}
