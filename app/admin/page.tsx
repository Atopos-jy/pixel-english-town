'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, FileText, Shield, TrendingUp } from 'lucide-react';
import { Loading } from '@/components/Loading';

interface AdminStats {
  totalUsers: number;
  totalArticles: number;
  totalAdmins: number;
  recentUsers: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/v1/admin/stats');

      if (!response.ok) {
        throw new Error('获取统计数据失败');
      }

      const data = (await response.json()) as { data: AdminStats | null };
      setStats(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Loading />;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">错误: {error}</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 mb-8">管理员仪表板</h1>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">总用户数</p>
              <p className="text-3xl font-bold text-gray-800 mt-2">{stats?.totalUsers || 0}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">总文章数</p>
              <p className="text-3xl font-bold text-gray-800 mt-2">{stats?.totalArticles || 0}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <FileText className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">管理员数量</p>
              <p className="text-3xl font-bold text-gray-800 mt-2">{stats?.totalAdmins || 0}</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-full">
              <Shield className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">最近7天新用户</p>
              <p className="text-3xl font-bold text-gray-800 mt-2">{stats?.recentUsers || 0}</p>
            </div>
            <div className="bg-orange-100 p-3 rounded-full">
              <TrendingUp className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* 快速访问链接 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/admin/articles" className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center">
            <div className="bg-blue-100 p-3 rounded-full mr-4">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800">文章管理</h3>
              <p className="text-gray-500 text-sm mt-1">创建、编辑和删除文章</p>
            </div>
          </div>
        </Link>

        <Link href="/admin/users" className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center">
            <div className="bg-green-100 p-3 rounded-full mr-4">
              <Users className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800">用户管理</h3>
              <p className="text-gray-500 text-sm mt-1">查看和管理用户账户</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
