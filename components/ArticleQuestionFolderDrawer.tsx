'use client';

import { useEffect, useState } from 'react';
import { Bookmark, Loader2, X } from 'lucide-react';
import { Article, QuizQuestionType } from '@/types';

type Category = 'all' | 'always_correct' | 'wrong';
type TypeFilter = 'all' | QuizQuestionType;
type WrongCountFilter = 'all' | '1' | '2' | '3';

type BookmarkQuestion = {
  id: string;
  type: QuizQuestionType;
  question: string;
  options?: string[];
  knowledgePoints: string[];
  stats: {
    attemptCount: number;
    correctCount: number;
    wrongCount: number;
    lastAnsweredAt: string | null;
  };
};

const categoryLabels: Record<Category, string> = {
  all: '全部',
  always_correct: '一直答对',
  wrong: '错题集',
};

const typeLabels: Record<QuizQuestionType, string> = {
  multiple_choice: '单选',
  true_false: '判断',
  fill_blank: '填空',
};

export function ArticleQuestionFolderDrawer({ article, onClose }: { article: Article; onClose: () => void }) {
  const [category, setCategory] = useState<Category>('all');
  const [type, setType] = useState<TypeFilter>('all');
  const [wrongCount, setWrongCount] = useState<WrongCountFilter>('all');
  const [questions, setQuestions] = useState<BookmarkQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const loadQuestions = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ category, type, wrongCount });
        const response = await fetch(`/api/articles/${article.id}/question-bookmarks?${params}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '加载收藏题目失败。');
        setQuestions(data.questions);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : '加载收藏题目失败。');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    loadQuestions();
    return () => controller.abort();
  }, [article.id, category, type, wrongCount]);

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="关闭本篇收藏夹" className="absolute inset-0 cursor-default bg-slate-950/20" onClick={onClose} />
      <aside aria-label="本篇收藏夹" className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col border-l-2 border-slate-800 bg-[#fff9e8] shadow-[-5px_0_0_#7d9b68]">
        <header className="flex items-start justify-between gap-4 border-b-2 border-slate-800 bg-[#e2f3d0] px-5 py-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-black text-emerald-900"><Bookmark size={18} /> 本篇收藏夹</p>
            <p className="mt-1 line-clamp-1 text-xs text-slate-600">{article.title.zh}</p>
          </div>
          <button type="button" aria-label="关闭本篇收藏夹" onClick={onClose} className="border-2 border-slate-800 bg-[#fff9e8] p-1 text-slate-800 transition hover:bg-amber-300"><X size={18} /></button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="mb-4 flex flex-wrap gap-2" aria-label="收藏分类">
            {(Object.keys(categoryLabels) as Category[]).map((item) => (
              <button key={item} type="button" onClick={() => { setCategory(item); if (item !== 'wrong') setWrongCount('all'); }} className={`border-2 px-3 py-1.5 text-xs font-black transition ${category === item ? 'border-emerald-800 bg-emerald-700 text-white' : 'border-slate-700 bg-[#fffdf4] text-slate-700 hover:bg-[#fff4cc]'}`}>
                {categoryLabels[item]}
              </button>
            ))}
          </div>

          <div className="mb-5 border-2 border-slate-300 bg-[#fffdf4] p-3">
            <p className="mb-2 text-xs font-black text-slate-700">按题型筛选</p>
            <div className="flex flex-wrap gap-2">
              {(['all', 'multiple_choice', 'true_false', 'fill_blank'] as TypeFilter[]).map((item) => (
                <button key={item} type="button" onClick={() => setType(item)} className={`border px-2 py-1 text-xs font-semibold transition ${type === item ? 'border-amber-700 bg-amber-300 text-amber-950' : 'border-slate-400 bg-[#fff9e8] text-slate-700 hover:bg-[#fff4cc]'}`}>
                  {item === 'all' ? '全部题型' : typeLabels[item]}
                </button>
              ))}
            </div>
            {category === 'wrong' && (
              <>
                <p className="mb-2 mt-3 text-xs font-black text-slate-700">按答错次数筛选</p>
                <div className="flex flex-wrap gap-2">
                  {(['all', '1', '2', '3'] as WrongCountFilter[]).map((item) => (
                    <button key={item} type="button" onClick={() => setWrongCount(item)} className={`border px-2 py-1 text-xs font-semibold transition ${wrongCount === item ? 'border-[#b94d3c] bg-[#ffe1d6] text-[#8b2c21]' : 'border-slate-400 bg-[#fff9e8] text-slate-700 hover:bg-[#fff4cc]'}`}>
                      {item === 'all' ? '全部次数' : item === '3' ? '三次及以上' : `${item} 次`}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-14 text-emerald-800"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : error ? (
            <div className="border-2 border-[#b94d3c] bg-[#ffe1d6] p-4 text-sm font-semibold text-[#8b2c21]">{error}</div>
          ) : questions.length === 0 ? (
            <div className="border-2 border-dashed border-slate-400 bg-[#fffdf4] p-8 text-center text-sm text-slate-600">当前筛选下没有收藏题目。</div>
          ) : (
            <div className="space-y-3">
              {questions.map((question) => (
                <article key={question.id} className="border-2 border-slate-800 bg-[#fffdf4] p-4 shadow-[2px_2px_0_#7d9b68]">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="border border-amber-700 bg-[#fff0ad] px-2 py-0.5 text-xs font-black text-amber-950">{typeLabels[question.type]}</span>
                    <span className="text-xs font-semibold text-slate-500">作答 {question.stats.attemptCount} 次 · 正确 {question.stats.correctCount} 次 · 错误 {question.stats.wrongCount} 次</span>
                  </div>
                  <p className="font-semibold leading-relaxed text-slate-800">{question.question}</p>
                  {question.options?.length ? <p className="mt-2 text-xs leading-relaxed text-slate-600">{question.options.join('　')}</p> : null}
                </article>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
