import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const MoodMap = ({ currentCycleDay, cycleInfo }) => {
  const [selectedPhase, setSelectedPhase] = useState(null);
  const [hoveredPhase, setHoveredPhase] = useState(null);

  const phases = [
    {
      name: "Menstrual",
      days: "1-5",
      dayRange: [1, 5],
      color: "#ef4444",
      description: "Red alert - literally. She's on her period.",
      emoji: "🩸",
      tips: [
        "Do the dishes. Like, NOW. Don't wait to be asked.",
        "Get her favorite snacks. Ben & Jerry's never hurt nobody.",
        "Netflix marathon = your best move",
        "No jokes about her being 'emotional' unless you want to die",
        "Heating pad + backrub = you're a goddamn hero",
        "She says she's fine? She's not fine. Bring chocolate."
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
        "Book that fancy restaurant NOW while she's down",
        "She'll actually want to leave the house - capitalize on this",
        "Good time to bring up that thing you've been avoiding",
        "Compliments land HARD right now - use them",
        "Try that new thing in bed she mentioned 3 months ago",
        "She's basically a yes-man right now. Seize the day."
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
        "BRO. This is the sexy time window. Clear your schedule.",
        "She's ovulating = nature's horny button is pressed",
        "Tell her she looks hot. Then tell her again.",
        "Plan something romantic tonight (you know why)",
        "This is when she's most likely to say yes to anything 😏",
        "Whatever you do, DO NOT mess this up with lazy boyfriend energy",
        "Put the phone down. Give her your full attention."
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
        "She wants to organize stuff - let her, don't fight it",
        "Great time for couch time and binge watching",
        "Notice when she cleans/cooks - say thank you like you mean it",
        "Low-key date nights > wild adventures right now",
        "She might get clingy - that's normal, roll with it",
        "Don't plan anything crazy - she wants routine"
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
        "Whatever she says, she's right. I don't care if she's wrong - she's RIGHT.",
        "Is she crying at a dog food commercial? Normal. Just hug her.",
        "Buy tampons BEFORE she asks. You're basically a prophet.",
        "Cancel plans if she's not feeling it. Don't be a hero.",
        "Food delivery apps are your best friend this week",
        "Don't ask 'is it that time of the month?' - that's a death wish",
        "She wants to fight? Brother, you've already lost. Apologize and move on.",
        "Stock up on her favorite junk food like the apocalypse is coming"
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
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full max-w-xl">
              {phases.map((phase) => (
                <button
                  key={phase.name}
                  onClick={() => setSelectedPhase(phase)}
                  className="flex items-center gap-2 p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors"
                >
                  <div 
                    className="w-4 h-4 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: phase.color }}
                  />
                  <div className="text-left">
                    <div className="text-white text-xs font-medium">{phase.name}</div>
                    <div className="text-slate-400 text-xs">Days {phase.days}</div>
                  </div>
                </button>
              ))}
            </div>

            {/* Quick info */}
            <div className="text-center text-slate-400 text-sm mt-4">
              Tap any segment or legend item to see detailed tips
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
                      <span>{tip}</span>
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
