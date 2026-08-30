import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LocalStorage } from '../utils/localStorageManager';
import { parseDateLocal, recalculateCycleLengths, calculateStatistics, computePhaseBoundaries } from '../utils/cycleCalculations';
import { PHASE_CONTENT } from '../utils/phaseContent';
import PhaseDetailModal from '../components/PhaseDetailModal';

// Standard 5-phase reference cards derived from shared source
const PHASE_CARDS = [
  { key: 'Menstrual', color: 'from-red-500/20 to-red-600/10 border-red-500/30', content: PHASE_CONTENT['Menstrual'] },
  { key: 'Follicular', color: 'from-green-500/20 to-green-600/10 border-green-500/30', content: PHASE_CONTENT['Follicular'] },
  { key: 'Ovulation', color: 'from-pink-500/20 to-pink-600/10 border-pink-500/30', content: PHASE_CONTENT['Ovulation'] },
  { key: 'Luteal', color: 'from-blue-500/20 to-blue-600/10 border-blue-500/30', content: PHASE_CONTENT['Early Luteal'] },
  { key: 'PMS', color: 'from-orange-500/20 to-orange-600/10 border-orange-500/30', content: PHASE_CONTENT['Late Luteal/PMS'] },
];

// Map internal phase names to standard display names
const PHASE_DISPLAY = {
  'Menstrual': 'Menstrual',
  'Follicular': 'Follicular',
  'Ovulation': 'Ovulation',
  'Early Luteal': 'Luteal',
  'Late Luteal/PMS': 'PMS',
};

const PHASE_COLORS = {
  'Menstrual': 'from-red-500/20 to-red-600/10 border-red-500/30',
  'Follicular': 'from-green-500/20 to-green-600/10 border-green-500/30',
  'Ovulation': 'from-pink-500/20 to-pink-600/10 border-pink-500/30',
  'Early Luteal': 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
  'Late Luteal/PMS': 'from-orange-500/20 to-orange-600/10 border-orange-500/30',
};

