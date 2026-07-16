'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { BookOpen, Check } from 'lucide-react';
import { ArticleReader } from '@/components/ArticleReader';
import { AiSettingsDrawer, AiSettingsDraft } from '@/components/AiSettingsDrawer';
import { QuizDrawer } from '@/components/QuizDrawer';
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
  const [notice, setNotice] = useState<string | null>(null);
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [isQuizActive, setIsQuizActive] = useState(false);
  const [isAiSettingsOpen, setIsAiSettingsOpen] = useState(false);
  const [aiSettingsDraft, setAiSettingsDraft] = useState<AiSettingsDraft>({
    provider: 'deepseek',
    apiKey: '',
    model: 'deepseek-v4-flash',
  });

  useEffect(() => {
    if (status !== 'authenticated') return;

    getArticles()
      .then((items) => {
        setArticles(items);
        setArticle(items[0] || null);
      })
      .finally(() => setLoading(false));
  }, [status]);

  if (status === 'loading' || loading || progressLoading) return <Loading />;

  if (status !== 'authenticated' || !article || !progress) {
    return <div className="p-8 text-center">请先返回小镇登录。</div>;
  }

  const completeArticle = async () => {
    const result = await markArticleComplete(article);
    await refreshProgress();
    setNotice(
      result.newBadges.length
        ? `获得徽章：${result.newBadges.join('、')}`
        : '文章已完成，学习记录已更新。',
    );
  };

  const requestCloseQuiz = () => {
    if (isQuizActive && !window.confirm('关闭后本次未完成的测验不会保存，确定关闭吗？')) {
      return false;
    }

    setIsQuizOpen(false);
    setIsQuizActive(false);
    return true;
  };

  const chooseArticle = (nextArticle: Article) => {
    if (nextArticle.id === article.id) return;
    if (isQuizOpen && !requestCloseQuiz()) return;
    setArticle(nextArticle);
  };

  const openQuiz = () => {
    if (!aiSettingsDraft.apiKey) {
      setIsAiSettingsOpen(true);
      return;
    }
    setIsQuizOpen(true);
  };

  return (
    <div className="min-h-full bg-[#e8f0d8] p-3 md:p-6">
      <div className="mx-auto grid max-w-[1500px] gap-5 xl:grid-cols-[270px_minmax(0,1fr)]">
        <aside className="border-2 border-slate-800 bg-[#fff9e8] shadow-[4px_4px_0_#7d9b68]">
          <div className="border-b-2 border-slate-800 bg-[#172033] p-4 text-white">
            <p className="flex items-center gap-2 text-sm font-black">
              <BookOpen size={18} />
              文章书架
            </p>
          </div>
          <div className="max-h-[65vh] overflow-y-auto p-2">
            {articles.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => chooseArticle(item)}
                className={`mb-2 w-full border-2 p-3 text-left text-sm ${
                  article.id === item.id
                    ? 'border-emerald-800 bg-[#e2f3d0] shadow-[2px_2px_0_#166534]'
                    : 'border-transparent hover:border-amber-500 hover:bg-[#fff4cc]'
                }`}
              >
                <b className="block">{item.title.zh}</b>
                <span className="mt-1 block text-xs text-slate-500">{item.title.en}</span>
                {progress.completedArticleIds.includes(item.id) && (
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                    <Check size={13} />已完成
                  </span>
                )}
              </button>
            ))}
          </div>
        </aside>

        <section className="min-w-0 border-2 border-slate-800 bg-[#fffdf4] p-4 shadow-[4px_4px_0_#7d9b68] md:p-6">
          <ArticleReader
            article={article}
            isCompleted={progress.completedArticleIds.includes(article.id)}
            onComplete={completeArticle}
            onOpenQuiz={openQuiz}
            onOpenAiSettings={() => setIsAiSettingsOpen(true)}
          />
        </section>
      </div>

      {isQuizOpen && (
        <QuizDrawer
          article={article}
          onRequestClose={requestCloseQuiz}
          onActivityChange={setIsQuizActive}
        />
      )}

      {isAiSettingsOpen && (
        <AiSettingsDrawer
          initialSettings={aiSettingsDraft}
          onClose={() => setIsAiSettingsOpen(false)}
          onSaveDraft={(settings) => {
            setAiSettingsDraft(settings);
            setNotice(`${settings.provider === 'deepseek' ? 'DeepSeek' : 'MiMo'} 配置已暂存到当前页面。`);
          }}
          onRequestTest={() => setNotice('连接测试将在第 5 步接入厂商 API 后启用。')}
        />
      )}

      {notice && (
        <div className="fixed right-5 top-20 z-[60] border-2 border-slate-900 bg-amber-300 px-4 py-3 text-sm font-black text-slate-900 shadow-[4px_4px_0_#7c2d12]">
          {notice}
        </div>
      )}
    </div>
  );
}
