import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DatePicker } from '@/components/ui/date-picker';

const formatCycleDate = (dateStr) => {
  try {
    const parts = dateStr.match(/(\d{4})-(\d{2})-(\d{2})|(\d{2})\/(\d{2})\/(\d{4})|(\d{2})-(\d{2})-(\d{4})/);
    if (!parts) return dateStr;
    let year, month, day;
    if (parts[1]) { [, year, month, day] = parts; }
    else if (parts[4]) { [, , , , month, day, year] = parts; }
    else { [, , , , , , , month, day, year] = parts; }
    return new Date(year, month - 1, day).toLocaleDateString();
  } catch { return dateStr; }
};

const CycleHistoryDialog = ({
  open, onOpenChange,
  cycleHistory,
  logPeriodDate, setLogPeriodDate,
  onLogPeriod, onDeleteCycle,
}) => {
  const [dialogEl, setDialogEl] = useState(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent ref={setDialogEl} className="bg-slate-800 border-slate-700 text-white max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Cycle History & Statistics</DialogTitle>
          <DialogDescription className="sr-only">View and manage your cycle history</DialogDescription>
        </DialogHeader>

        {cycleHistory && (
          <div className="space-y-6">
            <div className="grid md:grid-cols-3 gap-4">
              <Card className="bg-white/10 border-white/20">
                <CardContent className="p-4">
                  <div className="text-xs text-slate-300 mb-1">Average Cycle (EWMA)</div>
                  <div className="text-2xl font-bold text-white">{cycleHistory.statistics.ewma_length || cycleHistory.statistics.average_length} days</div>
                  {cycleHistory.statistics.simple_average && cycleHistory.statistics.simple_average !== cycleHistory.statistics.ewma_length && (
                    <div className="text-xs text-slate-400 mt-1">Simple avg: {cycleHistory.statistics.simple_average} days</div>
                  )}
                </CardContent>
              </Card>
              <Card className="bg-white/10 border-white/20">
                <CardContent className="p-4">
                  <div className="text-xs text-slate-300 mb-1">Range</div>
                  <div className="text-2xl font-bold text-white">{cycleHistory.statistics.min_length}-{cycleHistory.statistics.max_length} days</div>
                </CardContent>
              </Card>
              <Card className="bg-white/10 border-white/20">
                <CardContent className="p-4">
                  <div className="text-xs text-slate-300 mb-1">Next Period</div>
                  <div className="text-2xl font-bold text-white">~{cycleHistory.prediction.days_until_next} days</div>
                </CardContent>
              </Card>
            </div>

            {cycleHistory.statistics.is_irregular && (
              <div className="bg-orange-500/20 border border-orange-500/30 p-3 rounded-lg">
                <p className="text-orange-200 text-sm">
                  ⚠️ <strong>Irregular Cycle Detected:</strong> {cycleHistory.statistics.variability} day variation. Keep logging periods for better predictions!
                </p>
              </div>
            )}

            <div className="bg-white/10 p-4 rounded-lg">
              <h4 className="text-white font-semibold mb-3">Log New Period</h4>
              <form onSubmit={onLogPeriod} className="flex gap-2">
                <DatePicker
                  value={logPeriodDate}
                  onChange={(val) => setLogPeriodDate(val)}
                  max={new Date().toISOString().split('T')[0]}
                  placeholder="Select period start"
                  className="flex-1"
                  testId="log-period-date-input"
                  portalContainer={dialogEl}
                />
                <Button
                  type="submit"
                  className="bg-white text-slate-900 hover:bg-white/90"
                  data-testid="log-period-button"
                >
                  Log Period
                </Button>
              </form>
            </div>

            <div className="space-y-2">
              <h4 className="text-white font-semibold mb-2">Recent Cycles</h4>
              {cycleHistory.history.slice(0, 8).map((cycle, idx) => {
                const isCurrent = cycle.status === 'current' && idx === 0;
                return (
                  <div key={idx} className="flex justify-between items-center bg-white/10 p-3 rounded" data-testid={`cycle-history-${idx}`}>
                    <span className="text-slate-200">{formatCycleDate(cycle.cycle_start_date)}</span>
                    <div className="flex items-center gap-3">
                      {isCurrent ? (
                        <span className="text-cyan-400 font-medium">Current</span>
                      ) : cycle.cycle_length && cycle.cycle_length > 0 ? (
                        <span className="text-slate-300">{cycle.cycle_length} days</span>
                      ) : (
                        <span className="text-slate-400 italic">Calculating...</span>
                      )}
                      <Button
                        onClick={() => onDeleteCycle(cycle.id)}
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/20 h-8 w-8 p-0 flex-shrink-0"
                        data-testid={`delete-cycle-${idx}`}
                        title={isCurrent ? "Delete current cycle" : "Delete cycle"}
                      >
                        ×
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CycleHistoryDialog;
