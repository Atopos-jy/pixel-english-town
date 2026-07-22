'use client';

import React, { useEffect, useState } from 'react';
import { PublicQuizQuestion, QuizResult } from '../types';
import { Bookmark, CheckCircle2, XCircle, RotateCcw, Trophy, Loader2, ChevronRight, ChevronLeft } from 'lucide-react';

interface ArticleQuizProps {
  articleId: string;
  initialQuestions?: PublicQuizQuestion[];
  activeGenerationJobId?: string | null;
  onClose: () => void;
  onActivityChange?: (isActive: boolean) => void;
  onGenerationJobChange?: (jobId: string | null) => void;
}

type QuizPhase = 'idle' | 'loading' | 'answering' | 'finished';

export const ArticleQuiz: React.FC<ArticleQuizProps> = ({
  articleId,
  initialQuestions,
  activeGenerationJobId,
  onClose,
  onActivityChange,
  onGenerationJobChange,
}) => {
  const isPracticeMode = Boolean(initialQuestions?.length);
  const [phase, setPhase] = useState<QuizPhase>(isPracticeMode ? 'answering' : 'idle');
  const [questions, setQuestions] = useState<PublicQuizQuestion[]>(initialQuestions || []);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [userAnswer, setUserAnswer] = useState<string>('');
  const [fillInput, setFillInput] = useState('');
  const [showExplanation, setShowExplanation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [bookmarkedQuestionIds, setBookmarkedQuestionIds] = useState<Set<string>>(new Set());
  const [bookmarkingQuestionId, setBookmarkingQuestionId] = useState<string | null>(null);
  const [generationJobId, setGenerationJobId] = useState<string | null>(activeGenerationJobId || null);

  useEffect(() => {
    onActivityChange?.(phase === 'answering');
  }, [onActivityChange, phase]);

  useEffect(() => {
    if (!activeGenerationJobId || activeGenerationJobId === generationJobId) return;
    setGenerationJobId(activeGenerationJobId);
    setPhase('loading');
  }, [activeGenerationJobId, generationJobId]);

  useEffect(() => {
    if (!generationJobId) return;
    let stopped = false;
    let timeoutId: number | undefined;

    const checkJob = async () => {
      try {
        const response = await fetch(`/api/quiz/generate/${generationJobId}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '无法查询出题进度。');
        if (stopped) return;

        if (data.job.status === 'completed') {
          setQuestions(data.job.questions || []);
          setGenerationJobId(null);
          onGenerationJobChange?.(null);
          setPhase('answering');
          return;
        }
        if (data.job.status === 'failed') {
          setError(data.job.error || '出题失败。');
          setGenerationJobId(null);
          onGenerationJobChange?.(null);
          setPhase('idle');
          return;
        }
      } catch (jobError) {
        if (stopped) return;
        setError(jobError instanceof Error ? jobError.message : '无法查询出题进度。');
      }
      if (!stopped) timeoutId = window.setTimeout(checkJob, 2000);
    };

    void checkJob();
    return () => {
      stopped = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [generationJobId, onGenerationJobChange]);

  const currentQuestion = questions[currentIdx];
  const totalCount = questions.length;
  const isAnswered = results[currentIdx] !== undefined;
  const isLast = currentIdx === totalCount - 1;

  const generateQuiz = async () => {
    setPhase('loading');
    setError(null);
    setResults([]);
    setCurrentIdx(0);
    setUserAnswer('');
    setFillInput('');
    setShowExplanation(false);
    setIsSubmittingAnswer(false);
    setBookmarkedQuestionIds(new Set());

    try {
      const res = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '生成失败');
      setGenerationJobId(data.job.id);
      onGenerationJobChange?.(data.job.id);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : '生成失败');
      setPhase('idle');
    }
  };

  const submitAnswer = async (answer: string) => {
    if (isAnswered || isSubmittingAnswer) return;
    setIsSubmittingAnswer(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/questions/${currentQuestion.id}/attempt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '提交答案失败。');

      setUserAnswer(answer);
      setShowExplanation(true);
      setResults((prev) => [
        ...prev,
        {
          questionIndex: currentIdx,
          userAnswer: answer,
          correct: data.correct,
          correctAnswer: data.correctAnswer,
          explanation: data.explanation,
        },
      ]);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : '提交答案失败。');
    } finally {
      setIsSubmittingAnswer(false);
    }
  };

  const goNext = () => {
    if (isLast) {
      setPhase('finished');
    } else {
      const nextIdx = currentIdx + 1;
      const nextResult = results[nextIdx];
      setCurrentIdx(nextIdx);
      setUserAnswer(nextResult?.userAnswer || '');
      setFillInput(nextResult?.userAnswer || '');
      setShowExplanation(Boolean(nextResult));
    }
  };

  const goPrevious = () => {
    if (currentIdx === 0) return;

    const previousIdx = currentIdx - 1;
    const previousResult = results[previousIdx];
    setCurrentIdx(previousIdx);
    setUserAnswer(previousResult?.userAnswer || '');
    setFillInput(previousResult?.userAnswer || '');
    setShowExplanation(Boolean(previousResult));
  };

  const toggleBookmark = async () => {
    const questionId = currentQuestion.id;
    if (bookmarkingQuestionId) return;

    const isBookmarked = bookmarkedQuestionIds.has(questionId);
    setBookmarkingQuestionId(questionId);
    setError(null);

    try {
      const response = await fetch(`/api/v1/questions/${questionId}/bookmark`, {
        method: isBookmarked ? 'DELETE' : 'POST',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '更新收藏失败。');

      setBookmarkedQuestionIds((previous) => {
        const next = new Set(previous);
        if (data.isBookmarked) next.add(questionId);
        else next.delete(questionId);
        return next;
      });
    } catch (bookmarkError) {
      setError(bookmarkError instanceof Error ? bookmarkError.message : '更新收藏失败。');
    } finally {
      setBookmarkingQuestionId(null);
    }
  };

  const scoreCount = results.filter((r) => r.correct).length;
  const scorePercent = totalCount > 0 ? Math.round((scoreCount / totalCount) * 100) : 0;

  const scoreColor = scorePercent >= 80 ? 'text-emerald-800' : scorePercent >= 60 ? 'text-amber-700' : 'text-[#9f3426]';

  const scoreBg =
    scorePercent >= 80
      ? 'bg-[#e2f3d0] border-emerald-700'
      : scorePercent >= 60
        ? 'bg-[#fff0ad] border-amber-600'
        : 'bg-[#ffe1d6] border-[#b94d3c]';

  const scoreMessage =
    scorePercent >= 80
      ? '太棒了！理解得很透彻 🎉'
      : scorePercent >= 60
        ? '不错！还有提升空间 💪'
        : '再读一遍，加油！📖';

  // ── 空闲 / 错误状态 ──
  if (phase === 'idle' || phase === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-6">
        <div className="text-center">
          <div className="text-4xl mb-3">📝</div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">阅读理解测验</h3>
          <p className="text-slate-500 text-sm max-w-sm">
            AI 将根据文章内容出题，包含单选、判断和填空题，测试你的阅读理解程度。
          </p>
        </div>
        {error && (
          <div className="border-2 border-[#b94d3c] bg-[#ffe1d6] px-4 py-2 text-sm text-[#9f3426]">{error}</div>
        )}
        <button
          onClick={generateQuiz}
          disabled={phase === 'loading'}
          className="flex items-center gap-2 border-2 border-slate-800 bg-amber-300 px-6 py-3 font-semibold text-slate-900 shadow-[3px_3px_0_#7c2d12] transition-all hover:bg-amber-400 disabled:cursor-wait disabled:opacity-60"
        >
          {phase === 'loading' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> AI 出题中…
            </>
          ) : (
            '开始测验'
          )}
        </button>
      </div>
    );
  }

  // ── 答题结束 ──
  if (phase === 'finished') {
    return (
      <div className="flex flex-col items-center py-10 gap-6">
        <Trophy className="w-12 h-12 text-yellow-500" />
        <div className={`border-2 px-10 py-6 text-center ${scoreBg}`}>
          <div className={`text-5xl font-bold mb-1 ${scoreColor}`}>{scorePercent}%</div>
          <div className="text-slate-600 text-sm">
            {scoreCount} / {totalCount} 题正确
          </div>
          <div className="mt-3 text-slate-700 font-medium">{scoreMessage}</div>
        </div>

        {/* 题目回顾 */}
        <div className="w-full space-y-3 mt-2">
          {questions.map((q, idx) => {
            const r = results[idx];
            return (
              <div
                key={idx}
                className={`border-2 p-4 text-sm ${r?.correct ? 'border-emerald-700 bg-[#e2f3d0]' : 'border-[#b94d3c] bg-[#ffe1d6]'}`}
              >
                <div className="flex items-start gap-2">
                  {r?.correct ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">{q.question}</p>
                    {!r?.correct && <p className="text-red-500 mt-1">你的答案：{r?.userAnswer || '（未作答）'}</p>}
                    <p className="text-slate-600 mt-1">
                      正确答案：<span className="font-semibold">{r?.correctAnswer}</span>
                    </p>
                    <p className="text-slate-500 mt-1 italic">{r?.explanation}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3">
          {!isPracticeMode && (
            <button
              onClick={generateQuiz}
              className="flex items-center gap-1.5 border-2 border-emerald-800 bg-[#e2f3d0] px-4 py-2 text-sm font-medium text-emerald-900 transition-all hover:bg-[#cfeab5]"
            >
              <RotateCcw className="w-3.5 h-3.5" /> 重新出题
            </button>
          )}
          <button
            onClick={onClose}
            className="border-2 border-slate-700 bg-[#fff9e8] px-4 py-2 text-sm font-medium text-slate-700 transition-all hover:bg-[#fff4cc]"
          >
            关闭测验
          </button>
        </div>
      </div>
    );
  }

  // ── 答题中 ──
  return (
    <div className="flex flex-col gap-5">
      {/* 进度条 */}
      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
        <span>
          第 {currentIdx + 1} 题 / 共 {totalCount} 题
        </span>
        <span>{results.filter((r) => r.correct).length} 题正确</span>
      </div>
      <div className="h-2 w-full border border-slate-800 bg-[#e8f0d8]">
        <div
          className="h-full bg-emerald-700 transition-all duration-500"
          style={{ width: `${(currentIdx / totalCount) * 100}%` }}
        />
      </div>

      {error && <div className="border-2 border-[#b94d3c] bg-[#ffe1d6] px-4 py-3 text-sm text-[#9f3426]">{error}</div>}

      {/* 题目 */}
      <div className="border-2 border-slate-800 bg-[#fffdf4] p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="border border-amber-700 bg-[#fff0ad] px-2 py-0.5 text-xs font-semibold text-amber-950">
            {currentQuestion.type === 'multiple_choice'
              ? '单选题'
              : currentQuestion.type === 'true_false'
                ? '判断题'
                : '填空题'}
          </span>
          <button
            type="button"
            onClick={toggleBookmark}
            disabled={bookmarkingQuestionId === currentQuestion.id}
            aria-label={bookmarkedQuestionIds.has(currentQuestion.id) ? '取消收藏本题' : '收藏本题'}
            className={`ml-auto flex items-center gap-1 border px-2 py-0.5 text-xs font-semibold transition disabled:cursor-wait disabled:opacity-60 ${
              bookmarkedQuestionIds.has(currentQuestion.id)
                ? 'border-amber-700 bg-amber-300 text-amber-950'
                : 'border-slate-500 bg-[#fffdf4] text-slate-700 hover:bg-[#fff4cc]'
            }`}
          >
            <Bookmark
              className="h-3.5 w-3.5"
              fill={bookmarkedQuestionIds.has(currentQuestion.id) ? 'currentColor' : 'none'}
            />
            {bookmarkedQuestionIds.has(currentQuestion.id) ? '已收藏' : '收藏题目'}
          </button>
        </div>
        <p className="text-slate-800 font-medium leading-relaxed">{currentQuestion.question}</p>
      </div>

      {/* 选项 */}
      {currentQuestion.type === 'multiple_choice' && (
        <div className="grid grid-cols-1 gap-2">
          {currentQuestion.options?.map((opt) => {
            const letter = opt.charAt(0); // "A" / "B" / "C" / "D"
            const isSelected = userAnswer === letter;
            const isCorrect = results[currentIdx]?.correctAnswer?.toUpperCase() === letter;
            let cls = 'border-2 px-4 py-3 text-sm text-left cursor-pointer transition-all font-medium ';
            if (!isAnswered) {
              cls += 'border-slate-500 bg-[#fff9e8] hover:border-amber-600 hover:bg-[#fff4cc] text-slate-700';
            } else if (isCorrect) {
              cls += 'border-emerald-700 bg-[#e2f3d0] text-emerald-900';
            } else if (isSelected) {
              cls += 'border-[#b94d3c] bg-[#ffe1d6] text-[#9f3426]';
            } else {
              cls += 'bg-white border-slate-200 text-slate-400';
            }
            return (
              <button
                key={letter}
                className={cls}
                onClick={() => submitAnswer(letter)}
                disabled={isAnswered || isSubmittingAnswer}
              >
                <span className="font-bold mr-2">{letter}.</span>
                {opt.slice(3)} {/* 去掉 "A. " 前缀显示内容 */}
                {isAnswered && isCorrect && <CheckCircle2 className="inline w-4 h-4 ml-1 text-green-500" />}
                {isAnswered && isSelected && !isCorrect && <XCircle className="inline w-4 h-4 ml-1 text-red-400" />}
              </button>
            );
          })}
        </div>
      )}

      {currentQuestion.type === 'true_false' && (
        <div className="flex gap-3">
          {['true', 'false'].map((val) => {
            const label = val === 'true' ? '✅ 正确' : '❌ 错误';
            const isSelected = userAnswer === val;
            const isCorrect = results[currentIdx]?.correctAnswer?.toLowerCase() === val;
            let cls = 'flex-1 border-2 py-3 text-sm font-medium cursor-pointer transition-all ';
            if (!isAnswered) {
              cls += 'border-slate-500 bg-[#fff9e8] hover:border-amber-600 hover:bg-[#fff4cc] text-slate-700';
            } else if (isCorrect) {
              cls += 'border-emerald-700 bg-[#e2f3d0] text-emerald-900';
            } else if (isSelected) {
              cls += 'border-[#b94d3c] bg-[#ffe1d6] text-[#9f3426]';
            } else {
              cls += 'bg-white border-slate-200 text-slate-400';
            }
            return (
              <button
                key={val}
                className={cls}
                onClick={() => submitAnswer(val)}
                disabled={isAnswered || isSubmittingAnswer}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {currentQuestion.type === 'fill_blank' && (
        <div className="flex gap-2">
          <input
            type="text"
            value={fillInput}
            onChange={(e) => setFillInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && fillInput.trim()) submitAnswer(fillInput.trim());
            }}
            disabled={isAnswered || isSubmittingAnswer}
            placeholder="输入你的答案…"
            className="flex-1 border-2 border-slate-700 bg-[#fffdf4] px-4 py-3 text-sm focus:border-emerald-700 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
          />
          {!isAnswered && (
            <button
              onClick={() => {
                if (fillInput.trim()) submitAnswer(fillInput.trim());
              }}
              disabled={!fillInput.trim() || isSubmittingAnswer}
              className="border-2 border-slate-800 bg-amber-300 px-4 py-3 text-sm font-medium text-slate-900 shadow-[2px_2px_0_#7c2d12] transition-all hover:bg-amber-400 disabled:opacity-40"
            >
              提交
            </button>
          )}
        </div>
      )}

      {/* 解析 */}
      {showExplanation && (
        <div
          className={`border-2 p-4 text-sm ${results[currentIdx]?.correct ? 'border-emerald-700 bg-[#e2f3d0]' : 'border-amber-600 bg-[#fff4cc]'}`}
        >
          <div className="flex items-center gap-1.5 font-semibold mb-1">
            {results[currentIdx]?.correct ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-green-700">回答正确！</span>
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 text-amber-500" />
                <span className="text-amber-700">回答有误，正确答案：{results[currentIdx]?.correctAnswer}</span>
              </>
            )}
          </div>
          <p className="text-slate-600 leading-relaxed">{results[currentIdx]?.explanation}</p>
        </div>
      )}

      {/* 题目导航 */}
      {(currentIdx > 0 || isAnswered) && (
        <div className="flex gap-3">
          {currentIdx > 0 && (
            <button
              type="button"
              onClick={goPrevious}
              className="flex flex-1 items-center justify-center gap-1.5 border-2 border-slate-800 bg-[#fff9e8] py-3 font-semibold text-slate-800 shadow-[3px_3px_0_#7d9b68] transition-all hover:bg-[#fff4cc]"
            >
              <ChevronLeft className="w-4 h-4" /> 上一题
            </button>
          )}
          {isAnswered && (
            <button
              type="button"
              onClick={goNext}
              className="flex flex-1 items-center justify-center gap-1.5 border-2 border-slate-800 bg-amber-300 py-3 font-semibold text-slate-900 shadow-[3px_3px_0_#7c2d12] transition-all hover:bg-amber-400"
            >
              {isLast ? (
                <>
                  <Trophy className="w-4 h-4" /> 查看结果
                </>
              ) : (
                <>
                  下一题 <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
