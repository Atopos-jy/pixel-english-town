'use client';

import { useEffect } from 'react';
import { BookOpenCheck, X } from 'lucide-react';
import { Article, Difficulty } from '@/types';
import { ArticleQuiz } from './ArticleQuiz';

interface QuizDrawerProps {
  article: Article;
  onRequestClose: () => void;
  onActivityChange: (isActive: boolean) => void;
}

export function QuizDrawer({ article, onRequestClose, onActivityChange }: QuizDrawerProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onRequestClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onRequestClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="关闭阅读理解测验"
        className="absolute inset-0 cursor-default bg-slate-950/20"
        onClick={onRequestClose}
      />

      <aside
        aria-label="阅读理解测验"
        className="relative flex h-full w-full max-w-[480px] flex-col border-l-2 border-slate-800 bg-[#fff9e8] shadow-[-5px_0_0_#7d9b68]"
      >
        <header className="flex items-start justify-between gap-4 border-b-2 border-slate-800 bg-[#e2f3d0] px-5 py-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-black text-emerald-900">
              <BookOpenCheck size={18} />阅读理解测验
            </p>
            <p className="mt-1 line-clamp-1 text-xs font-medium text-slate-600">{article.title.zh}</p>
          </div>
          <button
            type="button"
            aria-label="关闭测验"
            onClick={onRequestClose}
            className="border-2 border-slate-800 bg-[#fff9e8] p-1 text-slate-800 transition hover:bg-amber-300"
          >
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <ArticleQuiz
            key={article.id}
            articleText={article.content.map((block) => block.en).join('\n\n')}
            difficulty={article.difficulty as Difficulty}
            onClose={onRequestClose}
            onActivityChange={onActivityChange}
          />
        </div>
      </aside>
    </div>
  );
}
