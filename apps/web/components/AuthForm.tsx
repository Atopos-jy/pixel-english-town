'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowRight, Mail, UserRound } from 'lucide-react';

export const AuthForm: React.FC = () => {
  const router = useRouter();
  const { refresh } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isLogin) {
        const response = await fetch('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const data = await response.json();
        if (!response.ok || data.code !== 0) throw new Error(data.message || '邮箱或密码错误');
        if (!(await refresh())) throw new Error('登录状态未建立，请检查 Fastify 服务与 JWT_SECRET 配置。');
        router.replace('/town');
      } else {
        const res = await fetch('/api/v1/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name }),
        });
        const data = await res.json();
        if (!res.ok || data.code !== 0) throw new Error(data.message || '注册失败');
        if (!(await refresh())) throw new Error('注册成功，但登录状态未建立，请检查 Fastify 服务与 JWT_SECRET 配置。');
        router.replace('/town');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '发生错误，请稍后再试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border-2 border-amber-100 bg-[#172033]/95 p-5 text-slate-100 shadow-[7px_7px_0_#070b14] backdrop-blur-sm md:p-7">
      <div className="mb-6 flex items-center gap-3 border-b-2 border-slate-600 pb-4">
        <div className="grid h-11 w-11 place-items-center border-2 border-amber-200 bg-amber-400 text-slate-900 shadow-[3px_3px_0_#7c2d12]">
          <Mail size={22} />
        </div>
        <div>
          <p className="text-xs font-bold tracking-[0.15em] text-amber-200">TOWN GATE</p>
          <h2 className="text-xl font-black">{isLogin ? '回到小镇' : '登记成为居民'}</h2>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        {!isLogin && (
          <label className="block text-sm font-bold">
            小镇昵称
            <input
              required
              minLength={2}
              maxLength={16}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 w-full border-2 border-slate-500 bg-slate-950 px-3 py-2.5 outline-none focus:border-amber-300"
              placeholder="例：PixelFox"
            />
          </label>
        )}
        <label className="block text-sm font-bold">
          邮箱
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 w-full border-2 border-slate-500 bg-slate-950 px-3 py-2.5 outline-none focus:border-amber-300"
            placeholder="hello@example.com"
          />
        </label>
        <label className="block text-sm font-bold">
          密码
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 w-full border-2 border-slate-500 bg-slate-950 px-3 py-2.5 outline-none focus:border-amber-300"
            placeholder="请输入密码"
          />
        </label>
        {error && <p className="border border-red-400 bg-red-950/70 p-2 text-sm text-red-200">{error}</p>}
        <button
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 border-2 border-amber-100 bg-amber-400 py-3 font-black text-slate-900 shadow-[4px_4px_0_#7c2d12] disabled:opacity-60"
        >
          {loading ? '正在处理…' : isLogin ? '进入小镇' : '注册并进入'} <ArrowRight size={18} />
        </button>
      </form>
      <button
        onClick={() => {
          setIsLogin(!isLogin);
          setError('');
        }}
        className="mt-5 flex w-full items-center justify-center gap-2 text-sm font-bold text-amber-200 hover:text-amber-100"
      >
        <UserRound size={15} />
        {isLogin ? '还没有居民身份？去注册' : '已有居民身份？去登录'}
      </button>
    </div>
  );
};
