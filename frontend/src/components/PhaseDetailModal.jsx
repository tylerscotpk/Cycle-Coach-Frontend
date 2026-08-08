import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const CollapsibleSection = ({ title, children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const contentRef = useRef(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      setHeight(contentRef.current.scrollHeight);
    }
  }, [children]);

  return (
    <div className="border border-slate-600/50 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 bg-slate-700/40 hover:bg-slate-700/60 transition-colors"
        data-testid={`collapsible-${title.toLowerCase()}`}
      >
        <span className="text-white font-semibold text-sm">{title}</span>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        style={{ maxHeight: isOpen ? `${height}px` : '0px' }}
        className="transition-[max-height] duration-300 ease-in-out overflow-hidden"
      >
        <div ref={contentRef} className="p-3 pt-2">
          {children}
        </div>
      </div>
    </div>
  );
};

const PhaseDetailModal = ({ open, onOpenChange, phase }) => {
  if (!phase) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="phase-detail-dialog">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-3">
            <span className="text-4xl">{phase.emoji}</span>
            <div>
              <div>{phase.name}</div>
              {phase.days && <div className="text-sm text-slate-400 font-normal">Days {phase.days}</div>}
            </div>
          </DialogTitle>
          <DialogDescription className="text-slate-300 text-base mt-3 font-medium italic" data-testid="phase-punchline">
            {phase.punchline}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-5 pb-4">
          <div data-testid="phase-play-by-play">
            <h4 className="text-cyan-400 font-semibold text-sm uppercase tracking-wider mb-2">Play-by-Play</h4>
            <p className="text-slate-300 text-sm leading-relaxed">{phase.playByPlay}</p>
          </div>

          <div data-testid="phase-what-she-feels">
            <h4 className="text-cyan-400 font-semibold text-sm uppercase tracking-wider mb-3">What She Feels</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <h5 className="text-white font-medium text-sm mb-2">Physical</h5>
                <ul className="space-y-1.5">
                  {phase.feelsPhysical.map((item, idx) => (
                    <li key={idx} className="flex gap-2 text-slate-300 text-sm">
                      <span className="text-slate-500 flex-shrink-0">&bull;</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h5 className="text-white font-medium text-sm mb-2">Mental / Emotional</h5>
                <ul className="space-y-1.5">
                  {phase.feelsEmotional.map((item, idx) => (
                    <li key={idx} className="flex gap-2 text-slate-300 text-sm">
                      <span className="text-slate-500 flex-shrink-0">&bull;</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <CollapsibleSection title="Prep">
            <ul className="space-y-2">
              {phase.prep.map((item, idx) => (
                <li key={idx} className="flex gap-2 text-slate-300 text-sm">
                  <span className="text-amber-400 flex-shrink-0">&bull;</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CollapsibleSection>

          <CollapsibleSection title="Action">
            <ul className="space-y-2">
              {phase.action.map((item, idx) => (
                <li key={idx} className="flex gap-2 text-slate-300 text-sm">
                  <span className="text-emerald-400 flex-shrink-0">&bull;</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CollapsibleSection>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PhaseDetailModal;
