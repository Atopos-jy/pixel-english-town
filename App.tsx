'use client';

import React, { useState, useEffect } from 'react';
import { Home, BookOpen, BarChart3, LogOut } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import { MOTIVATIONAL_QUOTES } from './constants';
import { getProgress, getArticles, markArticleComplete } from './services/storageService';
import { ArticleReader } from './components/ArticleReader';
import { HistoryList } from './components/HistoryList';
import { StatsDashboard } from './components/StatsDashboard';
import { AuthForm } from './components/AuthForm';
import { Article, UserProgress } from './types';

enum View {
  Home = 'Home',
  History = 'History',
  Stats = 'Stats',
}

const App: React.FC = () => {
  const { data: session, status } = useSession();
  const [currentView, setCurrentView] = useState<View>(View.Home);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  // Initialize data only when authenticated
  useEffect(() => {
    if (status !== 'authenticated') return;

    const fetchData = async () => {
        try {
            const [fetchedProgress, fetchedArticles] = await Promise.all([
                getProgress(),
                getArticles()
            ]);
            
            setProgress(fetchedProgress);
            setArticles(fetchedArticles);

            // Find today's article
            if (fetchedArticles.length > 0) {
                const today = new Date().toISOString().split('T')[0];
                const todaysArticle = fetchedArticles.find(a => a.date === today) || fetchedArticles[0];
                if (!selectedArticle) {
                    setSelectedArticle(todaysArticle);
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setDataLoading(false);
        }
    };

    fetchData();
  }, [status]);

  const handleCompleteArticle = async () => {
    if (!selectedArticle) return;
    
    const { progress: newProgress, newBadges } = await markArticleComplete(selectedArticle);
    
    if (newProgress) {
        setProgress(newProgress);
        
        // Show motivation
        const quote = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
        setToastMessage(quote);

        if (newBadges.length > 0) {
            setTimeout(() => {
                setToastMessage(`解锁徽章: ${newBadges.join(', ')}!`);
            }, 3000);
        }

        setTimeout(() => setToastMessage(null), 5000);
    }
  };

  const handleNavChange = (view: View) => {
    setCurrentView(view);
    if (view === View.Home && articles.length > 0) {
       const today = new Date().toISOString().split('T')[0];
       const todaysArticle = articles.find(a => a.date === today) || articles[0];
       setSelectedArticle(todaysArticle);
    }
    window.scrollTo(0, 0);
  };

  const handleSelectHistoryArticle = (article: Article) => {
    setSelectedArticle(article);
    setCurrentView(View.Home);
    window.scrollTo(0, 0);
  };

  if (status === 'loading') {
    return <div className="flex h-screen items-center justify-center text-slate-400">Loading...</div>;
  }

  if (status === 'unauthenticated') {
    return <AuthForm />;
  }

  if (dataLoading || !progress || !selectedArticle) return <div className="flex h-screen items-center justify-center text-slate-400">准备数据中...</div>;

  // 调试：打印session信息
  console.log('Session:', session);
  console.log('User role:', session?.user);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16 md:pb-0 font-sans">
      
      {/* Desktop Header */}
      <nav className="hidden md:block sticky top-0 z-50 bg-white border-b border-slate-200 px-8 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-indigo-600 text-xl">
             <BookOpen /> 每日英语阅读
          </div>
          <div className="flex gap-8 items-center">
            <button onClick={() => handleNavChange(View.Home)} className={`font-medium transition ${currentView === View.Home ? 'text-indigo-600' : 'text-slate-500 hover:text-indigo-600'}`}>今日阅读</button>
            <button onClick={() => handleNavChange(View.History)} className={`font-medium transition ${currentView === View.History ? 'text-indigo-600' : 'text-slate-500 hover:text-indigo-600'}`}>文章库</button>
            <button onClick={() => handleNavChange(View.Stats)} className={`font-medium transition ${currentView === View.Stats ? 'text-indigo-600' : 'text-slate-500 hover:text-indigo-600'}`}>统计</button>
            
            {/* @ts-ignore */}
            {(session?.user?.role === 'admin' || true) && (
              <a 
                href="/admin" 
                className="font-medium text-purple-600 hover:text-purple-700 transition"
              >
                管理后台 {session?.user?.role ? `(${session.user.role})` : '(role未定义)'}
              </a>
            )}
            
            <div className="h-6 w-px bg-slate-200 mx-2"></div>
            
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-600">{session?.user?.name}</span>
              <button 
                onClick={() => signOut()}
                className="text-slate-400 hover:text-red-500 transition"
                title="退出登录"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto px-4 pt-6 md:pt-10">
        
        {/* Mobile Header (User info) */}
        <div className="md:hidden flex justify-between items-center mb-6">
           <div className="flex items-center gap-2 font-bold text-indigo-600 text-lg">
             <BookOpen size={20} /> 每日英语
          </div>
          <div className="flex items-center gap-3">
             <span className="text-xs font-medium text-slate-600 truncate max-w-[100px]">{session?.user?.name}</span>
             <button onClick={() => signOut()} className="text-slate-400">
               <LogOut size={18} />
             </button>
          </div>
        </div>

        {currentView === View.Home && (
          <ArticleReader 
            article={selectedArticle}
            isCompleted={progress.completedArticleIds.includes(selectedArticle.id)}
            onComplete={handleCompleteArticle}
          />
        )}

        {currentView === View.History && (
          <HistoryList 
            articles={articles}
            completedIds={progress.completedArticleIds}
            onSelectArticle={handleSelectHistoryArticle}
          />
        )}

        {currentView === View.Stats && (
          <StatsDashboard stats={progress.stats} />
        )}

      </main>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in-down">
          <div className="bg-slate-900 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-3 text-sm font-medium">
             <span>✨</span> {toastMessage}
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg z-40 pb-safe">
        <div className="flex justify-around items-center h-16">
          <button 
            onClick={() => handleNavChange(View.Home)}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentView === View.Home ? 'text-indigo-600' : 'text-slate-400'}`}
          >
            <Home size={24} strokeWidth={currentView === View.Home ? 2.5 : 2} />
            <span className="text-[10px] font-medium">阅读</span>
          </button>
          <button 
            onClick={() => handleNavChange(View.History)}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentView === View.History ? 'text-indigo-600' : 'text-slate-400'}`}
          >
            <BookOpen size={24} strokeWidth={currentView === View.History ? 2.5 : 2} />
            <span className="text-[10px] font-medium">文章库</span>
          </button>
          <button 
            onClick={() => handleNavChange(View.Stats)}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentView === View.Stats ? 'text-indigo-600' : 'text-slate-400'}`}
          >
            <BarChart3 size={24} strokeWidth={currentView === View.Stats ? 2.5 : 2} />
            <span className="text-[10px] font-medium">统计</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;