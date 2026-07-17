'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect } from 'react';
import { LayoutDashboard, FileText, Users, Award, LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';
import '@/app/admin/admin.css';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    // 如果未登录或不是管理员，重定向到首页
    if (status === 'loading') return;

    if (!session || !session.user) {
      router.push('/');
      return;
    }

    if (session.user.role !== 'admin') {
      router.push('/');
      return;
    }
  }, [session, status, router]);

  // 加载中或未授权时不显示内容
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">加载中...</div>
      </div>
    );
  }

  if (!session || !session.user || session.user.role !== 'admin') {
    return null;
  }

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/' });
  };

  return (
    <div className="admin-pixel min-h-screen bg-gray-100">
      {/* 侧边栏 */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white shadow-lg">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-800">管理后台</h1>
          <p className="text-sm text-gray-500 mt-1">{session.user.email}</p>
        </div>

        <nav className="mt-6">
          <Link
            href="/admin"
            className="flex items-center px-6 py-3 text-gray-700 hover:bg-gray-100 hover:text-blue-600 transition-colors"
          >
            <LayoutDashboard className="w-5 h-5 mr-3" />
            仪表板
          </Link>

          <Link
            href="/admin/articles"
            className="flex items-center px-6 py-3 text-gray-700 hover:bg-gray-100 hover:text-blue-600 transition-colors"
          >
            <FileText className="w-5 h-5 mr-3" />
            文章管理
          </Link>

          <Link
            href="/admin/users"
            className="flex items-center px-6 py-3 text-gray-700 hover:bg-gray-100 hover:text-blue-600 transition-colors"
          >
            <Users className="w-5 h-5 mr-3" />
            用户管理
          </Link>

          <Link
            href="/admin/badges"
            className="flex items-center px-6 py-3 text-gray-700 hover:bg-gray-100 hover:text-blue-600 transition-colors"
          >
            <Award className="w-5 h-5 mr-3" />
            徽章管理
          </Link>

          <button
            onClick={handleLogout}
            className="w-full flex items-center px-6 py-3 text-gray-700 hover:bg-gray-100 hover:text-red-600 transition-colors mt-4"
          >
            <LogOut className="w-5 h-5 mr-3" />
            退出登录
          </button>
        </nav>
      </aside>

      {/* 主内容区域 */}
      <main className="ml-64 p-8">{children}</main>
    </div>
  );
}
