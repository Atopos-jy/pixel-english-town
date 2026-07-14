'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { BookOpen, Check, KeyRound, Sparkles } from 'lucide-react';
import { ArticleReader } from '@/components/ArticleReader';
import { Loading } from '@/components/Loading';
import { getArticles, markArticleComplete } from '@/services/storageService';
import { useProgress } from '@/contexts/ProgressContext';
import { Article } from '@/types';

export default function LearnPage() {
  const { status } = useSession();
  const { progress, loading: progressLoading, refreshProgress } = useProgress();
  const [articles, setArticles] = useState<Article[]>([]);
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [savedKey, setSavedKey] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (status !== 'authenticated') return;
    getArticles().then((items) => { setArticles(items); setArticle(items[0] || null); }).finally(() => setLoading(false));
    setApiKey(sessionStorage.getItem('deepseek_api_key') || '');
  }, [status]);

  if (status === 'loading' || loading || progressLoading) return <Loading />;
  if (status !== 'authenticated' || !article || !progress) return <div className="p-8 text-center">请先返回小镇登录。</div>;

  const saveKey = () => {
    if (!apiKey.trim()) return;
    sessionStorage.setItem('deepseek_api_key', apiKey.trim());
    setSavedKey(true);
    setNotice('DeepSeek Key 已仅在本次会话保存');
  };
  const completeArticle = async () => {
    const result = await markArticleComplete(article);
    await refreshProgress();
    setNotice(result.newBadges.length ? `获得徽章：${result.newBadges.join('、')}` : '文章已完成，学习记录已更新');
  };

  return <div className="bg-[#edf0df] p-3 md:p-6"><div className="mx-auto grid max-w-[1500px] gap-5 xl:grid-cols-[250px_minmax(0,1fr)_300px]">
    <aside className="border-2 border-slate-800 bg-white shadow-[4px_4px_0_#94a3b8]"><div className="border-b-2 border-slate-800 bg-[#172033] p-4 text-white"><p className="flex items-center gap-2 text-sm font-black"><BookOpen size={18} />文章书架</p></div><div className="max-h-[65vh] overflow-y-auto p-2">{articles.map((item) => <button key={item.id} onClick={() => setArticle(item)} className={`mb-2 w-full border-2 p-3 text-left text-sm ${article.id === item.id ? 'border-emerald-700 bg-emerald-50 shadow-[2px_2px_0_#166534]' : 'border-transparent hover:border-slate-300 hover:bg-slate-50'}`}><b className="block">{item.title.zh}</b><span className="mt-1 block text-xs text-slate-500">{item.title.en}</span>{progress.completedArticleIds.includes(item.id) && <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-700"><Check size={13} />已完成</span>}</button>)}</div></aside>
    <section className="min-w-0 border-2 border-slate-800 bg-white p-4 shadow-[4px_4px_0_#94a3b8] md:p-6"><p className="mb-3 text-xs font-black tracking-[0.15em] text-emerald-700">LEARNING ROOM</p><ArticleReader article={article} isCompleted={progress.completedArticleIds.includes(article.id)} onComplete={completeArticle} /></section>
    <aside className="border-2 border-slate-800 bg-white p-5 shadow-[4px_4px_0_#94a3b8]"><div className="flex items-center gap-2"><Sparkles className="text-violet-600" size={21} /><h2 className="font-black">AI 刷题屋</h2></div><p className="mt-2 text-sm leading-6 text-slate-600">使用你自己的 DeepSeek Key，根据当前文章生成练习题。</p><label className="mt-5 block text-xs font-bold text-slate-700">DEEPSEEK API KEY<input type="password" value={apiKey} onChange={(e) => { setApiKey(e.target.value); setSavedKey(false); }} placeholder="sk-..." className="mt-2 w-full border-2 border-slate-400 px-3 py-2 outline-none focus:border-violet-600" /></label><button onClick={saveKey} className="mt-3 w-full border-2 border-slate-800 bg-violet-600 px-3 py-2 text-sm font-black text-white shadow-[3px_3px_0_#312e81]">{savedKey ? '本次会话已保存' : '本次会话保存'}</button><div className="mt-5 border-l-4 border-violet-400 bg-violet-50 p-3 text-xs leading-5 text-violet-900">本阶段先完成页面与会话 Key 入口；下一阶段将把当前旧版 Groq 出题接口替换为 DeepSeek BYOK 代理。</div></aside>
  </div>{notice && <div className="fixed right-5 top-20 z-[60] border-2 border-slate-900 bg-amber-300 px-4 py-3 text-sm font-black text-slate-900 shadow-[4px_4px_0_#7c2d12]">{notice}</div>}</div>;
}
