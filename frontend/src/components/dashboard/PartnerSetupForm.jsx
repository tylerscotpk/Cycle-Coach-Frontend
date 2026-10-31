import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';

const PartnerSetupForm = ({ partnerName, setPartnerName, cycleStartDate, setCycleStartDate, onSubmit }) => {
  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-12">
          <div className="flex items-center gap-3">
            <img src="https://customer-assets.emergentagent.com/job_partner-cycle/artifacts/mdtjfodq_Cycle%20Coach%20Circle%20Icon.png" alt="Cycle Coach" className="w-10 h-10 flex-shrink-0 object-contain" />
            <h1 className="text-2xl sm:text-3xl font-bold"><span className="text-white">Cycle</span><span className="text-cyan-400">Coach</span></h1>
          </div>
          <Button
            onClick={() => window.location.href = '/privacy'}
            variant="outline"
            size="sm"
            className="border-slate-600 text-slate-300 hover:bg-slate-700 text-xs sm:text-sm"
          >
            🔒 Privacy
          </Button>
        </div>

        <div className="max-w-2xl mx-auto">
          <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700" data-testid="setup-partner-card">
            <CardHeader>
              <CardTitle className="text-2xl text-white">Alright, Let&apos;s Set This Up</CardTitle>
              <CardDescription className="text-slate-400">Tell us about your girl so we can help you not screw this up</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-6">
                <div>
                  <Label htmlFor="partner-name" className="text-white">Her Name</Label>
                  <Input
                    id="partner-name"
                    data-testid="partner-name-input"
                    value={partnerName}
                    onChange={(e) => setPartnerName(e.target.value)}
                    placeholder="What do you call her?"
                    required
                    className="bg-slate-700/50 border-slate-600 text-white mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="cycle-date" className="text-white">First Day of Her Last Period</Label>
                  <div className="mt-2">
                    <DatePicker
                      value={cycleStartDate}
                      onChange={(val) => setCycleStartDate(val)}
                      max={new Date().toISOString().split('T')[0]}
                      placeholder="Select start date"
                      className="w-full"
                      testId="cycle-start-date-input"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  data-testid="create-partner-button"
                  className="w-full bg-cyan-500 hover:bg-cyan-600 text-white"
                >
                  Create Profile
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PartnerSetupForm;
