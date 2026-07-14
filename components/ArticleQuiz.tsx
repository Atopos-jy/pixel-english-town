'use client';

import React, { useState } from 'react';
import { QuizQuestion, QuizResult, Difficulty } from '../types';
import { CheckCircle2, XCircle, RotateCcw, Trophy, Loader2, ChevronRight, ChevronLeft } from 'lucide-react';

interface ArticleQuizProps {
  articleText: string;
  difficulty: Difficulty;
  onClose: () => void;
}

type QuizPhase = 'idle' | 'loading' | 'answering' | 'finished';

export const ArticleQuiz: React.FC<ArticleQuizProps> = ({ articleText, difficulty, onClose }) => {
  const [phase, setPhase] = useState<QuizPhase>('idle');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [userAnswer, setUserAnswer] = useState<string>('');
  const [fillInput, setFillInput] = useState('');
  const [showExplanation, setShowExplanation] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    try {
      const res = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleText, difficulty }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '生成失败');
      setQuestions(data.questions);
      setPhase('answering');
    } catch (e: any) {
      setError(e.message);
      setPhase('idle');
    }
  };

  const submitAnswer = (answer: string) => {
    if (isAnswered) return;
    const q = currentQuestion;
    let correct = false;

    if (q.type === 'multiple_choice') {
      correct = answer.toUpperCase() === q.answer.toUpperCase();
    } else if (q.type === 'true_false') {
      correct = answer.toLowerCase() === q.answer.toLowerCase();
    } else if (q.type === 'fill_blank') {
      // 忽略大小写和首尾标点
      const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
      correct = normalize(answer) === normalize(q.answer);
    }

    setUserAnswer(answer);
    setShowExplanation(true);
    setResults(prev => [...prev, { questionIndex: currentIdx, userAnswer: answer, correct }]);
  };

  const goNext = () => {
    if (isLast) {
      setPhase('finished');
    } else {
      setCurrentIdx(i => i + 1);
      setUserAnswer('');
      setFillInput('');
      setShowExplanation(false);
    }
  };

  const scoreCount = results.filter(r => r.correct).length;
  const scorePercent = totalCount > 0 ? Math.round((scoreCount / totalCount) * 100) : 0;

  const scoreColor =
    scorePercent >= 80 ? 'text-green-600' :
    scorePercent >= 60 ? 'text-yellow-600' : 'text-red-500';

  const scoreBg =
    scorePercent >= 80 ? 'bg-green-50 border-green-200' :
    scorePercent >= 60 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200';

  const scoreMessage =
    scorePercent >= 80 ? '太棒了！理解得很透彻 🎉' :
    scorePercent >= 60 ? '不错！还有提升空间 💪' : '再读一遍，加油！📖';

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
          <div className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            {error}
          </div>
        )}
        <button
          onClick={generateQuiz}
          disabled={phase === 'loading'}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all disabled:opacity-60 disabled:cursor-wait shadow-md"
        >
          {phase === 'loading'
            ? <><Loader2 className="w-4 h-4 animate-spin" /> AI 出题中…</>
            : '开始测验'}
        </button>
      </div>
    );
  }

  // ── 答题结束 ──
  if (phase === 'finished') {
    return (
      <div className="flex flex-col items-center py-10 gap-6">
        <Trophy className="w-12 h-12 text-yellow-500" />
        <div className={`rounded-2xl border px-10 py-6 text-center ${scoreBg}`}>
          <div className={`text-5xl font-bold mb-1 ${scoreColor}`}>{scorePercent}%</div>
          <div className="text-slate-600 text-sm">{scoreCount} / {totalCount} 题正确</div>
          <div className="mt-3 text-slate-700 font-medium">{scoreMessage}</div>
        </div>

        {/* 题目回顾 */}
        <div className="w-full space-y-3 mt-2">
          {questions.map((q, idx) => {
            const r = results[idx];
            return (
              <div key={idx} className={`rounded-xl border p-4 text-sm ${r?.correct ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-start gap-2">
                  {r?.correct
                    ? <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                    : <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />}
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">{q.question}</p>
                    {!r?.correct && (
                      <p className="text-red-500 mt-1">你的答案：{r?.userAnswer || '（未作答）'}</p>
                    )}
                    <p className="text-slate-600 mt-1">正确答案：<span className="font-semibold">{q.answer}</span></p>
                    <p className="text-slate-500 mt-1 italic">{q.explanation}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3">
          <button
            onClick={generateQuiz}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-200 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" /> 重新出题
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-all"
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
        <span>第 {currentIdx + 1} 题 / 共 {totalCount} 题</span>
        <span>{results.filter(r => r.correct).length} 题正确</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-1.5">
        <div
          className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${((currentIdx) / totalCount) * 100}%` }}
        />
      </div>

      {/* 题目 */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
            {currentQuestion.type === 'multiple_choice' ? '单选题' :
             currentQuestion.type === 'true_false' ? '判断题' : '填空题'}
          </span>
        </div>
        <p className="text-slate-800 font-medium leading-relaxed">{currentQuestion.question}</p>
      </div>

      {/* 选项 */}
      {currentQuestion.type === 'multiple_choice' && (
        <div className="grid grid-cols-1 gap-2">
          {currentQuestion.options?.map((opt) => {
            const letter = opt.charAt(0); // "A" / "B" / "C" / "D"
            const isSelected = userAnswer === letter;
            const isCorrect = currentQuestion.answer.toUpperCase() === letter;
            let cls = 'border rounded-xl px-4 py-3 text-sm text-left cursor-pointer transition-all font-medium ';
            if (!isAnswered) {
              cls += 'bg-white border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 text-slate-700';
            } else if (isCorrect) {
              cls += 'bg-green-50 border-green-400 text-green-700';
            } else if (isSelected) {
              cls += 'bg-red-50 border-red-400 text-red-600';
            } else {
              cls += 'bg-white border-slate-200 text-slate-400';
            }
            return (
              <button key={letter} className={cls} onClick={() => submitAnswer(letter)} disabled={isAnswered}>
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
            const isCorrect = currentQuestion.answer.toLowerCase() === val;
            let cls = 'flex-1 border rounded-xl py-3 text-sm font-medium cursor-pointer transition-all ';
            if (!isAnswered) {
              cls += 'bg-white border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 text-slate-700';
            } else if (isCorrect) {
              cls += 'bg-green-50 border-green-400 text-green-700';
            } else if (isSelected) {
              cls += 'bg-red-50 border-red-400 text-red-600';
            } else {
              cls += 'bg-white border-slate-200 text-slate-400';
            }
            return (
              <button key={val} className={cls} onClick={() => submitAnswer(val)} disabled={isAnswered}>
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
            onKeyDown={(e) => { if (e.key === 'Enter' && fillInput.trim()) submitAnswer(fillInput.trim()); }}
            disabled={isAnswered}
            placeholder="输入你的答案…"
            className="flex-1 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400 disabled:bg-slate-50 disabled:text-slate-500"
          />
          {!isAnswered && (
            <button
              onClick={() => { if (fillInput.trim()) submitAnswer(fillInput.trim()); }}
              disabled={!fillInput.trim()}
              className="px-4 py-3 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 transition-all"
            >
              提交
            </button>
          )}
        </div>
      )}

      {/* 解析 */}
      {showExplanation && (
        <div className={`rounded-xl border p-4 text-sm ${results[currentIdx]?.correct ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className="flex items-center gap-1.5 font-semibold mb-1">
            {results[currentIdx]?.correct
              ? <><CheckCircle2 className="w-4 h-4 text-green-500" /><span className="text-green-700">回答正确！</span></>
              : <><XCircle className="w-4 h-4 text-amber-500" /><span className="text-amber-700">回答有误，正确答案：{currentQuestion.answer}</span></>
            }
          </div>
          <p className="text-slate-600 leading-relaxed">{currentQuestion.explanation}</p>
        </div>
      )}

      {/* 下一题 / 查看结果 */}
      {isAnswered && (
        <button
          onClick={goNext}
          className="flex items-center justify-center gap-1.5 w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all"
        >
          {isLast ? <><Trophy className="w-4 h-4" /> 查看结果</> : <>下一题 <ChevronRight className="w-4 h-4" /></>}
        </button>
      )}
    </div>
  );
};
