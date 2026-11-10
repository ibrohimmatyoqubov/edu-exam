/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { subscribeLoading } from '../../services/mongoService';

interface InlineSpinnerProps {
  className?: string;
}

export const InlineSpinner: React.FC<InlineSpinnerProps> = ({ className = 'w-4 h-4' }) => {
  return <Loader2 className={`animate-spin shrink-0 ${className}`} />;
};

interface PageLoaderProps {
  text?: string;
  subtext?: string;
  compact?: boolean;
}

export const PageLoader: React.FC<PageLoaderProps> = ({
  text = "Ma'lumotlar yuklanmoqda...",
  subtext = 'Iltimos, bir necha soniya kuting',
  compact = false,
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact
          ? 'py-10 px-4'
          : 'min-h-[320px] bg-white/80 dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-xs'
      }`}
    >
      <div className="relative flex items-center justify-center w-16 h-16 mb-4">
        <span className="absolute inset-0 rounded-2xl bg-indigo-500/15 dark:bg-indigo-400/15 animate-ping" />
        <span className="absolute inset-0 rounded-2xl border-2 border-indigo-200 dark:border-indigo-900 border-t-indigo-600 dark:border-t-indigo-400 animate-spin" />
        <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
          <ShieldCheck className="w-5 h-5" />
        </div>
      </div>
      <p className="text-sm font-bold text-slate-900 dark:text-white">{text}</p>
      {subtext && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subtext}</p>
      )}
    </div>
  );
};

export const GlobalLoaderBar: React.FC = () => {
  const [activeCount, setActiveCount] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    return subscribeLoading(setActiveCount);
  }, []);

  useEffect(() => {
    if (activeCount > 0) {
      setVisible(true);
      return;
    }
    const timer = window.setTimeout(() => {
      setVisible(false);
    }, 260);
    return () => window.clearTimeout(timer);
  }, [activeCount]);

  if (!visible && activeCount <= 0) return null;

  return (
    <>
      {/* Top thin animated bar */}
      <div className="fixed top-0 left-0 right-0 z-[100] h-1 bg-indigo-100/80 dark:bg-slate-800/80 overflow-hidden pointer-events-none">
        <div className="h-full w-1/2 bg-gradient-to-r from-indigo-500 via-emerald-500 to-indigo-600 animate-[loading-slide_1s_ease-in-out_infinite]" />
      </div>

      {/* Subtle corner badge during requests */}
      <div className="fixed bottom-4 right-4 z-[95] pointer-events-none animate-in fade-in duration-150">
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/90 dark:bg-slate-800/95 text-white text-xs font-bold shadow-lg border border-slate-700/60 backdrop-blur-sm">
          <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
          <span>Yuklanmoqda...</span>
        </div>
      </div>
    </>
  );
};
