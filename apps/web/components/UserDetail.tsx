'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Mail, Calendar, Shield, TrendingUp, Award } from 'lucide-react';

interface UserProgress {
  id: string;
  totalDaysLearned: number;
  totalArticlesCompleted: number;
  currentStreak: number;
  longestStreak: number;
  beginnerCount: number;
  intermediateCount: number;
  advancedCount: number;
  completedArticleIds: string[];
}

interface UserDetailData {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
  progress: UserProgress | null;
}

interface UserDetailProps {
  userId: string;
}

export default function UserDetail({ userId }: UserDetailProps) {
  const [user, setUser] = useState<UserDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchUser();
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps -- 保持既有详情加载时机，避免改动历史组件行为。

  const fetchUser = async () => {
    try {
      const response = await fetch(`/api/v1/admin/users/${userId}`);

      if (!response.ok) {
        throw new Error('获取用户详情失败');
      }

      const data = (await response.json()) as { data: UserDetailData | null };
      setUser(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('确定要删除这个用户吗？用户的所有数据将被永久删除。')) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/admin/users/${userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || '删除用户失败');
      }

      router.push('/admin/users');
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleRoleChange = async (newRole: string) => {
    try {
      const response = await fetch(`/api/v1/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || '更新角色失败');
      }

      // 刷新用户数据
      await fetchUser();
    } catch (err) {
      alert(err instanceof Error ? err.message : '更新失败');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">加载中...</div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">错误: {error || '用户不存在'}</p>
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center text-gray-600 hover:text-gray-800 mb-6">
        <ArrowLeft className="w-5 h-5 mr-2" />
        返回
      </button>

      <h1 className="text-3xl font-bold text-gray-800 mb-8">用户详情</h1>

      {/* 基本信息 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">基本信息</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex items-start">
            <Mail className="w-5 h-5 text-gray-400 mr-3 mt-1" />
            <div>
              <p className="text-sm text-gray-500">邮箱</p>
              <p className="text-gray-800 font-medium">{user.email}</p>
            </div>
          </div>

          <div className="flex items-start">
            <Shield className="w-5 h-5 text-gray-400 mr-3 mt-1" />
            <div>
              <p className="text-sm text-gray-500">角色</p>
              <select
                value={user.role}
                onChange={(e) => handleRoleChange(e.target.value)}
                className={`mt-1 px-3 py-1 text-sm font-semibold rounded-full border ${
                  user.role === 'admin'
                    ? 'bg-purple-100 text-purple-800 border-purple-200'
                    : 'bg-gray-100 text-gray-800 border-gray-200'
                }`}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          <div className="flex items-start">
            <Calendar className="w-5 h-5 text-gray-400 mr-3 mt-1" />
            <div>
              <p className="text-sm text-gray-500">注册日期</p>
              <p className="text-gray-800 font-medium">{formatDate(user.createdAt)}</p>
            </div>
          </div>

          <div className="flex items-start">
            <Award className="w-5 h-5 text-gray-400 mr-3 mt-1" />
            <div>
              <p className="text-sm text-gray-500">姓名</p>
              <p className="text-gray-800 font-medium">{user.name || '未设置'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 学习统计 */}
      {user.progress && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">学习统计</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-blue-600 mb-1">完成文章数</p>
              <p className="text-3xl font-bold text-blue-700">{user.progress.totalArticlesCompleted}</p>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm text-green-600 mb-1">当前连续天数</p>
              <p className="text-3xl font-bold text-green-700">{user.progress.currentStreak}</p>
            </div>

            <div className="bg-purple-50 rounded-lg p-4">
              <p className="text-sm text-purple-600 mb-1">最长连续天数</p>
              <p className="text-3xl font-bold text-purple-700">{user.progress.longestStreak}</p>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">按难度统计</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-500">初级</p>
                <p className="text-lg font-semibold text-gray-800">{user.progress.beginnerCount}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">中级</p>
                <p className="text-lg font-semibold text-gray-800">{user.progress.intermediateCount}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">高级</p>
                <p className="text-lg font-semibold text-gray-800">{user.progress.advancedCount}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex justify-end">
        <button
          onClick={handleDelete}
          className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          删除用户
        </button>
      </div>
    </div>
  );
}