const PhasePredictor = () => {
  const navigate = useNavigate();
  const [predictionDate, setPredictionDate] = useState('');
  const [selectedPhaseModal, setSelectedPhaseModal] = useState(null);
  const [cycleSettings, setCycleSettings] = useState(() => LocalStorage.getCycleSettings());
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Compute dynamic phase boundaries for reference cards
  const history = LocalStorage.getCycleHistory();
  const recalculated = recalculateCycleLengths(history);
  const stats = calculateStatistics(recalculated);
  const avgCycleLength = stats.ewma_length || 28;
  const dynamicBoundaries = computePhaseBoundaries(avgCycleLength, cycleSettings.menstrualLength, cycleSettings.lutealConstant);

  // Dynamic reference cards with computed day ranges
  const dynamicPhaseCards = [
    { key: 'Menstrual', color: 'from-red-500/20 to-red-600/10 border-red-500/30', content: { ...PHASE_CONTENT['Menstrual'], days: dynamicBoundaries.ranges.menstrual } },
    { key: 'Follicular', color: 'from-green-500/20 to-green-600/10 border-green-500/30', content: { ...PHASE_CONTENT['Follicular'], days: dynamicBoundaries.ranges.follicular } },
    { key: 'Ovulation', color: 'from-pink-500/20 to-pink-600/10 border-pink-500/30', content: { ...PHASE_CONTENT['Ovulation'], days: dynamicBoundaries.ranges.ovulation } },
    { key: 'Luteal', color: 'from-blue-500/20 to-blue-600/10 border-blue-500/30', content: { ...PHASE_CONTENT['Early Luteal'], days: dynamicBoundaries.ranges.luteal } },
    { key: 'PMS', color: 'from-orange-500/20 to-orange-600/10 border-orange-500/30', content: { ...PHASE_CONTENT['Late Luteal/PMS'], days: dynamicBoundaries.ranges.pms } },
  ];

  const partner = LocalStorage.getPartnerProfile();

  const calculatePrediction = (selectedDate) => {
    if (!partner?.cycleStartDate) return null;

    const lastDay1 = parseDateLocal(partner.cycleStartDate);
    const selected = parseDateLocal(selectedDate);
    lastDay1.setHours(0, 0, 0, 0);
    selected.setHours(0, 0, 0, 0);

    const daysSinceStart = Math.floor((selected - lastDay1) / (1000 * 60 * 60 * 24));

    let cycleDay;
    if (daysSinceStart >= 0) {
      cycleDay = (daysSinceStart % avgCycleLength) + 1;
    } else {
      const daysBack = Math.abs(daysSinceStart);
      cycleDay = avgCycleLength - ((daysBack - 1) % avgCycleLength);
    }

    // Dynamic phase boundaries using clinical model
    const b = computePhaseBoundaries(avgCycleLength, cycleSettings.menstrualLength, cycleSettings.lutealConstant);

    let phaseName;
    if (cycleDay >= 1 && cycleDay <= b.menstrualEnd) {
      phaseName = 'Menstrual';
    } else if (cycleDay > b.menstrualEnd && cycleDay <= b.follicularEnd) {
      phaseName = 'Follicular';
    } else if (cycleDay > b.follicularEnd && cycleDay <= b.ovulationEnd) {
      phaseName = 'Ovulation';
    } else if (cycleDay > b.ovulationEnd && cycleDay <= b.lutealEnd) {
      phaseName = 'Early Luteal';
    } else {
      phaseName = 'Late Luteal/PMS';
    }

    const phaseContent = PHASE_CONTENT[phaseName];
    const formattedDate = new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });

    return {
      cycleDay,
      phaseName,
      displayName: PHASE_DISPLAY[phaseName] || phaseName,
      phaseEmoji: phaseContent.emoji,
      phaseColor: PHASE_COLORS[phaseName],
      phaseSummary: phaseContent.planningTip,
      fullContent: phaseContent,
      avgCycleLength,
      formattedDate,
    };
  };

  // Derive prediction reactively from date + settings
  const prediction = predictionDate ? calculatePrediction(predictionDate) : null;

  const handlePredictionDateChange = (date) => {
    setPredictionDate(date);
  };

  return (
    <div className="min-h-screen p-4 sm:p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Phase Predictor</h1>
          <Button
            variant="outline"
            size="sm"
            className="border-slate-600 text-slate-300 text-xs sm:text-sm"
            onClick={() => navigate('/app')}
            data-testid="back-to-dashboard-btn"
          >
            Back to Dashboard
          </Button>
        </div>

        {/* Intro Copy */}
        <div className="space-y-4">
          <p className="text-slate-300 text-base leading-relaxed">
            Planning a romantic getaway? A big dinner? Finally asking about that guys&apos; trip?
            <br />
            <span className="text-white font-medium">Smart men don&apos;t just pick a date — they pick the right date.</span> That&apos;s what the Phase Predictor is for.
          </p>
          <p className="text-slate-400 text-sm">
            The Phase Predictor uses your partner&apos;s current average cycle to calculate any date you choose. More data in = better intel out.
          </p>
        </div>

        {/* Live Average Cycle Indicator */}
        <div className="flex items-center gap-3 bg-slate-800/60 border border-slate-700/50 rounded-lg px-4 py-3" data-testid="live-average">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
            </span>
            <span className="text-cyan-400 text-xs font-semibold uppercase tracking-wider">Live</span>
          </div>
          <span className="text-white text-sm">
            Current average cycle: <strong className="text-lg">{avgCycleLength} days</strong>
          </span>
          {stats.total_cycles_tracked > 0 && (
            <span className="text-slate-500 text-xs ml-auto">
              Based on {stats.total_cycles_tracked} logged cycle{stats.total_cycles_tracked !== 1 ? 's' : ''}
            </span>
          )}
          {stats.total_cycles_tracked === 0 && (
            <span className="text-amber-400/70 text-xs ml-auto" data-testid="estimate-disclaimer-predictor">
              Estimated using a typical cycle &mdash; accuracy improves as you log more history.
            </span>
          )}
        </div>

        {/* Date Input Card */}
        <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700" data-testid="prediction-card">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              Select a Date
            </CardTitle>
            <CardDescription className="text-slate-400">
              Pick any future (or past) date to see the predicted phase
            </CardDescription>
          </CardHeader>
          <CardContent>
            {partner?.cycleStartDate ? (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <Label className="text-slate-300 text-sm mb-2 block">Date</Label>
                    <Input
                      type="date"
                      value={predictionDate}
                      onChange={(e) => handlePredictionDateChange(e.target.value)}
                      className="bg-slate-700/50 border-slate-600 text-white"
                      data-testid="prediction-date-input"
                    />
                  </div>
                  {prediction && (
                    <div className="flex items-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-slate-600 text-slate-300"
                        onClick={() => setPredictionDate('')}
                      >
                        Clear
                      </Button>
                    </div>
                  )}
                </div>

                {prediction && (
                  <div className={`bg-gradient-to-r ${prediction.phaseColor} border rounded-xl p-5`} data-testid="prediction-result">
                    <div className="flex items-start gap-4">
                      <div className="text-5xl flex-shrink-0 mt-1">{prediction.phaseEmoji}</div>
                      <div className="flex-1 space-y-3">
                        <p className="text-slate-200 text-sm leading-relaxed" data-testid="prediction-sentence">
                          According to her current <strong className="text-white">{prediction.avgCycleLength}-day</strong> average cycle, on{' '}
                          <strong className="text-white">{prediction.formattedDate}</strong> she&apos;ll be in the{' '}
                          <strong className="text-white">{prediction.displayName}</strong> phase — <strong className="text-white">Day {prediction.cycleDay}</strong>.
                        </p>
                        <div className="bg-slate-900/40 rounded-lg p-3">
                          <p className="text-xs text-slate-400 mb-1 font-semibold uppercase tracking-wider">Translation</p>
                          <p className="text-slate-200 text-sm">{prediction.phaseSummary}</p>
                        </div>
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
                  Log your partner&apos;s last period start date to unlock predictions.
                </p>
                <Button
                  className="mt-4 bg-cyan-500 hover:bg-cyan-600"
                  onClick={() => navigate('/app')}
                >
                  Go to Dashboard
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Advanced Cycle Settings */}
        <Card className="bg-slate-800/30 border-slate-700/50">
          <CardHeader className="cursor-pointer" onClick={() => setShowAdvanced(!showAdvanced)}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white text-lg">Advanced Settings</CardTitle>
              <svg className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${showAdvanced ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <CardDescription className="text-slate-500 text-xs">
              Avg cycle: {avgCycleLength}d &middot; Period: {cycleSettings.menstrualLength}d &middot; Luteal: {cycleSettings.lutealConstant}d
            </CardDescription>
          </CardHeader>
          {showAdvanced && (
            <CardContent className="space-y-4">
              <div>
                <Label className="text-slate-300 text-sm">Period Length (days)</Label>
                <p className="text-slate-500 text-xs mb-2">Average number of days your partner bleeds</p>
                <Input
                  type="number"
                  min={3}
                  max={7}
                  value={cycleSettings.menstrualLength}
                  onChange={(e) => {
                    const v = Math.max(3, Math.min(7, parseInt(e.target.value) || 5));
                    const updated = { ...cycleSettings, menstrualLength: v };
                    setCycleSettings(updated);
                    LocalStorage.saveCycleSettings(updated);
                  }}
                  className="bg-slate-700 border-slate-600 text-white w-24"
                  data-testid="setting-menstrual-length"
                />
              </div>
              <div>
                <Label className="text-slate-300 text-sm">Luteal Phase Length (days)</Label>
                <p className="text-slate-500 text-xs mb-2">Post-ovulation to next period. Default 14. Only change if confirmed via BBT or OPK tracking.</p>
                <Input
                  type="number"
                  min={11}
                  max={16}
                  value={cycleSettings.lutealConstant}
                  onChange={(e) => {
                    const v = Math.max(11, Math.min(16, parseInt(e.target.value) || 14));
                    const updated = { ...cycleSettings, lutealConstant: v };
                    setCycleSettings(updated);
                    LocalStorage.saveCycleSettings(updated);
                  }}
                  className="bg-slate-700 border-slate-600 text-white w-24"
                  data-testid="setting-luteal-constant"
                />
              </div>
              <p className="text-slate-600 text-xs">Changes apply immediately to all phase calculations.</p>
            </CardContent>
          )}
        </Card>

        {/* Phase Reference Cards */}
        <Card className="bg-slate-800/30 border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-white text-lg">Phase Reference</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {dynamicPhaseCards.map((card) => (
                <button
                  key={card.key}
                  onClick={() => setSelectedPhaseModal(card.content)}
                  className={`flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r ${card.color} border text-left transition-all hover:scale-[1.02] hover:brightness-110 cursor-pointer`}
                  data-testid={`phase-ref-${card.key.toLowerCase()}`}
                >
                  <span className="text-2xl flex-shrink-0">{card.content.emoji}</span>
                  <div>
                    <p className="text-white font-medium text-sm">{card.key}</p>
                    <p className="text-slate-300 text-xs">{card.content.cardTagline}</p>
                    <p className="text-slate-500 text-[10px]">Days {card.content.days}</p>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Phase Detail Modal — shared component */}
        <PhaseDetailModal
          open={!!selectedPhaseModal}
          onOpenChange={(open) => { if (!open) setSelectedPhaseModal(null); }}
          phase={selectedPhaseModal}
        />
      </div>
    </div>
  );
};

export default PhasePredictor;
