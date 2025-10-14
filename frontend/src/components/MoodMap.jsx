import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const MoodMap = ({ currentCycleDay, cycleInfo }) => {
  const [selectedPhase, setSelectedPhase] = useState(null);

  const phases = [
    {
      name: "Menstrual",
      days: "1-5",
      color: "bg-red-500/30 border-red-500 hover:bg-red-500/40",
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
      color: "bg-green-500/30 border-green-500 hover:bg-green-500/40",
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
      color: "bg-pink-500/30 border-pink-500 hover:bg-pink-500/40",
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
      color: "bg-blue-500/30 border-blue-500 hover:bg-blue-500/40",
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
      color: "bg-orange-500/30 border-orange-500 hover:bg-orange-500/40",
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
    if (currentCycleDay >= 1 && currentCycleDay <= 5) return phases[0];
    if (currentCycleDay >= 6 && currentCycleDay <= 13) return phases[1];
    if (currentCycleDay >= 14 && currentCycleDay <= 16) return phases[2];
    if (currentCycleDay >= 17 && currentCycleDay <= 23) return phases[3];
    return phases[4];
  };

  const currentPhase = getCurrentPhase();

  return (
    <>
      <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700" data-testid="moodmap-card">
        <CardHeader>
          <CardTitle className="text-white text-2xl">MoodMap</CardTitle>
          <CardDescription className="text-slate-400">Your visual guide to the cycle phases</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center">
            {/* Circular Layout */}
            <div className="relative w-full max-w-2xl aspect-square flex items-center justify-center mb-8">
              {/* Center indicator */}
              {currentPhase && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-6xl mb-2">{currentPhase.emoji}</div>
                    <div className="text-white font-bold text-xl">{currentPhase.name}</div>
                    <div className="text-slate-400 text-sm">Day {currentCycleDay}</div>
                  </div>
                </div>
              )}

              {/* Phase segments in a circle */}
              <div className="absolute inset-0">
                {phases.map((phase, index) => {
                  const angle = (index * 72) - 90; // 360/5 = 72 degrees per segment, start at top
                  const radian = (angle * Math.PI) / 180;
                  const radius = 45; // percentage
                  const x = 50 + radius * Math.cos(radian);
                  const y = 50 + radius * Math.sin(radian);
                  
                  const isActive = currentPhase?.name === phase.name;

                  return (
                    <button
                      key={phase.name}
                      data-testid={`phase-${phase.name.toLowerCase().replace(' ', '-')}`}
                      onClick={() => setSelectedPhase(phase)}
                      className={`absolute transform -translate-x-1/2 -translate-y-1/2 
                        ${phase.color} border-2 rounded-2xl p-4 
                        transition-all cursor-pointer
                        ${isActive ? 'scale-110 shadow-lg ring-2 ring-white' : 'scale-100'}
                        w-32 h-32 flex flex-col items-center justify-center`}
                      style={{
                        left: `${x}%`,
                        top: `${y}%`,
                      }}
                    >
                      <div className="text-3xl mb-1">{phase.emoji}</div>
                      <div className="text-white font-bold text-sm text-center">{phase.name}</div>
                      <div className="text-xs text-slate-300">Days {phase.days}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick legend */}
            <div className="text-center text-slate-400 text-sm">
              Click any phase to learn more about what to expect
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
