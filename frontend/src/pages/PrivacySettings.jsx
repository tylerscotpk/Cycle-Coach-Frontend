import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LocalStorage } from '../utils/localStorageManager';
import NotificationSettings from '../components/NotificationSettings';
import { toast } from 'sonner';

const PrivacySettings = () => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showConsentConfirm, setShowConsentConfirm] = useState(false);
  const [showConsentRevoke, setShowConsentRevoke] = useState(false);
  const [consentState, setConsentState] = useState(() => LocalStorage.getConsent());

  const handleExport = () => {
    try {
      const data = LocalStorage.exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cycle-coach-backup-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Data exported successfully!');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export data');
    }
  };

  const handleImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        LocalStorage.importData(data);
        toast.success('Data imported successfully!');
        setTimeout(() => window.location.reload(), 1000);
      } catch (error) {
        console.error('Import failed:', error);
        toast.error('Failed to import data - invalid file format');
      }
    };
    reader.readAsText(file);
  };

  const handleClearAll = () => {
    if (showDeleteConfirm) {
      LocalStorage.clearAllData();
      toast.success('All data deleted');
      setTimeout(() => window.location.href = '/', 1000);
    } else {
      setShowDeleteConfirm(true);
      setTimeout(() => setShowDeleteConfirm(false), 5000);
    }
  };

  const handleConfirmConsent = () => {
    LocalStorage.saveConsent(true);
    setConsentState(LocalStorage.getConsent());
    setShowConsentConfirm(false);
    toast.success('Partner consent confirmed');
  };

  const handleRevokeConsent = () => {
    LocalStorage.saveConsent(false);
    setConsentState(LocalStorage.getConsent());
    setShowConsentRevoke(false);
    toast.success('Consent revoked');
  };

  const profile = LocalStorage.getPartnerProfile();
  const history = LocalStorage.getCycleHistory();
  const location = LocalStorage.getUserLocation();

  return (
    <div className="min-h-screen  p-4 sm:p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Privacy &amp; Data</h1>
          <p className="text-slate-400">Complete control over your data</p>
        </div>

        {/* Privacy Status */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">🔒 Privacy Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-lg space-y-2">
              <p className="text-green-300 font-semibold">✅ Maximum Privacy Enabled</p>
              <ul className="text-slate-300 text-sm space-y-1 ml-4">
                <li>• All data stored ONLY on this device</li>
                <li>• No server, no account, no tracking</li>
                <li>• No one else can access your data</li>
                <li>• You have complete control</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <NotificationSettings />

        {/* Data Summary */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Your Data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-slate-300">
            <div className="flex justify-between">
              <span>Partner Profile:</span>
              <span className="font-semibold">{profile ? 'Created' : 'Not created'}</span>
            </div>
            <div className="flex justify-between">
              <span>Cycle Entries:</span>
              <span className="font-semibold">{history?.length || 0} entries</span>
            </div>
            <div className="flex justify-between">
              <span>Location:</span>
              <span className="font-semibold">
                {location?.location === 'us' ? `U.S. - ${location.state}` : 
                 location?.location === 'outside_us' ? 'Outside U.S.' : 'Not set'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Partner Consent Management */}
        <Card className="bg-slate-800/50 border-slate-700" data-testid="consent-management-card">
          <CardHeader>
            <CardTitle className="text-white">Partner Consent</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* State: Not recorded (null — deleted or never set) */}
            {!consentState && (
              <div className="space-y-3" data-testid="consent-not-recorded">
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-start gap-2">
                  <span className="text-amber-400 text-lg leading-none mt-0.5">⚠️</span>
                  <div>
                    <p className="text-amber-300 font-medium text-sm">Not recorded</p>
                    <p className="text-amber-300/70 text-xs mt-1">
                      No consent confirmation is currently stored on this device.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => setShowConsentConfirm(true)}
                  className="bg-cyan-500 hover:bg-cyan-600 text-white w-full"
                  data-testid="confirm-consent-btn"
                >
                  Confirm Partner Consent
                </Button>
              </div>
            )}

            {/* State: Explicitly revoked */}
            {consentState && consentState.granted === false && (
              <div className="space-y-3" data-testid="consent-revoked">
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
                  <span className="text-red-400 text-lg leading-none mt-0.5">❌</span>
                  <div>
                    <p className="text-red-300 font-medium text-sm">Revoked</p>
                    <p className="text-red-300/70 text-xs mt-1">
                      Consent was revoked{consentState.revokedAt ? ` on ${new Date(consentState.revokedAt).toLocaleDateString()}` : ''}.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => setShowConsentConfirm(true)}
                  variant="outline"
                  className="border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 w-full"
                  data-testid="reconfirm-consent-btn"
                >
                  Re-confirm Consent
                </Button>
              </div>
            )}

            {/* State: Granted */}
            {consentState?.granted === true && (
              <div className="space-y-3" data-testid="consent-granted">
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 flex items-start gap-2">
                  <span className="text-green-400 text-lg leading-none mt-0.5">✅</span>
                  <div>
                    <p className="text-green-300 font-medium text-sm">Granted</p>
                    <p className="text-green-300/70 text-xs mt-1">
                      Confirmed{consentState.timestamp ? ` on ${new Date(consentState.timestamp).toLocaleDateString()}` : ''}.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => setShowConsentRevoke(true)}
                  variant="outline"
                  size="sm"
                  className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                  data-testid="revoke-consent-btn"
                >
                  Revoke Consent
                </Button>
              </div>
            )}

            <p className="text-slate-500 text-xs pt-1">
              This records whether your partner has given you consent to track their cycle information on this device.
            </p>
          </CardContent>
        </Card>

        {/* Confirm Consent Dialog */}
        <Dialog open={showConsentConfirm} onOpenChange={setShowConsentConfirm}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
            <DialogHeader>
              <DialogTitle className="text-white">Confirm Partner Consent</DialogTitle>
              <DialogDescription className="text-slate-400">
                Please confirm that you have your partner&apos;s knowledge and consent.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <p className="text-slate-300 text-sm">
                By confirming, you attest that your partner is aware you are using Cycle Coach 
                to track their menstrual cycle and has given you consent to do so.
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={handleConfirmConsent}
                  className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white"
                  data-testid="dialog-confirm-consent-btn"
                >
                  I Have My Partner&apos;s Consent
                </Button>
                <Button
                  variant="outline"
                  className="border-slate-600 text-slate-300"
                  onClick={() => setShowConsentConfirm(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Revoke Consent Dialog */}
        <Dialog open={showConsentRevoke} onOpenChange={setShowConsentRevoke}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
            <DialogHeader>
              <DialogTitle className="text-white">Revoke Consent</DialogTitle>
              <DialogDescription className="text-slate-400">
                This will record that partner consent has been withdrawn.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <p className="text-slate-300 text-sm">
                If your partner has withdrawn their consent for cycle tracking, 
                you can record that here. You can re-confirm consent later from 
                Privacy Settings if it is granted again.
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={handleRevokeConsent}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                  data-testid="dialog-revoke-consent-btn"
                >
                  Revoke Consent
                </Button>
                <Button
                  variant="outline"
                  className="border-slate-600 text-slate-300"
                  onClick={() => setShowConsentRevoke(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Data Management */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">🛠️ Data Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Button
                onClick={handleExport}
                className="w-full bg-cyan-500 hover:bg-cyan-600 text-white py-6"
              >
                📥 Export My Data (Backup)
              </Button>
              <p className="text-xs text-slate-400 mt-2">
                Download all your data as a JSON file. Keep it safe!
              </p>
            </div>

            <div>
              <label className="block">
                <Button
                  as="span"
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white py-6 cursor-pointer"
                >
                  📤 Import Data (Restore)
                </Button>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
              </label>
              <p className="text-xs text-slate-400 mt-2">
                Restore data from a previous export
              </p>
            </div>

            <div className="pt-4 border-t border-slate-700">
              <Button
                onClick={handleClearAll}
                className={`w-full py-6 ${
                  showDeleteConfirm
                    ? 'bg-red-600 hover:bg-red-700 animate-pulse'
                    : 'bg-red-500/50 hover:bg-red-500'
                } text-white`}
              >
                {showDeleteConfirm ? '⚠️ CLICK AGAIN TO CONFIRM DELETE' : '🗑️ Delete All My Data'}
              </Button>
              <p className="text-xs text-slate-400 mt-2">
                {showDeleteConfirm
                  ? 'This cannot be undone! Click again to confirm.'
                  : 'Permanently delete all data from this device'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Info */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">ℹ️ How It Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-300">
            <div>
              <h4 className="font-semibold text-white mb-2">What's stored locally:</h4>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Partner cycle dates and history</li>
                <li>Preferences you've entered</li>
                <li>Partner consent record</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-2">What's NOT stored:</h4>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Your identity or any personal info</li>
                <li>AI chat history (ephemeral only)</li>
                <li>Anything on a server</li>
              </ul>
            </div>

            <div className="bg-orange-500/10 border border-orange-500/30 p-3 rounded">
              <p className="text-orange-200 text-xs">
                <strong>⚠️ Important:</strong> If you clear your browser data, all information will be lost. 
                Export regularly to keep a backup!
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="text-center pt-4">
          <Button
            onClick={() => window.location.href = '/'}
            variant="ghost"
            className="text-slate-400 hover:text-white"
          >
            ← Back to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PrivacySettings;
