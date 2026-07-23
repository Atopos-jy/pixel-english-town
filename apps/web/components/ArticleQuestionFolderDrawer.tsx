'use client';

import { useEffect, useState } from 'react';
import { BarChart3, Bookmark, Loader2, X } from 'lucide-react';
import { Article, PublicQuizQuestion, QuizQuestionType } from '@/types';

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

const knowledgePointLabels: Record<string, string> = {
  vocabulary_context: '词义语境',
  detail_location: '细节定位',
  main_idea: '主旨概括',
  inference: '推断理解',
  tense: '时态',
  grammar_structure: '语法结构',
};

type Performance = {
  key: string;
  bookmarkedCount: number;
  attemptedQuestionCount: number;
  attemptCount: number;
  correctCount: number;
  wrongCount: number;
  accuracy: number | null;
};

type LearningAnalysis = {
  overview: Omit<Performance, 'key'>;
  typePerformance: Performance[];
  knowledgePointPerformance: Performance[];
  weakPoints: Performance[];
};

export function ArticleQuestionFolderDrawer({
  article,
  onClose,
  onPractice,
}: {
  article: Article;
  onClose: () => void;
  onPractice: (questions: PublicQuizQuestion[], title: string) => void;
}) {
  const [category, setCategory] = useState<Category>('all');
  const [type, setType] = useState<TypeFilter>('all');
  const [wrongCount, setWrongCount] = useState<WrongCountFilter>('all');
  const [questions, setQuestions] = useState<BookmarkQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingPractice, setIsCreatingPractice] = useState(false);
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
  const [analysis, setAnalysis] = useState<LearningAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const loadQuestions = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ category, type, wrongCount });
        const response = await fetch(`/api/v1/articles/${article.id}/question-bookmarks?${params}`, {
          signal: controller.signal,
        });
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

  const startWrongQuestionPractice = async () => {
    setIsCreatingPractice(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/articles/${article.id}/wrong-question-practice`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '创建错题练习失败。');
      onPractice(data.questions, `错题随机练习（${data.questions.length}题）`);
    } catch (practiceError) {
      setError(practiceError instanceof Error ? practiceError.message : '创建错题练习失败。');
    } finally {
      setIsCreatingPractice(false);
    }
  };

  const toggleAnalysis = async () => {
    if (isAnalysisOpen) {
      setIsAnalysisOpen(false);
      return;
    }

    setIsAnalysisOpen(true);
    setAnalysisLoading(true);
    setAnalysisError(null);
    try {
      const response = await fetch(`/api/v1/articles/${article.id}/question-learning-analysis`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '加载学习分析失败。');
      setAnalysis(data);
    } catch (analysisLoadError) {
      setAnalysisError(analysisLoadError instanceof Error ? analysisLoadError.message : '加载学习分析失败。');
    } finally {
      setAnalysisLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="关闭本篇收藏夹"
        className="absolute inset-0 cursor-default bg-slate-950/20"
        onClick={onClose}
      />
      <aside
        aria-label="本篇收藏夹"
        className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col border-l-2 border-slate-800 bg-[#fff9e8] shadow-[-5px_0_0_#7d9b68]"
      >
        <header className="flex items-start justify-between gap-4 border-b-2 border-slate-800 bg-[#e2f3d0] px-5 py-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-black text-emerald-900">
              <Bookmark size={18} /> 本篇收藏夹
            </p>
            <p className="mt-1 line-clamp-1 text-xs text-slate-600">{article.title.zh}</p>
          </div>
          <button
            type="button"
            aria-label="关闭本篇收藏夹"
            onClick={onClose}
            className="border-2 border-slate-800 bg-[#fff9e8] p-1 text-slate-800 transition hover:bg-amber-300"
          >
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="mb-4 flex flex-wrap gap-2" aria-label="收藏分类">
            {(Object.keys(categoryLabels) as Category[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setCategory(item);
                  if (item !== 'wrong') setWrongCount('all');
                }}
                className={`border-2 px-3 py-1.5 text-xs font-black transition ${category === item ? 'border-emerald-800 bg-emerald-700 text-white' : 'border-slate-700 bg-[#fffdf4] text-slate-700 hover:bg-[#fff4cc]'}`}
              >
                {categoryLabels[item]}
              </button>
            ))}
          </div>

          <div className="mb-5 flex flex-wrap gap-4">
            <div>
              <p className="mb-2 text-xs font-black text-slate-700">按题型筛选</p>
              <select
                aria-label="按题型筛选"
                value={type}
                onChange={(event) => setType(event.target.value as TypeFilter)}
                className="min-w-32 border-2 border-amber-700 bg-amber-300 px-2 py-1 text-xs font-black text-amber-950 outline-none transition focus:border-amber-950"
              >
                <option value="all">全部题型</option>
                <option value="multiple_choice">{typeLabels.multiple_choice}</option>
                <option value="true_false">{typeLabels.true_false}</option>
                <option value="fill_blank">{typeLabels.fill_blank}</option>
              </select>
            </div>
            {category === 'wrong' && (
              <div>
                <p className="mb-2 text-xs font-black text-slate-700">按答错次数筛选</p>
                <select
                  aria-label="按答错次数筛选"
                  value={wrongCount}
                  onChange={(event) => setWrongCount(event.target.value as WrongCountFilter)}
                  className="min-w-32 border-2 border-[#b94d3c] bg-[#ffe1d6] px-2 py-1 text-xs font-black text-[#8b2c21] outline-none transition focus:border-[#8b2c21]"
                >
                  <option value="all">全部次数</option>
                  <option value="1">1 次</option>
                  <option value="2">2 次</option>
                  <option value="3">3次以上</option>
                </select>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={toggleAnalysis}
            className="mb-4 flex w-full items-center justify-center gap-2 border-2 border-emerald-800 bg-[#e2f3d0] px-4 py-3 text-sm font-black text-emerald-900 shadow-[2px_2px_0_#166534] transition hover:bg-[#cfeab5]"
          >
            <BarChart3 className="h-4 w-4" /> {isAnalysisOpen ? '收起本篇学习分析' : '查看本篇学习分析'}
          </button>

          {isAnalysisOpen && (
            <section className="mb-5 border-2 border-slate-800 bg-[#f3f8e9] p-4">
              <h2 className="text-sm font-black text-emerald-900">本篇收藏题学习分析</h2>
              {analysisLoading ? (
                <div className="flex justify-center py-6 text-emerald-800">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : analysisError ? (
                <p className="mt-3 border-2 border-[#b94d3c] bg-[#ffe1d6] p-3 text-sm text-[#8b2c21]">
                  {analysisError}
                </p>
              ) : analysis ? (
                <div className="mt-3 space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                    <div className="border border-emerald-800 bg-[#fffdf4] p-2">
                      <b className="block text-lg text-emerald-900">{analysis.overview.bookmarkedCount}</b>收藏题
                    </div>
                    <div className="border border-emerald-800 bg-[#fffdf4] p-2">
                      <b className="block text-lg text-emerald-900">{analysis.overview.attemptedQuestionCount}</b>已练题
                    </div>
                    <div className="border border-emerald-800 bg-[#fffdf4] p-2">
                      <b className="block text-lg text-emerald-900">
                        {analysis.overview.accuracy === null ? '—' : `${analysis.overview.accuracy}%`}
                      </b>
                      总正确率
                    </div>
                    <div className="border border-emerald-800 bg-[#fffdf4] p-2">
                      <b className="block text-lg text-[#9f3426]">{analysis.overview.wrongCount}</b>累计错误
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-2 text-xs font-black text-slate-700">题型表现</h3>
                    <div className="space-y-1.5">
                      {analysis.typePerformance.map((item) => (
                        <p
                          key={item.key}
                          className="flex justify-between border border-slate-300 bg-[#fffdf4] px-2 py-1.5 text-xs text-slate-700"
                        >
                          <span>{typeLabels[item.key as QuizQuestionType]}</span>
                          <span>
                            {item.attemptCount ? `${item.accuracy}%（错 ${item.wrongCount} 次）` : '暂无作答'}
                          </span>
                        </p>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-2 text-xs font-black text-slate-700">知识点薄弱项</h3>
                    {analysis.weakPoints.length ? (
                      <div className="space-y-1.5">
                        {analysis.weakPoints.map((item) => (
                          <p
                            key={item.key}
                            className="border border-[#b94d3c] bg-[#ffe1d6] px-2 py-1.5 text-xs text-[#8b2c21]"
                          >
                            <b>{knowledgePointLabels[item.key] || item.key}</b>：正确率 {item.accuracy}% ，累计错{' '}
                            {item.wrongCount} 次
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="border border-slate-300 bg-[#fffdf4] px-2 py-2 text-xs text-slate-600">
                        至少需要 3 次相关作答才会判定薄弱点；当前数据不足或表现稳定。
                      </p>
                    )}
                  </div>
                </div>
              ) : null}
            </section>
          )}

          {category === 'wrong' && !loading && questions.length > 0 && (
            <button
              type="button"
              onClick={startWrongQuestionPractice}
              disabled={isCreatingPractice}
              className="mb-4 flex w-full items-center justify-center gap-2 border-2 border-slate-800 bg-amber-300 px-4 py-3 text-sm font-black text-slate-900 shadow-[3px_3px_0_#7c2d12] transition hover:bg-amber-400 disabled:cursor-wait disabled:opacity-60"
            >
              {isCreatingPractice ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> 组卷中
                </>
              ) : (
                '随机练习错题（最多 6 题）'
              )}
            </button>
          )}

          {loading ? (
            <div className="flex justify-center py-14 text-emerald-800">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : error ? (
            <div className="border-2 border-[#b94d3c] bg-[#ffe1d6] p-4 text-sm font-semibold text-[#8b2c21]">
              {error}
            </div>
          ) : questions.length === 0 ? (
            <div className="border-2 border-dashed border-slate-400 bg-[#fffdf4] p-8 text-center text-sm text-slate-600">
              当前筛选下没有收藏题目。
            </div>
          ) : (
            <div className="space-y-3">
              {questions.map((question) => (
                <article
                  key={question.id}
                  className="border-2 border-slate-800 bg-[#fffdf4] p-4 shadow-[2px_2px_0_#7d9b68]"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="border border-amber-700 bg-[#fff0ad] px-2 py-0.5 text-xs font-black text-amber-950">
                      {typeLabels[question.type]}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      作答 {question.stats.attemptCount} 次 · 正确 {question.stats.correctCount} 次 · 错误{' '}
                      {question.stats.wrongCount} 次
                    </span>
                  </div>
                  <p className="font-semibold leading-relaxed text-slate-800">{question.question}</p>
                  {question.options?.length ? (
                    <p className="mt-2 text-xs leading-relaxed text-slate-600">{question.options.join('　')}</p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() =>
                      onPractice(
                        [
                          {
                            id: question.id,
                            type: question.type,
                            question: question.question,
                            options: question.options,
                          },
                        ],
                        '收藏题练习',
                      )
                    }
                    className="mt-3 border-2 border-emerald-800 bg-[#e2f3d0] px-3 py-1.5 text-xs font-black text-emerald-900 transition hover:bg-[#cfeab5]"
                  >
                    练习此题
                  </button>
                </article>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
