import React, { useState, useMemo } from 'react';
import { Article, Difficulty } from '../types';
import { DIFFICULTY_LABELS } from '../constants';
import { CheckCircle2, ChevronRight, BookOpen, Filter } from 'lucide-react';

interface HistoryListProps {
  articles: Article[];
  completedIds: string[];
  onSelectArticle: (article: Article) => void;
}

type CompletionFilter = 'All' | 'Completed' | 'Uncompleted';

export const HistoryList: React.FC<HistoryListProps> = ({ articles, completedIds, onSelectArticle }) => {
  const [filterDifficulty, setFilterDifficulty] = useState<Difficulty | 'All'>('All');
  const [filterCompletion, setFilterCompletion] = useState<CompletionFilter>('All');

  const filteredArticles = useMemo(() => {
    return articles.filter(article => {
      // Filter by Difficulty
      if (filterDifficulty !== 'All' && article.difficulty !== filterDifficulty) {
        return false;
      }
      
      // Filter by Completion
      const isCompleted = completedIds.includes(article.id);
      if (filterCompletion === 'Completed' && !isCompleted) return false;
      if (filterCompletion === 'Uncompleted' && isCompleted) return false;

      return true;
    });
  }, [articles, completedIds, filterDifficulty, filterCompletion]);

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-20">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center">
        <BookOpen className="mr-2" /> 文章库
      </h2>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-4 mb-6">
        <div className="flex flex-col gap-3">
          
          {/* Difficulty Filter */}
          <div className="flex flex-wrap gap-2 items-center">
             <span className="text-xs font-semibold text-slate-500 w-12">难度:</span>
             <button 
                onClick={() => setFilterDifficulty('All')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition ${filterDifficulty === 'All' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
             >
               全部
             </button>
             {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((diff) => (
               <button
                  key={diff}
                  onClick={() => setFilterDifficulty(diff)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${filterDifficulty === diff ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
               >
                 {DIFFICULTY_LABELS[diff]}
               </button>
             ))}
          </div>

          {/* Completion Filter */}
          <div className="flex flex-wrap gap-2 items-center">
             <span className="text-xs font-semibold text-slate-500 w-12">状态:</span>
             <button 
                onClick={() => setFilterCompletion('All')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition ${filterCompletion === 'All' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
             >
               全部
             </button>
             <button 
                onClick={() => setFilterCompletion('Completed')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition ${filterCompletion === 'Completed' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
             >
               已完成
             </button>
             <button 
                onClick={() => setFilterCompletion('Uncompleted')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition ${filterCompletion === 'Uncompleted' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
             >
               未完成
             </button>
          </div>
        </div>
      </div>
      
      {filteredArticles.length === 0 && (
         <div className="text-center py-10 text-slate-400">
             没有找到符合条件的文章。
         </div>
      )}

      {filteredArticles.map((article) => {
        const isCompleted = completedIds.includes(article.id);
        
        return (
          <div 
            key={article.id}
            onClick={() => onSelectArticle(article)}
            className="group bg-white rounded-xl p-4 shadow-sm border border-slate-100 hover:shadow-md hover:border-indigo-100 transition cursor-pointer flex items-center justify-between"
          >
            <div className="flex-1 min-w-0 pr-4">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${
                  article.difficulty === Difficulty.Advanced ? 'bg-red-50 text-red-600' :
                  article.difficulty === Difficulty.Intermediate ? 'bg-yellow-50 text-yellow-600' :
                  'bg-green-50 text-green-600'
                }`}>
                  {DIFFICULTY_LABELS[article.difficulty]}
                </span>
                <span className="text-xs text-slate-400">{article.date}</span>
              </div>
              <h3 className="font-semibold text-slate-800 truncate group-hover:text-indigo-700 transition">
                {article.title.zh}
              </h3>
              <p className="text-sm text-slate-500 truncate mt-1">
                {article.summary.zh}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {isCompleted && <CheckCircle2 className="w-5 h-5 text-green-500" />}
              <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-400" />
            </div>
          </div>
        );
      })}
    </div>
  );
};