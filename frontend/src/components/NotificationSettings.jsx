import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { LocalStorage } from '../utils/localStorageManager';
import {
  isNotificationsSupported,
  getNotificationPermission,
  enableNotifications,
  sendTestNotification
} from '../utils/notificationService';

const NotificationSettings = () => {
  const [settings, setSettings] = useState(() => {
    // Initialize state from localStorage
    const saved = LocalStorage.getNotificationSettings();
    return saved || {
      phaseReminders: true,
      reflectionPrompts: true,
      ratingPrompts: true
    };
  });
  const [permissionStatus, setPermissionStatus] = useState(() => {
    // Initialize permission status
    if (!isNotificationsSupported()) return 'unsupported';
    return getNotificationPermission();
  });
  const [isEnabling, setIsEnabling] = useState(false);

  const handleToggle = (key) => {
    const newSettings = {
      ...settings,
      [key]: !settings[key]
    };
    setSettings(newSettings);
    LocalStorage.saveNotificationSettings(newSettings);
    toast.success('Notification settings updated');
  };

  const handleEnableNotifications = async () => {
    setIsEnabling(true);
    const result = await enableNotifications();
    setIsEnabling(false);
    
    if (result.success) {
      setPermissionStatus('granted');
      toast.success(result.message);
    } else {
      toast.error(result.message);
      setPermissionStatus(getNotificationPermission());
    }
  };

  const handleTestNotification = () => {
    const sent = sendTestNotification();
    if (sent) {
      toast.success('Test notification sent!');
    } else {
      toast.error('Unable to send test notification. Enable notifications first.');
    }
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
        {/* Permission Status Banner */}
        {permissionStatus === 'unsupported' && (
          <div className="bg-orange-500/10 border border-orange-500/30 p-3 rounded-lg">
            <p className="text-orange-300 text-sm">
              ⚠️ Notifications are not supported on this browser/device.
            </p>
          </div>
        )}
        
        {permissionStatus === 'denied' && (
          <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-lg">
            <p className="text-red-300 text-sm">
              🚫 Notifications are blocked. Enable them in your browser settings to receive reminders.
            </p>
          </div>
        )}
        
        {permissionStatus === 'default' && (
          <div className="bg-cyan-500/10 border border-cyan-500/30 p-3 rounded-lg space-y-3">
            <p className="text-cyan-300 text-sm">
              📱 Enable notifications to get reminders before phase changes and helpful prompts.
            </p>
            <Button
              onClick={handleEnableNotifications}
              disabled={isEnabling}
              className="bg-cyan-500 hover:bg-cyan-600 text-white"
              data-testid="enable-notifications-btn"
            >
              {isEnabling ? 'Enabling...' : 'Enable Notifications'}
            </Button>
          </div>
        )}
        
        {permissionStatus === 'granted' && (
          <div className="bg-green-500/10 border border-green-500/30 p-3 rounded-lg flex items-center justify-between">
            <p className="text-green-300 text-sm">
              ✅ Notifications enabled
            </p>
            <Button
              onClick={handleTestNotification}
              variant="outline"
              size="sm"
              className="border-green-500/30 text-green-300 hover:bg-green-500/20"
              data-testid="test-notification-btn"
            >
              Send Test
            </Button>
          </div>
        )}

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
            All notifications are generated locally based on your cycle data. 
            No data is sent to external servers for notifications.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default NotificationSettings;
