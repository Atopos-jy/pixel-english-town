export function Loading() {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-solid border-indigo-600 border-r-transparent mb-4"></div>
        <p className="text-slate-600 text-lg font-medium">加载中...</p>
      </div>
    </div>
  );
}
