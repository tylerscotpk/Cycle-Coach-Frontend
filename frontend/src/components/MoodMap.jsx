import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const MoodMap = ({ currentCycleDay, cycleInfo }) => {
  const [selectedPhase, setSelectedPhase] = useState(null);
  const [hoveredPhase, setHoveredPhase] = useState(null);

  // Helper to render text with bold markdown
  const renderTipWithBold = (tip) => {
    const parts = tip.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  const phases = [
    {
      name: "Menstrual",
      days: "1-5",
      dayRange: [1, 5],
      color: "#ef4444",
      description: "Red alert - literally. She's on her period.",
      emoji: "🩸",
      tips: [
        "**Do the dishes.** Like, NOW. Don't wait to be asked.",
        "Get her **favorite snacks**. Ben & Jerry's never hurt nobody.",
        "**Netflix marathon** = your best move. Let her pick, even if it's that sad dog movie again.",
        "No jokes about her being 'emotional' unless you want to **sleep on the couch**",
        "**Heating pad + backrub** = you're a goddamn hero. She'll remember this.",
        "She says she's fine? **She's not fine.** Bring chocolate.",
        "Think of yourself as her **emotional support human**. Just be there."
      ]
    },
    {
      name: "Follicular",
      days: "6-13",
      dayRange: [6, 13],
      color: "#22c55e",
      description: "The storm has passed. She's back, baby!",
      emoji: "🌸",
      tips: [
        "**Book that fancy restaurant** NOW while she's saying yes to everything",
        "She'll actually want to **leave the house** - capitalize on this window",
        "Good time to bring up **that thing you've been avoiding** (yes, that thing)",
        "**Compliments land HARD** right now - tell her she looks amazing",
        "Try that **new thing in bed** she mentioned 3 months ago. Trust me.",
        "She's basically a **yes-man** right now. Propose that guys' trip. Do it.",
        "Think 'Happy Wife Life' - **she's in her power phase**, ride the wave"
      ]
    },
    {
      name: "Ovulation",
      days: "14-16",
      dayRange: [14, 16],
      color: "#ec4899",
      description: "🔥 PRIME TIME 🔥 This is it chief",
      emoji: "🔥",
      tips: [
        "**BRO. This is THE window.** Clear your schedule. Cancel your plans. This is go time.",
        "She's ovulating = **nature's horny button is pressed**. Biology is on your side.",
        "Tell her she looks **hot**. Then tell her again. Then one more time.",
        "**Plan something romantic tonight** (you know exactly why)",
        "This is when she's most likely to say **yes to anything** 😏 - make your move",
        "Do NOT, I repeat, **DO NOT** mess this up with **lazy boyfriend energy**",
        "Put the **phone down**. Give her your **FULL attention**. Be present.",
        "Think of it like **playoff mode** - this is your time to shine, champion"
      ]
    },
    {
      name: "Early Luteal",
      days: "17-23",
      dayRange: [17, 23],
      color: "#3b82f6",
      description: "Chill vibes. Enjoy it while it lasts.",
      emoji: "🏠",
      tips: [
        "She's in **nesting mode** - help with home projects without complaining",
        "**Notice when she cleans/cooks** - say thank you like you actually mean it",
        "Low-key **date nights > wild adventures** right now. Keep it cozy.",
        "She might get **Stage 5 Clinger** status - that's normal, lean into it",
        "**Don't plan anything crazy** - she wants routine and predictability",
        "Think **Jim & Pam energy** - comfortable, domestic, wholesome vibes",
        "**Quality time on the couch** > going out. She wants YOU, not a scene."
      ]
    },
    {
      name: "PMS",
      days: "24-28",
      dayRange: [24, 28],
      color: "#f97316",
      description: "⚠️ DEFCON 1 ⚠️ Tread carefully, soldier",
      emoji: "⚠️",
      tips: [
        "Whatever she says, **she's right**. I don't care if she's wrong - **SHE'S RIGHT.**",
        "Is she crying at a **dog food commercial**? Normal. Just hug her. Don't ask questions.",
        "Buy **tampons BEFORE she asks**. You're basically Nostradamus at this point.",
        "**Cancel plans** if she's not feeling it. Don't be a hero. Just. Don't.",
        "**Food delivery apps** are your best friend this week. Use them liberally.",
        "Don't ask **'is it that time of the month?'** - that's a **death wish**, bro",
        "She wants to fight? Brother, **you've already lost**. Apologize and move on.",
        "Stock up on her **favorite junk food** like the apocalypse is coming",
        "Think **Incredible Hulk** - don't poke the bear. Just don't."
      ]
    }
  ];

  const getCurrentPhase = () => {
    if (!currentCycleDay) return null;
    return phases.find(phase => 
      currentCycleDay >= phase.dayRange[0] && currentCycleDay <= phase.dayRange[1]
    );
  };

  const currentPhase = getCurrentPhase();

  // Calculate the angle for each phase segment
  const getPhaseSegment = (index) => {
    const totalDays = 28;
    const phase = phases[index];
    const phaseDays = phase.dayRange[1] - phase.dayRange[0] + 1;
    const startDay = phase.dayRange[0] - 1; // 0-indexed
    
    const startAngle = (startDay / totalDays) * 360 - 90; // Start from top
    const endAngle = ((startDay + phaseDays) / totalDays) * 360 - 90;
    
    return { startAngle, endAngle, phaseDays };
  };

  // Create SVG path for donut segment
  const createArcPath = (startAngle, endAngle, outerRadius, innerRadius) => {
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    
    const x1 = 150 + outerRadius * Math.cos(startRad);
    const y1 = 150 + outerRadius * Math.sin(startRad);
    const x2 = 150 + outerRadius * Math.cos(endRad);
    const y2 = 150 + outerRadius * Math.sin(endRad);
    const x3 = 150 + innerRadius * Math.cos(endRad);
    const y3 = 150 + innerRadius * Math.sin(endRad);
    const x4 = 150 + innerRadius * Math.cos(startRad);
    const y4 = 150 + innerRadius * Math.sin(startRad);
    
    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
    
    return `
      M ${x1} ${y1}
      A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x2} ${y2}
      L ${x3} ${y3}
      A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x4} ${y4}
      Z
    `;
  };

  return (
    <>
      <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700" data-testid="moodmap-card">
        <CardHeader>
          <CardTitle className="text-white text-2xl">MoodMap</CardTitle>
          <CardDescription className="text-slate-400">Your visual guide to the cycle phases</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center">
            {/* Circular Donut Chart */}
            <div className="relative w-full max-w-md mx-auto mb-6">
              <svg viewBox="0 0 300 300" className="w-full h-auto">
                {/* Phase segments */}
                {phases.map((phase, index) => {
                  const { startAngle, endAngle } = getPhaseSegment(index);
                  const isActive = currentPhase?.name === phase.name;
                  const isHovered = hoveredPhase === phase.name;
                  const outerRadius = isHovered ? 145 : isActive ? 140 : 135;
                  const innerRadius = 70;
                  
                  return (
                    <g key={phase.name}>
                      <path
                        d={createArcPath(startAngle, endAngle, outerRadius, innerRadius)}
                        fill={phase.color}
                        fillOpacity={isActive ? 0.9 : isHovered ? 0.7 : 0.5}
                        stroke={isActive ? "#ffffff" : phase.color}
                        strokeWidth={isActive ? 3 : 1}
                        className="cursor-pointer transition-all duration-200"
                        onClick={() => setSelectedPhase(phase)}
                        onMouseEnter={() => setHoveredPhase(phase.name)}
                        onMouseLeave={() => setHoveredPhase(null)}
                        data-testid={`phase-${phase.name.toLowerCase().replace(' ', '-')}`}
                      />
                    </g>
                  );
                })}
                
                {/* Center content */}
                <g>
                  <circle cx="150" cy="150" r="65" fill="#1e293b" />
                  {currentPhase && (
                    <>
                      <text x="150" y="135" textAnchor="middle" fontSize="40">
                        {currentPhase.emoji}
                      </text>
                      <text x="150" y="165" textAnchor="middle" fontSize="16" fill="#ffffff" fontWeight="bold">
                        {currentPhase.name}
                      </text>
                      <text x="150" y="180" textAnchor="middle" fontSize="12" fill="#94a3b8">
                        Day {currentCycleDay}
                      </text>
                    </>
                  )}
                </g>
              </svg>
            </div>

            {/* Legend */}
            <div className="w-full max-w-md space-y-2">
              {phases.map((phase) => (
                <button
                  key={phase.name}
                  onClick={() => setSelectedPhase(phase)}
                  className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors w-full"
                >
                  <div 
                    className="w-4 h-4 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: phase.color }}
                  />
                  <div className="text-white text-sm font-medium">
                    {phase.name}: Days {phase.days}
                  </div>
                </button>
              ))}
            </div>

            {/* Quick info */}
            <div className="text-center text-slate-400 text-sm mt-4">
              Tap any segment or phase to see detailed tips
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Phase Details Dialog */}
      <Dialog open={selectedPhase !== null} onOpenChange={() => setSelectedPhase(null)}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl" data-testid="phase-dialog">
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
                <DialogDescription className="text-slate-300 text-lg mt-4">
                  {selectedPhase.description}
                </DialogDescription>
              </DialogHeader>

              <div className="mt-6">
                <h4 className="text-white font-semibold mb-4 text-lg">Your Game Plan:</h4>
                <ul className="space-y-3">
                  {selectedPhase.tips.map((tip, idx) => (
                    <li key={idx} className="flex gap-3 text-slate-300" data-testid={`dialog-tip-${idx}`}>
                      <span className="text-cyan-400 font-bold">•</span>
                      <span>{renderTipWithBold(tip)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MoodMap;
