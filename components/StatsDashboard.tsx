import React from 'react';
import { UserStats } from '../types';
import { BADGES } from '../constants';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Flame, Book, Lock, Calendar } from 'lucide-react';

interface StatsDashboardProps {
  stats: UserStats;
}

// Helper to get color based on activity count
const getActivityColor = (count: number) => {
  if (count === 0) return 'bg-slate-100';
  if (count === 1) return 'bg-green-200';
  if (count === 2) return 'bg-green-300';
  if (count === 3) return 'bg-green-400';
  return 'bg-green-500';
};

const HeatmapCalendar: React.FC<{ activityLog: Record<string, number> }> = ({ activityLog }) => {
  // Generate last 364 days (52 weeks)
  const today = new Date();
  const endDate = today;
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 364);

  // Align start date to the previous Sunday
  const dayOfWeek = startDate.getDay();
  startDate.setDate(startDate.getDate() - dayOfWeek);

  const weeks = [];
  let currentWeek = [];
  const currentDate = new Date(startDate);

  // We want roughly 53 weeks to cover the full year view including padding
  for (let i = 0; i < 53 * 7; i++) {
     const dateStr = currentDate.toISOString().split('T')[0];
     const count = activityLog[dateStr] || 0;
     
     currentWeek.push({ date: dateStr, count });

     if (currentWeek.length === 7) {
       weeks.push(currentWeek);
       currentWeek = [];
     }
     
     currentDate.setDate(currentDate.getDate() + 1);
  }

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm overflow-hidden">
      <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
         <Calendar className="w-5 h-5 text-slate-400" /> 学习热度
      </h3>
      
      <div className="overflow-x-auto pb-2">
        <div className="min-w-max">
           <div className="flex gap-1">
             {weeks.map((week, wIdx) => (
               <div key={wIdx} className="flex flex-col gap-1">
                 {week.map((day, dIdx) => (
                   <div 
                      key={day.date}
                      title={`${day.date}: 完成 ${day.count} 篇`}
                      className={`w-2.5 h-2.5 rounded-sm ${getActivityColor(day.count)}`}
                   />
                 ))}
               </div>
             ))}
           </div>
           <div className="flex justify-end items-center gap-2 mt-3 text-xs text-slate-400">
              <span>少</span>
              <div className="w-2.5 h-2.5 rounded-sm bg-slate-100"></div>
              <div className="w-2.5 h-2.5 rounded-sm bg-green-200"></div>
              <div className="w-2.5 h-2.5 rounded-sm bg-green-400"></div>
              <div className="w-2.5 h-2.5 rounded-sm bg-green-500"></div>
              <span>多</span>
           </div>
        </div>
      </div>
    </div>
  );
};

export const StatsDashboard: React.FC<StatsDashboardProps> = ({ stats }) => {
  
  const difficultyData = [
    { name: '初级', count: stats.articlesByDifficulty.Beginner || 0, color: '#86efac' },
    { name: '中级', count: stats.articlesByDifficulty.Intermediate || 0, color: '#fde047' },
    { name: '高级', count: stats.articlesByDifficulty.Advanced || 0, color: '#fca5a5' },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-24">
      
      {/* Hero Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-orange-400 to-red-500 rounded-2xl p-4 text-white shadow-lg shadow-orange-200">
          <div className="flex items-center gap-2 opacity-90 mb-1">
            <Flame className="w-5 h-5" />
            <span className="text-sm font-medium">连续打卡</span>
          </div>
          <div className="text-4xl font-bold">{stats.currentStreak} <span className="text-lg font-normal opacity-80">天</span></div>
          <div className="text-xs mt-2 opacity-75">最佳记录: {stats.longestStreak} 天</div>
        </div>

        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 mb-1">
            <Book className="w-5 h-5" />
            <span className="text-sm font-medium">已读文章</span>
          </div>
          <div className="text-4xl font-bold text-slate-800">{stats.totalArticlesCompleted}</div>
          <div className="text-xs text-slate-400 mt-2">累计篇数</div>
        </div>
      </div>

      {/* Heatmap Calendar */}
      <HeatmapCalendar activityLog={stats.activityLog || {}} />

      {/* Difficulty Chart */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <BarChart2Icon /> 难度分布
        </h3>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={difficultyData}>
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
              <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
              <Tooltip 
                cursor={{fill: '#f1f5f9'}}
                contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {difficultyData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Badges Grid */}
      <div>
        <h3 className="text-lg font-bold text-slate-800 mb-4">成就徽章</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {BADGES.map((badge) => {
            const isUnlocked = stats.badges.includes(badge.id);
            return (
              <div 
                key={badge.id} 
                className={`flex flex-col items-center justify-center p-4 rounded-xl text-center border transition-all ${
                    isUnlocked 
                    ? 'bg-white border-indigo-100 shadow-sm' 
                    : 'bg-slate-50 border-slate-100 opacity-60 grayscale'
                }`}
              >
                <div className="text-3xl mb-2 relative">
                    {badge.icon}
                    {!isUnlocked && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Lock className="w-5 h-5 text-slate-400 drop-shadow-md" />
                        </div>
                    )}
                </div>
                <div className="font-semibold text-xs text-slate-800 mb-1">{badge.name}</div>
                <div className="text-[10px] text-slate-500 leading-tight px-1">{badge.description}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const BarChart2Icon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
)