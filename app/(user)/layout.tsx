'use client';

import { useAuth } from '@/contexts/AuthContext';
import { usePathname, useRouter } from 'next/navigation';
import { Landmark, Map, UserRound, LogOut, ShieldCheck } from 'lucide-react';

const navItems = [
  { href: '/town', label: '小镇', icon: Map },
  { href: '/plaza', label: '学习广场', icon: Landmark },
  { href: '/me', label: '我的小屋', icon: UserRound },
];

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isActive = (href: string) => pathname === href || (href === '/plaza' && pathname?.startsWith('/learn'));

  return (
    <div className="min-h-screen bg-[#edf0df] pb-16 text-slate-900 md:pb-0">
      <header className="sticky top-0 z-50 border-b-2 border-slate-800 bg-[#172033] text-white shadow-[0_3px_0_#8b5a2b]">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
          <button onClick={() => router.push('/town')} className="font-black tracking-wide text-amber-200">
            PIXEL ENGLISH TOWN
          </button>
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map(({ href, label, icon: Icon }) => (
              <button
                key={href}
                onClick={() => router.push(href)}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-bold ${isActive(href) ? 'bg-amber-400 text-slate-900 shadow-[3px_3px_0_#7c2d12]' : 'text-slate-200 hover:bg-slate-700'}`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
            {user?.role === 'admin' && (
              <button
                onClick={() => router.push('/admin')}
                className="ml-2 flex items-center gap-1 text-xs font-bold text-purple-200 hover:text-white"
              >
                <ShieldCheck size={15} />
                后台
              </button>
            )}
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm font-bold text-amber-100 sm:block">{user?.name || '学习者'}</span>
            <button
              onClick={() => void logout().then(() => router.push('/'))}
              className="text-slate-300 hover:text-red-300"
              title="退出登录"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>
      <main>{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t-2 border-slate-800 bg-[#172033] md:hidden">
        {navItems.map(({ href, label, icon: Icon }) => (
          <button
            key={href}
            onClick={() => router.push(href)}
            className={`flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-bold ${isActive(href) ? 'bg-amber-400 text-slate-900' : 'text-slate-200'}`}
          >
            <Icon size={19} />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
