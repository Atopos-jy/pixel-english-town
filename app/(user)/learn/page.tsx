'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
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

type QuizGenerationJob = {
  id: string;
  articleTitle: string;
};

export default function LearnPage() {
  const { status } = useSession();
  const { progress, loading: progressLoading, refreshProgress } = useProgress();
  const [articles, setArticles] = useState<Article[]>([]);
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [isQuizActive, setIsQuizActive] = useState(false);
  const [isQuizCloseConfirmOpen, setIsQuizCloseConfirmOpen] = useState(false);
  const [pendingArticle, setPendingArticle] = useState<Article | null>(null);
  const [quizGenerationJobs, setQuizGenerationJobs] = useState<Record<string, QuizGenerationJob>>({});
  const [isAiSettingsOpen, setIsAiSettingsOpen] = useState(false);
  const [isShelfOpen, setIsShelfOpen] = useState(false);
  const [isQuestionFolderOpen, setIsQuestionFolderOpen] = useState(false);
  const [practiceSession, setPracticeSession] = useState<{ questions: PublicQuizQuestion[]; title: string } | null>(null);
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
      .then((response) => response.ok ? response.json() : null)
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
    const jobEntries = Object.entries(quizGenerationJobs);
    if (!jobEntries.length) return;
    let stopped = false;
    let timeoutId: number | undefined;

    const checkJobs = async () => {
      const results = await Promise.all(jobEntries.map(async ([articleId, job]) => {
        try {
          const response = await fetch(`/api/quiz/generate/${job.id}`);
          const data = await response.json();
          if (!response.ok || !data.job || !['ready', 'failed'].includes(data.job.status)) return null;
          return { articleId, job, status: data.job.status as 'ready' | 'failed', error: data.job.error as string | null };
        } catch {
          // 网络暂时不可用时保留任务，下一轮继续查询。
          return null;
        }
      }));
      if (stopped) return;

      const finishedJobs = results.filter((result): result is NonNullable<typeof result> => result !== null);
      if (finishedJobs.length) {
        setQuizGenerationJobs((current) => {
          const next = { ...current };
          finishedJobs.forEach(({ articleId, job }) => {
            if (next[articleId]?.id === job.id) delete next[articleId];
          });
          return next;
        });
        if (!isQuizOpen) {
          const notices = finishedJobs.map(({ job, status, error }) => (
            status === 'ready' ? `《${job.articleTitle}》题目已生成完成。` : `《${job.articleTitle}》AI 出题失败：${error || '请稍后重试。'}`
          ));
          setNotice(notices.join(' '));
        }
      }
      if (!stopped) timeoutId = window.setTimeout(checkJobs, 2000);
    };

    void checkJobs();
    return () => {
      stopped = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [isQuizOpen, quizGenerationJobs]);

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

  const closeQuiz = () => {
    setIsQuizOpen(false);
    setIsQuizActive(false);
  };

  const requestCloseQuiz = () => {
    if (isQuizActive) {
      setIsQuizCloseConfirmOpen(true);
      return false;
    }

    closeQuiz();
    return true;
  };

  const chooseArticle = (nextArticle: Article) => {
    if (nextArticle.id === article.id) return true;
    if (isQuizOpen && isQuizActive) {
      setPendingArticle(nextArticle);
      setIsQuizCloseConfirmOpen(true);
      return false;
    }
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
          <aside aria-label="文章书架" className="relative flex h-full w-[min(84vw,340px)] flex-col border-r-2 border-slate-800 bg-[#fff9e8] shadow-[5px_0_0_#7d9b68]">
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
          activeGenerationJobId={quizGenerationJobs[article.id]?.id || null}
          onRequestClose={requestCloseQuiz}
          onActivityChange={setIsQuizActive}
          onGenerationJobChange={(jobId) => setQuizGenerationJobs((current) => {
            const next = { ...current };
            if (jobId) next[article.id] = { id: jobId, articleTitle: article.title.zh };
            else delete next[article.id];
            return next;
          })}
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
              setNotice(response.ok ? 'AI 连接成功，可以开始测验。' : (data.error || 'AI 连接失败。'));
            } catch {
              setNotice('无法连接到 AI 服务，请检查网络后重试。');
            }
          }}
        />
      )}

      {notice && (
        <div role="status" className="fixed right-5 top-20 z-[60] flex max-w-[calc(100vw-2.5rem)] items-start gap-3 border-2 border-slate-900 bg-amber-300 px-4 py-3 text-sm font-black text-slate-900 shadow-[4px_4px_0_#7c2d12]">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="关闭提示" className="-mr-1 -mt-1 border-2 border-slate-800 bg-[#fff9e8] p-0.5 text-slate-800 transition hover:bg-[#fff4cc]">
            <X size={14} />
          </button>
        </div>
      )}

      {isQuizCloseConfirmOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/30 p-4" role="dialog" aria-modal="true" aria-labelledby="quiz-close-confirm-title">
          <div className="w-full max-w-md border-2 border-slate-800 bg-[#fff9e8] p-5 shadow-[5px_5px_0_#7d9b68]">
            <h2 id="quiz-close-confirm-title" className="text-base font-black text-emerald-900">要关闭本次测验吗？</h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">答题进度不会保存。AI 正在生成的题目不会受到影响，生成完成后可重新打开测验。</p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setIsQuizCloseConfirmOpen(false); setPendingArticle(null); }}
                className="border-2 border-slate-700 bg-[#fffdf4] px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-[#fff4cc]"
              >
                继续测验
              </button>
              <button
                type="button"
                onClick={() => {
                  const nextArticle = pendingArticle;
                  setIsQuizCloseConfirmOpen(false);
                  setPendingArticle(null);
                  closeQuiz();
                  if (nextArticle) setArticle(nextArticle);
                }}
                className="border-2 border-emerald-900 bg-emerald-700 px-4 py-2 text-sm font-black text-white shadow-[2px_2px_0_#14532d] transition hover:bg-emerald-800"
              >
                关闭测验
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
