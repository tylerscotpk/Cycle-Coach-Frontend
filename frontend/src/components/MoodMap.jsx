import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PHASE_CONTENT } from '@/utils/phaseContent';

// Collapsible section with smooth animation
const CollapsibleSection = ({ title, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
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

const MoodMap = ({ currentCycleDay, cycleInfo }) => {
  const [selectedPhase, setSelectedPhase] = useState(null);
  const [hoveredPhase, setHoveredPhase] = useState(null);
  const [showMismatchTooltip, setShowMismatchTooltip] = useState(false);

  const phases = [
    { name: "Menstrual", num: 1, days: "1\u20135", dayRange: [1, 5], color: "#dc2626", colorLight: "#ef4444", iconType: "drop", ...PHASE_CONTENT["Menstrual"] },
    { name: "Follicular", num: 2, days: "6\u201313", dayRange: [6, 13], color: "#16a34a", colorLight: "#22c55e", iconType: "flower", ...PHASE_CONTENT["Follicular"] },
    { name: "Ovulation", num: 3, days: "14\u201316", dayRange: [14, 16], color: "#db2777", colorLight: "#ec4899", iconType: "flame", ...PHASE_CONTENT["Ovulation"] },
    { name: "Luteal", num: 4, days: "17\u201323", dayRange: [17, 23], color: "#2563eb", colorLight: "#3b82f6", iconType: "house", ...PHASE_CONTENT["Early Luteal"] },
    { name: "PMS", num: 5, days: "24\u201328", dayRange: [24, 28], color: "#ea580c", colorLight: "#f97316", iconType: "droplet", ...PHASE_CONTENT["Late Luteal/PMS"] },
  ];

  // One-time tooltip for phase mismatch
  useEffect(() => {
    if (!cycleInfo || !currentCycleDay) return;
    const storageKey = 'cyclecoach_mismatch_tooltip_shown';
    const uid = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}').id || ''; } catch { return ''; } })();
    const sk = uid ? `${storageKey}_${uid}` : storageKey;
    const lastAvg = localStorage.getItem(uid ? `cyclecoach_mismatch_tooltip_avg_${uid}` : 'cyclecoach_mismatch_tooltip_avg');
    const alreadyShown = localStorage.getItem(sk) === 'true';
    const staticPhase = phases.find(p => currentCycleDay >= p.dayRange[0] && currentCycleDay <= p.dayRange[1]);
    const predictedPhase = cycleInfo?.phase;
    const hasMismatch = staticPhase && predictedPhase &&
      !predictedPhase.toLowerCase().startsWith(staticPhase.name.toLowerCase().replace('pms', 'late luteal'));
    const currentAvg = localStorage.getItem(uid ? `cyclecoach_last_ewma_avg_${uid}` : 'cyclecoach_last_ewma_avg') || '28';
    if (hasMismatch && (!alreadyShown || lastAvg !== currentAvg)) {
      setShowMismatchTooltip(true);
    }
  }, [cycleInfo, currentCycleDay]);

  const getCurrentPhase = () => {
    if (!currentCycleDay) return null;
    return phases.find(phase =>
      currentCycleDay >= phase.dayRange[0] && currentCycleDay <= phase.dayRange[1]
    );
  };

  const currentPhase = getCurrentPhase();
  const CX = 200;
  const CY = 200;
  const OUTER_R = 155;
  const INNER_R = 80;
  const TOTAL_DAYS = 28;

  const getSegmentAngles = (phase) => {
    const startDay = phase.dayRange[0] - 1;
    const endDay = phase.dayRange[1];
    const startAngle = (startDay / TOTAL_DAYS) * 360 - 90;
    const endAngle = (endDay / TOTAL_DAYS) * 360 - 90;
    return { startAngle, endAngle };
  };

  const polarToXY = (angle, radius) => {
    const rad = (angle * Math.PI) / 180;
    return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
  };

  const createArc = (startAngle, endAngle, outerR, innerR) => {
    const s1 = polarToXY(startAngle, outerR);
    const e1 = polarToXY(endAngle, outerR);
    const s2 = polarToXY(endAngle, innerR);
    const e2 = polarToXY(startAngle, innerR);
    const large = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${s1.x} ${s1.y} A ${outerR} ${outerR} 0 ${large} 1 ${e1.x} ${e1.y} L ${s2.x} ${s2.y} A ${innerR} ${innerR} 0 ${large} 0 ${e2.x} ${e2.y} Z`;
  };

  // SVG icon components — updated: PMS=droplet, Follicular=flower, Ovulation=flame
  const PhaseIcon = ({ type, x, y, size = 24 }) => {
    const s = size;
    const hs = s / 2;
    switch (type) {
      case 'drop': // Menstrual — water drop
        return (
          <path d={`M ${x} ${y - hs} C ${x - hs * 0.7} ${y - hs * 0.1} ${x - hs} ${y + hs * 0.3} ${x} ${y + hs} C ${x + hs} ${y + hs * 0.3} ${x + hs * 0.7} ${y - hs * 0.1} ${x} ${y - hs} Z`}
            fill="none" stroke="white" strokeWidth="1.8" />
        );
      case 'flower': // Follicular — flower with petals
        return (
          <g>
            {[0, 72, 144, 216, 288].map((angle, i) => {
              const rad = (angle * Math.PI) / 180;
              const px = x + Math.cos(rad) * hs * 0.55;
              const py = y + Math.sin(rad) * hs * 0.55;
              return <ellipse key={i} cx={px} cy={py} rx={hs * 0.35} ry={hs * 0.55}
                transform={`rotate(${angle} ${px} ${py})`}
                fill="none" stroke="white" strokeWidth="1.5" />;
            })}
            <circle cx={x} cy={y} r={hs * 0.25} fill="white" opacity="0.9" />
          </g>
        );
      case 'flame': // Ovulation — flame
        return (
          <path d={`M ${x} ${y + hs} C ${x - hs * 0.6} ${y + hs * 0.2} ${x - hs * 0.7} ${y - hs * 0.3} ${x - hs * 0.15} ${y - hs * 0.7} C ${x - hs * 0.3} ${y - hs * 0.1} ${x - hs * 0.1} ${y + hs * 0.1} ${x} ${y - hs} C ${x + hs * 0.1} ${y + hs * 0.1} ${x + hs * 0.3} ${y - hs * 0.1} ${x + hs * 0.15} ${y - hs * 0.7} C ${x + hs * 0.7} ${y - hs * 0.3} ${x + hs * 0.6} ${y + hs * 0.2} ${x} ${y + hs} Z`}
            fill="none" stroke="white" strokeWidth="1.8" />
        );
      case 'house': // Luteal — house
        return (
          <g transform={`translate(${x - hs}, ${y - hs})`}>
            <path d={`M ${s * 0.5} ${s * 0.15} L ${s * 0.1} ${s * 0.5} L ${s * 0.25} ${s * 0.5} L ${s * 0.25} ${s * 0.85} L ${s * 0.75} ${s * 0.85} L ${s * 0.75} ${s * 0.5} L ${s * 0.9} ${s * 0.5} Z`}
              fill="none" stroke="white" strokeWidth="1.8" strokeLinejoin="round" />
            <rect x={s * 0.4} y={s * 0.55} width={s * 0.2} height={s * 0.3} fill="none" stroke="white" strokeWidth="1.5" />
          </g>
        );
      case 'droplet': // PMS — single droplet
        return (
          <path d={`M ${x} ${y - hs * 0.9} Q ${x + hs * 0.65} ${y + hs * 0.15} ${x} ${y + hs * 0.9} Q ${x - hs * 0.65} ${y + hs * 0.15} ${x} ${y - hs * 0.9} Z`}
            fill="none" stroke="white" strokeWidth="1.8" />
        );
      default:
        return null;
    }
  };

  const dashedRingR = OUTER_R + 18;

  return (
    <>
      <Card className="bg-slate-900/80 backdrop-blur-sm border-slate-700/50" data-testid="moodmap-card">
        <CardHeader>
          <CardTitle className="text-white text-2xl font-bold tracking-tight">MoodMap</CardTitle>
          <CardDescription className="text-slate-400">Your visual guide to the cycle phases</CardDescription>
          <p className="text-slate-500 text-xs mt-1 italic" data-testid="moodmap-info-note">
            Your girl isn&apos;t a robot, bro — cycles shift. Phase timing can vary, especially near the edges.
          </p>
        </CardHeader>
        <CardContent>
          {showMismatchTooltip && (
            <div className="bg-amber-500/15 border border-amber-500/40 rounded-lg p-3 mb-4 relative" data-testid="mismatch-tooltip">
              <button
                onClick={() => {
                  setShowMismatchTooltip(false);
                  const uid2 = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}').id || ''; } catch { return ''; } })();
                  localStorage.setItem(uid2 ? `cyclecoach_mismatch_tooltip_shown_${uid2}` : 'cyclecoach_mismatch_tooltip_shown', 'true');
                  const avg = localStorage.getItem(uid2 ? `cyclecoach_last_ewma_avg_${uid2}` : 'cyclecoach_last_ewma_avg') || '28';
                  localStorage.setItem(uid2 ? `cyclecoach_mismatch_tooltip_avg_${uid2}` : 'cyclecoach_mismatch_tooltip_avg', avg);
                }}
                className="absolute top-2 right-2 text-amber-400/60 hover:text-amber-300 text-sm"
                data-testid="dismiss-mismatch-tooltip"
              >
                ✕
              </button>
              <p className="text-amber-200 text-xs pr-4">
                Heads up, bro — shorter cycles can shift phases earlier. Totally normal. Cycle Coach adjusts based on real data, not wishful thinking.
              </p>
            </div>
          )}

          <div className="flex flex-col items-center">
            <div className="relative w-full max-w-md mx-auto mb-6">
              <svg viewBox="0 0 400 400" className="w-full h-auto">
                <defs>
                  {phases.map((phase, i) => (
                    <radialGradient key={`rg-${i}`} id={`rg-${i}`} cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor={phase.colorLight} stopOpacity="0.9" />
                      <stop offset="100%" stopColor={phase.color} stopOpacity="1" />
                    </radialGradient>
                  ))}
                  <marker id="arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#22d3ee" fillOpacity="0.6" />
                  </marker>
                </defs>

                {/* Outer dashed tactical ring */}
                <circle cx={CX} cy={CY} r={dashedRingR} fill="none" stroke="#334155" strokeWidth="1.5"
                  strokeDasharray="8 6" opacity="0.5" />

                {/* Directional arrow arcs */}
                {[45, 135, 225, 315].map((angle, i) => {
                  const a1 = angle - 20;
                  const a2 = angle + 20;
                  const r = dashedRingR;
                  const p1 = polarToXY(a1, r);
                  const p2 = polarToXY(a2, r);
                  return (
                    <path key={`arr-${i}`}
                      d={`M ${p1.x} ${p1.y} A ${r} ${r} 0 0 1 ${p2.x} ${p2.y}`}
                      fill="none" stroke="#22d3ee" strokeWidth="2" opacity="0.5"
                      markerEnd="url(#arrow)" />
                  );
                })}

                {/* Phase segments — icons only, no text/numbers on wheel */}
                {phases.map((phase, index) => {
                  const { startAngle, endAngle } = getSegmentAngles(phase);
                  const isActive = currentPhase?.name === phase.name;
                  const isHovered = hoveredPhase === phase.name;
                  const outerR = isHovered ? OUTER_R + 6 : isActive ? OUTER_R + 3 : OUTER_R;

                  const midAngle = (startAngle + endAngle) / 2;
                  const iconR = (outerR + INNER_R) / 2;
                  const iconPos = polarToXY(midAngle, iconR);

                  // Boundary line
                  const bStart = polarToXY(startAngle, INNER_R);
                  const bEnd = polarToXY(startAngle, outerR + 1);

                  // Hover tooltip position (just outside the segment)
                  const tooltipR = outerR + 22;
                  const tooltipPos = polarToXY(midAngle, tooltipR);

                  return (
                    <g key={phase.name}
                      className="cursor-pointer"
                      onClick={() => setSelectedPhase(phase)}
                      onMouseEnter={() => setHoveredPhase(phase.name)}
                      onMouseLeave={() => setHoveredPhase(null)}
                      data-testid={`phase-${phase.name.toLowerCase().replace(' ', '-')}`}
                    >
                      {/* Segment */}
                      <path
                        d={createArc(startAngle, endAngle, outerR, INNER_R)}
                        fill={`url(#rg-${index})`}
                        fillOpacity={isActive ? 1 : isHovered ? 0.95 : 0.85}
                        stroke={isActive ? "#ffffff" : "#0f172a"}
                        strokeWidth={isActive ? 3 : 3}
                        className="transition-all duration-200"
                      />

                      {/* Boundary divider */}
                      <line x1={bStart.x} y1={bStart.y} x2={bEnd.x} y2={bEnd.y}
                        stroke="#0f172a" strokeWidth="3.5" />

                      {/* Emoji icon on wheel */}
                      <text x={iconPos.x} y={iconPos.y + 2}
                        textAnchor="middle" dominantBaseline="middle"
                        fontSize="26" className="pointer-events-none">
                        {phase.emoji}
                      </text>

                      {/* Desktop hover tooltip */}
                      {isHovered && (
                        <g className="pointer-events-none hidden md:block">
                          <rect
                            x={tooltipPos.x - 40} y={tooltipPos.y - 12}
                            width="80" height="24" rx="6"
                            fill="#0f172a" fillOpacity="0.9" stroke="#334155" strokeWidth="1"
                          />
                          <text x={tooltipPos.x} y={tooltipPos.y + 2}
                            textAnchor="middle" dominantBaseline="middle"
                            fill="white" fontSize="11" fontWeight="600" fontFamily="system-ui, sans-serif">
                            {phase.name}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}

                {/* Center hub */}
                <circle cx={CX} cy={CY} r={INNER_R - 2} fill="#0f172a" stroke="#22d3ee" strokeWidth="2.5" />

                {/* Center shield + chart icon */}
                <g transform={`translate(${CX - 22}, ${CY - 26})`}>
                  <path d="M 22 2 L 6 10 L 6 24 C 6 34 14 40 22 44 C 30 40 38 34 38 24 L 38 10 Z"
                    fill="#0f172a" stroke="#22d3ee" strokeWidth="2" />
                  <rect x="13" y="28" width="4" height="8" fill="#22d3ee" rx="1" />
                  <rect x="19" y="22" width="4" height="14" fill="#22d3ee" rx="1" />
                  <rect x="25" y="16" width="4" height="20" fill="#22d3ee" rx="1" />
                  <polyline points="14,20 22,12 30,20" fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </g>

                {currentPhase && (
                  <text x={CX} y={CY + 30} textAnchor="middle" fill="#94a3b8" fontSize="10"
                    fontFamily="system-ui, sans-serif" className="pointer-events-none">
                    Day {currentCycleDay}
                  </text>
                )}
              </svg>
            </div>

            {/* Legend — first-letter capitalization */}
            <div className="w-full max-w-md space-y-2">
              {phases.map((phase) => {
                const isCurrentPhase = currentPhase?.name === phase.name;
                return (
                  <button
                    key={phase.name}
                    onClick={() => setSelectedPhase(phase)}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-colors w-full ${
                      isCurrentPhase
                        ? 'bg-slate-700/80 ring-2 ring-white/30 hover:bg-slate-600'
                        : 'bg-slate-800/60 hover:bg-slate-700/60'
                    }`}
                  >
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0 ring-1 ring-white/20"
                      style={{ backgroundColor: phase.color }}
                    />
                    <div className={`text-sm font-semibold ${isCurrentPhase ? 'text-white' : 'text-slate-300'}`}>
                      {phase.name}: Days {phase.days}
                    </div>
                    {isCurrentPhase && (
                      <span className="ml-auto text-xs text-cyan-400 font-bold uppercase tracking-wider">Active</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="text-center text-slate-500 text-sm mt-4">
              Tap any segment or phase to see detailed tips
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Phase Details Dialog — new structured layout */}
      <Dialog open={selectedPhase !== null} onOpenChange={() => setSelectedPhase(null)}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="phase-dialog">
          {selectedPhase && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl flex items-center gap-3">
                  <span className="text-4xl">{selectedPhase.emoji}</span>
                  <div>
                    <div>{selectedPhase.name}</div>
                    <div className="text-sm text-slate-400 font-normal">Days {selectedPhase.days}</div>
                  </div>
                </DialogTitle>
                <DialogDescription className="text-slate-300 text-base mt-3 font-medium italic" data-testid="phase-punchline">
                  {selectedPhase.punchline}
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 space-y-5 pb-4">
                {/* Play-by-Play */}
                <div data-testid="phase-play-by-play">
                  <h4 className="text-cyan-400 font-semibold text-sm uppercase tracking-wider mb-2">Play-by-Play</h4>
                  <p className="text-slate-300 text-sm leading-relaxed">{selectedPhase.playByPlay}</p>
                </div>

                {/* What She Feels */}
                <div data-testid="phase-what-she-feels">
                  <h4 className="text-cyan-400 font-semibold text-sm uppercase tracking-wider mb-3">What She Feels</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <h5 className="text-white font-medium text-sm mb-2">Physical</h5>
                      <ul className="space-y-1.5">
                        {selectedPhase.feelsPhysical.map((item, idx) => (
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
                        {selectedPhase.feelsEmotional.map((item, idx) => (
                          <li key={idx} className="flex gap-2 text-slate-300 text-sm">
                            <span className="text-slate-500 flex-shrink-0">&bull;</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Prep — collapsible */}
                <CollapsibleSection title="Prep" data-testid="phase-prep">
                  <ul className="space-y-2">
                    {selectedPhase.prep.map((item, idx) => (
                      <li key={idx} className="flex gap-2 text-slate-300 text-sm">
                        <span className="text-amber-400 flex-shrink-0">&bull;</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CollapsibleSection>

                {/* Action — collapsible */}
                <CollapsibleSection title="Action" data-testid="phase-action">
                  <ul className="space-y-2">
                    {selectedPhase.action.map((item, idx) => (
                      <li key={idx} className="flex gap-2 text-slate-300 text-sm">
                        <span className="text-emerald-400 flex-shrink-0">&bull;</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CollapsibleSection>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MoodMap;
