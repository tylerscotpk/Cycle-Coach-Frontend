import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { LocalStorage } from '@/utils/localStorageManager';

// Same supported range enforced by computePhaseBoundaries (cycleCalculations.js)
const MIN_DAYS = 3;
const MAX_DAYS = 7;

export const BleedingDurationControl = ({ onChange }) => {
  const [days, setDays] = useState(() => {
    const v = parseInt(LocalStorage.getCycleSettings().menstrualLength, 10);
    return Number.isFinite(v) ? Math.max(MIN_DAYS, Math.min(MAX_DAYS, v)) : 5;
  });

  const update = (next) => {
    const clamped = Math.max(MIN_DAYS, Math.min(MAX_DAYS, next));
    if (clamped === days) return;
    setDays(clamped);
    // Merge so other saved settings (e.g. luteal estimate) are preserved
    LocalStorage.saveCycleSettings({ ...LocalStorage.getCycleSettings(), menstrualLength: clamped });
    onChange?.(clamped);
  };

  const btn = "w-10 h-10 shrink-0 rounded-full bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="bg-slate-900/60 border border-slate-700 p-4 rounded-lg" data-testid="bleeding-duration-section">
      <h4 className="text-white font-semibold">Typical Bleeding Duration</h4>
      <p className="text-slate-400 text-sm mb-4">How many days does her period usually last?</p>
      <div className="flex items-center justify-center gap-6">
        <button type="button" className={btn} onClick={() => update(days - 1)} disabled={days <= MIN_DAYS}
          aria-label="Decrease bleeding duration" data-testid="bleeding-duration-minus">
          <Minus className="w-5 h-5" />
        </button>
        <span className="text-white text-lg font-semibold min-w-[80px] text-center" aria-live="polite" data-testid="bleeding-duration-value">
          {days} {days === 1 ? 'day' : 'days'}
        </span>
        <button type="button" className={btn} onClick={() => update(days + 1)} disabled={days >= MAX_DAYS}
          aria-label="Increase bleeding duration" data-testid="bleeding-duration-plus">
          <Plus className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
