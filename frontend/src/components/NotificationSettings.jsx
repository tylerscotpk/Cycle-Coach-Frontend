import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { LocalStorage } from '../utils/localStorageManager';
import {
  isNotificationsSupported,
  checkNotificationPermission,
  enableNotifications,
  sendTestNotification,
  rescheduleNotifications,
  isNativePlatform,
} from '../utils/notificationService';

const NotificationSettings = () => {
  const [settings, setSettings] = useState(() => {
    const saved = LocalStorage.getNotificationSettings();
    return {
      phaseReminders: saved?.phaseReminders ?? true,
      partnerNudges: saved?.partnerNudges ?? false,
    };
  });
  const [permissionStatus, setPermissionStatus] = useState('loading');
  const [isEnabling, setIsEnabling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isNotificationsSupported()) { setPermissionStatus('unsupported'); return; }
      const perm = await checkNotificationPermission();
      if (!cancelled) setPermissionStatus(perm);
    })();
    return () => { cancelled = true; };
  }, []);

  const handleToggle = async (key) => {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    LocalStorage.saveNotificationSettings(next);
    await rescheduleNotifications();
    toast.success('Notification settings updated');
  };

  const handleEnable = async () => {
    setIsEnabling(true);
    const result = await enableNotifications();
    setIsEnabling(false);
    if (result.success) {
      setPermissionStatus('granted');
      toast.success(result.message);
    } else {
      toast.error(result.message);
      const p = await checkNotificationPermission();
      setPermissionStatus(p);
    }
  };

  const handleTest = async () => {
    const sent = await sendTestNotification();
    if (sent) {
      toast.success(isNativePlatform()
        ? 'Test notification scheduled — check your notification tray'
        : 'Test notification sent!');
    } else {
      toast.error('Enable notifications first.');
    }
  };

  const granted     = permissionStatus === 'granted';
  const prompt      = permissionStatus === 'prompt' || permissionStatus === 'prompt-with-rationale';
  const denied      = permissionStatus === 'denied';
  const unsupported = permissionStatus === 'unsupported';

  return (
    <Card className="bg-slate-800/50 border-slate-700" data-testid="notification-settings-card">
      <CardHeader>
        <CardTitle className="text-white">Notification Preferences</CardTitle>
        <CardDescription className="text-slate-400">
          Get reminders before phase changes so you&apos;re always prepared
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status banners */}
        {unsupported && (
          <div className="bg-orange-500/10 border border-orange-500/30 p-3 rounded-lg" data-testid="notif-unsupported-banner">
            <p className="text-orange-300 text-sm">Notifications are not available on this device.</p>
          </div>
        )}

        {denied && (
          <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-lg" data-testid="notif-denied-banner">
            <p className="text-red-300 text-sm">
              Notifications are blocked. Enable them in your {isNativePlatform() ? 'device' : 'browser'} settings to receive reminders.
            </p>
          </div>
        )}

        {prompt && (
          <div className="bg-cyan-500/10 border border-cyan-500/30 p-3 rounded-lg space-y-3" data-testid="notif-prompt-banner">
            <p className="text-cyan-300 text-sm">Enable notifications to get reminders before phase changes.</p>
            <Button
              onClick={handleEnable}
              disabled={isEnabling}
              className="bg-cyan-500 hover:bg-cyan-600 text-white"
              data-testid="enable-notifications-btn"
            >
              {isEnabling ? 'Enabling...' : 'Enable Notifications'}
            </Button>
          </div>
        )}

        {permissionStatus === 'loading' && (
          <div className="bg-slate-700/50 p-3 rounded-lg animate-pulse">
            <p className="text-slate-400 text-sm">Checking notification status...</p>
          </div>
        )}

        {granted && (
          <div className="bg-green-500/10 border border-green-500/30 p-3 rounded-lg flex items-center justify-between" data-testid="notif-granted-banner">
            <p className="text-green-300 text-sm">Notifications enabled</p>
            <Button
              onClick={handleTest}
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
        <div className="flex items-center justify-between" data-testid="phase-reminders-row">
          <div className="space-y-0.5">
            <Label className="text-white font-medium">Phase Reminders</Label>
            <p className="text-slate-400 text-sm">Get notified the day before a new phase begins</p>
          </div>
          <Switch
            checked={settings.phaseReminders}
            onCheckedChange={() => handleToggle('phaseReminders')}
            className="data-[state=checked]:bg-cyan-500"
            data-testid="toggle-phase-reminders"
          />
        </div>

        {/* Partner Nudges */}
        <div className="flex items-center justify-between" data-testid="partner-nudges-row">
          <div className="space-y-0.5">
            <Label className="text-white font-medium">Partner Nudges</Label>
            <p className="text-slate-400 text-sm">Action tips on the day a new phase starts</p>
          </div>
          <Switch
            checked={settings.partnerNudges}
            onCheckedChange={() => handleToggle('partnerNudges')}
            className="data-[state=checked]:bg-cyan-500"
            data-testid="toggle-partner-nudges"
          />
        </div>

        <div className="pt-4 border-t border-slate-700">
          <p className="text-slate-500 text-xs">
            All notifications are generated locally from your cycle data. No personal data leaves your device.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default NotificationSettings;
