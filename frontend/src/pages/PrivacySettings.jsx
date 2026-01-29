import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LocalStorage } from '../utils/localStorageManager';
import NotificationSettings from '../components/NotificationSettings';
import { toast } from 'sonner';

const PrivacySettings = () => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  const profile = LocalStorage.getPartnerProfile();
  const history = LocalStorage.getCycleHistory();
  const consent = LocalStorage.getConsent();
  const location = LocalStorage.getUserLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
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
            <CardTitle className="text-white">📊 Your Data</CardTitle>
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
              <span>Partner Consent:</span>
              <span className="font-semibold">{consent?.granted ? '✅ Granted' : '❌ Not granted'}</span>
            </div>
            <div className="flex justify-between">
              <span>Location:</span>
              <span className="font-semibold">
                {location?.location === 'us' ? `U.S. - ${location.state}` : 
                 location?.location === 'outside_us' ? 'Outside U.S.' : 'Not set'}
              </span>
            </div>
            {consent?.timestamp && (
              <div className="text-xs text-slate-400 pt-2">
                Consent granted: {new Date(consent.timestamp).toLocaleDateString()}
              </div>
            )}
          </CardContent>
        </Card>

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
