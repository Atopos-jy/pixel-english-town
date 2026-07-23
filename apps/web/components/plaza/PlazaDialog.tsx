'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

type PlazaDialogProps = {
  title: string;
  children: ReactNode;
  onClose: () => void;
};

export function PlazaDialog({ title, children, onClose }: PlazaDialogProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="absolute inset-0 z-40 grid place-items-center bg-[#172033]/70 p-4"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="plaza-dialog-title"
        className="w-full max-w-2xl border-4 border-slate-900 bg-amber-50 p-4 text-slate-900 shadow-[8px_8px_0_#0b101a] sm:p-6"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-4 border-b-2 border-slate-900 pb-3">
          <h2 id="plaza-dialog-title" className="text-lg font-black sm:text-xl">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={`关闭${title}`}
            className="grid h-9 w-9 place-items-center border-2 border-slate-900 bg-white shadow-[2px_2px_0_#172033] hover:bg-amber-300"
          >
            <X size={20} strokeWidth={3} />
          </button>
        </header>
        <div className="mt-4 max-h-[65vh] overflow-y-auto">{children}</div>
      </section>
    </div>
  );
}
