import { BookOpen, Check } from 'lucide-react';
import { Article } from '@/types';

interface ArticleShelfProps {
  articles: Article[];
  activeArticleId: string;
  completedArticleIds: string[];
  onSelect: (article: Article) => void;
  listClassName?: string;
}

export function ArticleShelf({
  articles,
  activeArticleId,
  completedArticleIds,
  onSelect,
  listClassName = 'max-h-[65vh]',
}: ArticleShelfProps) {
  return (
    <>
      <div className="border-b-2 border-slate-800 bg-[#172033] p-4 text-white">
        <p className="flex items-center gap-2 text-sm font-black">
          <BookOpen size={18} />
          文章书架
        </p>
      </div>
      <div className={`${listClassName} overflow-y-auto p-2`}>
        {articles.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item)}
            className={`mb-2 w-full border-2 p-3 text-left text-sm ${
              activeArticleId === item.id
                ? 'border-emerald-800 bg-[#e2f3d0] shadow-[2px_2px_0_#166534]'
                : 'border-transparent hover:border-amber-500 hover:bg-[#fff4cc]'
            }`}
          >
            <b className="block">{item.title.zh}</b>
            <span className="mt-1 block text-xs text-slate-500">{item.title.en}</span>
            {completedArticleIds.includes(item.id) && (
              <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                <Check size={13} />已完成
              </span>
            )}
          </button>
        ))}
      </div>
    </>
  );
}
