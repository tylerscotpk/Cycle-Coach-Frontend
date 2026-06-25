import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LocalStorage } from '../utils/localStorageManager';
import { recalculateCycleLengths, calculateStatistics } from '../utils/cycleCalculations';

const PhasePredictor = () => {
  const navigate = useNavigate();
  const [predictionDate, setPredictionDate] = useState('');
  const [prediction, setPrediction] = useState(null);
  
  // Get partner profile from localStorage
  const partner = LocalStorage.getPartnerProfile();

  // Phase prediction calculation
  const PHASE_DATA = {
    'Menstrual': { emoji: '🩸', description: 'Low energy; needs rest.' },
    'Follicular': { emoji: '🌸', description: 'Rising energy and clarity.' },
    'Ovulation': { emoji: '🔥', description: 'Peak confidence and libido.' },
    'Early Luteal': { emoji: '🏠', description: 'Calm, nesting energy.' },
    'Late Luteal/PMS': { emoji: '⚠️', description: 'Sensitive; needs patience.' }
  };

  const calculatePrediction = (selectedDate) => {
    if (!partner?.cycleStartDate) {
      return null;
    }

    // Get average cycle length from history or use default
    const history = LocalStorage.getCycleHistory();
    const recalculated = recalculateCycleLengths(history);
    const stats = calculateStatistics(recalculated);
    const avgCycleLength = stats.average_length || partner.cycleLength || 28;

    // Calculate days since last Day 1
    const lastDay1 = new Date(partner.cycleStartDate);
    const selected = new Date(selectedDate);
    lastDay1.setHours(0, 0, 0, 0);
    selected.setHours(0, 0, 0, 0);

    const daysSinceStart = Math.floor((selected - lastDay1) / (1000 * 60 * 60 * 24));

    // Convert to cycle day (handle future and past cycles)
    let cycleDay;
    if (daysSinceStart >= 0) {
      cycleDay = (daysSinceStart % avgCycleLength) + 1;
    } else {
      // For dates before last Day 1, calculate backwards
      const daysBack = Math.abs(daysSinceStart);
      cycleDay = avgCycleLength - ((daysBack - 1) % avgCycleLength);
    }

    // Determine phase based on cycle day
    let phaseName;
    if (cycleDay >= 1 && cycleDay <= 5) {
      phaseName = 'Menstrual';
    } else if (cycleDay >= 6 && cycleDay <= 13) {
      phaseName = 'Follicular';
    } else if (cycleDay >= 14 && cycleDay <= 16) {
      phaseName = 'Ovulation';
    } else if (cycleDay >= 17 && cycleDay <= 23) {
      phaseName = 'Early Luteal';
    } else {
      phaseName = 'Late Luteal/PMS';
    }

    const phaseInfo = PHASE_DATA[phaseName];

    return {
      cycleDay,
      phaseName,
      phaseEmoji: phaseInfo.emoji,
      phaseDescription: phaseInfo.description,
      avgCycleLength
    };
  };

  const handlePredictionDateChange = (date) => {
    setPredictionDate(date);
    if (date) {
      const result = calculatePrediction(date);
      setPrediction(result);
    } else {
      setPrediction(null);
    }
  };

  return (
    <div className="min-h-screen  p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">🔮 Phase Predictor</h1>
            <p className="text-slate-400 mt-1">See what cycle day and phase she&apos;ll be in on any date</p>
          </div>
          <Button
            variant="outline"
            className="border-slate-600 text-slate-300"
            onClick={() => navigate('/')}
            data-testid="back-to-dashboard-btn"
          >
            ← Back
          </Button>
        </div>

        {/* Phase Predictor Card */}
        <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700" data-testid="prediction-card">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              Select a Date
            </CardTitle>
            <CardDescription className="text-slate-400">
              Choose any date to calculate the predicted cycle day and phase
            </CardDescription>
          </CardHeader>
          <CardContent>
            {partner?.cycleStartDate ? (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <Label className="text-slate-300 text-sm mb-2 block">Select a date</Label>
                    <Input
                      type="date"
                      value={predictionDate}
                      onChange={(e) => handlePredictionDateChange(e.target.value)}
                      className="bg-slate-700/50 border-slate-600 text-white"
                      data-testid="prediction-date-input"
                    />
                  </div>
                  {prediction && (
                    <div className="flex-1 flex items-end">
                      <Button
                        variant="outline"
                        className="border-slate-600 text-slate-300"
                        onClick={() => {
                          setPredictionDate('');
                          setPrediction(null);
                        }}
                      >
                        Clear
                      </Button>
                    </div>
                  )}
                </div>

                {prediction && (
                  <div className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/30 rounded-lg p-4" data-testid="prediction-result">
                    <div className="flex items-center gap-4">
                      <div className="text-5xl">{prediction.phaseEmoji}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-3xl font-bold text-white">Day {prediction.cycleDay}</span>
                          <span className="text-lg text-cyan-400 font-medium">{prediction.phaseName}</span>
                        </div>
                        <p className="text-slate-300">{prediction.phaseDescription}</p>
                        <p className="text-slate-500 text-xs mt-2">Based on {prediction.avgCycleLength}-day average cycle</p>
                      </div>
                    </div>
                  </div>
                )}

                {!prediction && predictionDate === '' && (
                  <div className="text-slate-500 text-sm text-center py-4">
                    Pick a date above to see the predicted cycle day and phase
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-6 text-center">
                <p className="text-slate-400">
                  📅 Log your last period start date to unlock predictions.
                </p>
                <Button
                  className="mt-4 bg-cyan-500 hover:bg-cyan-600"
                  onClick={() => navigate('/')}
                >
                  Go to Dashboard
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Phase Reference Card */}
        <Card className="bg-slate-800/30 border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-white text-lg">Phase Reference</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(PHASE_DATA).map(([phase, data]) => (
                <div key={phase} className="flex items-center gap-3 p-2 rounded bg-slate-700/30">
                  <span className="text-2xl">{data.emoji}</span>
                  <div>
                    <p className="text-white font-medium text-sm">{phase}</p>
                    <p className="text-slate-400 text-xs">{data.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PhasePredictor;
