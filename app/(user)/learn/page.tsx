'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { BookOpen, Check, X } from 'lucide-react';
import { ArticleReader } from '@/components/ArticleReader';
import { ArticleShelf } from '@/components/ArticleShelf';
import { AiSettingsDrawer, AiSettingsDraft } from '@/components/AiSettingsDrawer';
import { QuizDrawer } from '@/components/QuizDrawer';
import { ArticleQuestionFolderDrawer } from '@/components/ArticleQuestionFolderDrawer';
import { Loading } from '@/components/Loading';
import { getArticles, markArticleComplete } from '@/services/storageService';
import { useProgress } from '@/contexts/ProgressContext';
import { Article, PublicQuizQuestion } from '@/types';

export default function LearnPage() {
  const { status } = useAuth();
  const { progress, loading: progressLoading, refreshProgress } = useProgress();
  const [articles, setArticles] = useState<Article[]>([]);
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [isQuizActive, setIsQuizActive] = useState(false);
  const [quizGenerationJob, setQuizGenerationJob] = useState<{ id: string; articleId: string } | null>(null);
  const [isAiSettingsOpen, setIsAiSettingsOpen] = useState(false);
  const [isShelfOpen, setIsShelfOpen] = useState(false);
  const [isQuestionFolderOpen, setIsQuestionFolderOpen] = useState(false);
  const [practiceSession, setPracticeSession] = useState<{ questions: PublicQuizQuestion[]; title: string } | null>(
    null,
  );
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

    fetch('/api/ai/settings')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data?.settings) return;
        setAiSettingsDraft({
          provider: data.settings.provider,
          model: data.settings.model,
          apiKey: '',
          apiKeyLast4: data.settings.apiKeyLast4,
        });
      })
      .catch(() => undefined);
  }, [status]);

  useEffect(() => {
    if (!notice) return;

    const timeoutId = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  useEffect(() => {
    if (!quizGenerationJob) return;
    let stopped = false;
    let timeoutId: number | undefined;

    const checkJob = async () => {
      try {
        const response = await fetch(`/api/quiz/generate/${quizGenerationJob.id}`);
        const data = await response.json();
        if (!response.ok || stopped) return;
        if (data.job.status === 'completed') {
          setQuizGenerationJob(null);
          if (!isQuizOpen) setNotice('AI 题目已生成完成，可以开始测验。');
          return;
        }
        if (data.job.status === 'failed') {
          setQuizGenerationJob(null);
          setNotice(`AI 出题失败：${data.job.error || '请稍后重试。'}`);
          return;
        }
      } catch {
        // 网络暂时不可用时保留任务，下一轮继续查询。
      }
      if (!stopped) timeoutId = window.setTimeout(checkJob, 2000);
    };

    void checkJob();
    return () => {
      stopped = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [isQuizOpen, quizGenerationJob]);

  if (status === 'loading' || loading || progressLoading) return <Loading />;

  if (status !== 'authenticated' || !article || !progress) {
    return <div className="p-8 text-center">请先返回小镇登录。</div>;
  }

  const completeArticle = async () => {
    const result = await markArticleComplete(article);
    await refreshProgress();
    setNotice(result.newBadges.length ? `获得徽章：${result.newBadges.join('、')}` : '文章已完成，学习记录已更新。');
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
    if (nextArticle.id === article.id) return true;
    if (isQuizOpen && !requestCloseQuiz()) return false;
    setArticle(nextArticle);
    return true;
  };

  const openQuiz = () => {
    if (!aiSettingsDraft.apiKeyLast4) {
      setIsAiSettingsOpen(true);
      return;
    }
    setIsQuizOpen(true);
  };

  return (
    <div className="min-h-full bg-[#e8f0d8] p-3 md:p-6">
      <div className="mx-auto grid max-w-[1500px] gap-5 xl:grid-cols-[270px_minmax(0,1fr)]">
        <aside className="hidden border-2 border-slate-800 bg-[#fff9e8] shadow-[4px_4px_0_#7d9b68] xl:block">
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
                    <Check size={13} />
                    已完成
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
            onOpenQuestionFolder={() => setIsQuestionFolderOpen(true)}
            onOpenAiSettings={() => setIsAiSettingsOpen(true)}
            onOpenShelf={() => setIsShelfOpen(true)}
          />
        </section>
      </div>

      {isShelfOpen && (
        <div className="fixed inset-0 z-50 xl:hidden">
          <button
            type="button"
            aria-label="关闭文章书架"
            className="absolute inset-0 cursor-default bg-slate-950/20"
            onClick={() => setIsShelfOpen(false)}
          />
          <aside
            aria-label="文章书架"
            className="relative flex h-full w-[min(84vw,340px)] flex-col border-r-2 border-slate-800 bg-[#fff9e8] shadow-[5px_0_0_#7d9b68]"
          >
            <button
              type="button"
              aria-label="关闭文章书架"
              onClick={() => setIsShelfOpen(false)}
              className="absolute right-3 top-3 z-10 border-2 border-slate-800 bg-[#fff9e8] p-1 text-slate-800 transition hover:bg-amber-300"
            >
              <X size={18} />
            </button>
            <ArticleShelf
              articles={articles}
              activeArticleId={article.id}
              completedArticleIds={progress.completedArticleIds}
              listClassName="min-h-0 flex-1"
              onSelect={(nextArticle) => {
                if (chooseArticle(nextArticle)) setIsShelfOpen(false);
              }}
            />
          </aside>
        </div>
      )}

      {isQuizOpen && (
        <QuizDrawer
          article={article}
          activeGenerationJobId={quizGenerationJob?.articleId === article.id ? quizGenerationJob.id : null}
          onRequestClose={requestCloseQuiz}
          onActivityChange={setIsQuizActive}
          onGenerationJobChange={(jobId) => setQuizGenerationJob(jobId ? { id: jobId, articleId: article.id } : null)}
        />
      )}

      {isQuestionFolderOpen && (
        <ArticleQuestionFolderDrawer
          article={article}
          onClose={() => setIsQuestionFolderOpen(false)}
          onPractice={(questions, title) => {
            setIsQuestionFolderOpen(false);
            setPracticeSession({ questions, title });
          }}
        />
      )}

      {practiceSession && (
        <QuizDrawer
          key={practiceSession.questions.map((question) => question.id).join('-')}
          article={article}
          initialQuestions={practiceSession.questions}
          title={practiceSession.title}
          onRequestClose={() => {
            setPracticeSession(null);
            setIsQuizActive(false);
          }}
          onActivityChange={setIsQuizActive}
        />
      )}

      {isAiSettingsOpen && (
        <AiSettingsDrawer
          initialSettings={aiSettingsDraft}
          onClose={() => setIsAiSettingsOpen(false)}
          onSaveDraft={async (settings) => {
            try {
              const response = await fetch('/api/ai/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ configuration: settings }),
              });
              const data = await response.json();
              if (!response.ok) return { ok: false, error: data.error || 'AI 设置保存失败。' };

              setAiSettingsDraft({
                provider: data.settings.provider,
                model: data.settings.model,
                apiKey: '',
                apiKeyLast4: data.settings.apiKeyLast4,
              });
              setNotice(`${settings.provider === 'deepseek' ? 'DeepSeek' : 'MiMo'} 设置已加密保存。`);
              return { ok: true };
            } catch {
              return { ok: false, error: '无法保存 AI 设置，请检查网络后重试。' };
            }
          }}
          onRequestTest={async (settings) => {
            setNotice('正在测试 AI 连接…');
            try {
              const response = await fetch('/api/ai/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ configuration: settings }),
              });
              const data = await response.json();
              setNotice(response.ok ? 'AI 连接成功，可以开始测验。' : data.error || 'AI 连接失败。');
            } catch {
              setNotice('无法连接到 AI 服务，请检查网络后重试。');
            }
          }}
        />
      )}

      {notice && (
        <div
          role="status"
          className="fixed right-5 top-20 z-[60] flex max-w-[calc(100vw-2.5rem)] items-start gap-3 border-2 border-slate-900 bg-amber-300 px-4 py-3 text-sm font-black text-slate-900 shadow-[4px_4px_0_#7c2d12]"
        >
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="关闭提示"
            className="-mr-1 -mt-1 border-2 border-slate-800 bg-[#fff9e8] p-0.5 text-slate-800 transition hover:bg-[#fff4cc]"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
