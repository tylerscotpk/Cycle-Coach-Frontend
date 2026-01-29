import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { LocalStorage } from '../utils/localStorageManager';

const NotificationSettings = () => {
  const [settings, setSettings] = useState({
    phaseReminders: true,
    reflectionPrompts: true,
    ratingPrompts: true
  });

  useEffect(() => {
    const savedSettings = LocalStorage.getNotificationSettings();
    if (savedSettings) {
      setSettings(savedSettings);
    }
  }, []);

  const handleToggle = (key) => {
    const newSettings = {
      ...settings,
      [key]: !settings[key]
    };
    setSettings(newSettings);
    LocalStorage.saveNotificationSettings(newSettings);
    toast.success('Notification settings updated');
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white">Notification Preferences</CardTitle>
        <CardDescription className="text-slate-400">
          Control what notifications you receive from Cycle Coach
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Phase Reminders */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-white font-medium">Phase Reminders</Label>
            <p className="text-slate-400 text-sm">
              Get notified one day before a new phase begins
            </p>
          </div>
          <Switch
            checked={settings.phaseReminders}
            onCheckedChange={() => handleToggle('phaseReminders')}
            className="data-[state=checked]:bg-cyan-500"
            data-testid="toggle-phase-reminders"
          />
        </div>

        {/* Reflection Prompts */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-white font-medium">Reflection Prompts</Label>
            <p className="text-slate-400 text-sm">
              Occasional prompts asking what worked or didn&apos;t work
            </p>
          </div>
          <Switch
            checked={settings.reflectionPrompts}
            onCheckedChange={() => handleToggle('reflectionPrompts')}
            className="data-[state=checked]:bg-cyan-500"
            data-testid="toggle-reflection-prompts"
          />
        </div>

        {/* Rating Prompts */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-white font-medium">Feedback &amp; Ratings</Label>
            <p className="text-slate-400 text-sm">
              Occasional prompts for app ratings and feedback
            </p>
          </div>
          <Switch
            checked={settings.ratingPrompts}
            onCheckedChange={() => handleToggle('ratingPrompts')}
            className="data-[state=checked]:bg-cyan-500"
            data-testid="toggle-rating-prompts"
          />
        </div>

        <div className="pt-4 border-t border-slate-700">
          <p className="text-slate-500 text-xs">
            Note: All notifications are generated locally based on your cycle data. 
            No data is sent to external servers for notifications.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default NotificationSettings;
