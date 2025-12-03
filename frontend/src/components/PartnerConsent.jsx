import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LocalStorage } from '../utils/localStorageManager';

const PartnerConsent = ({ onConsentGranted }) => {
  const [understood, setUnderstood] = useState(false);
  const [hasConsent, setHasConsent] = useState(false);

  const handleSubmit = () => {
    if (understood && hasConsent) {
      LocalStorage.saveConsent(true);
      onConsentGranted();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
      <Card className="max-w-3xl w-full bg-slate-800/90 backdrop-blur-sm border-slate-700">
        <CardHeader>
          <CardTitle className="text-3xl text-white flex items-center gap-3">
            <span className="text-4xl">⚠️</span>
            Partner Consent Required
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-orange-500/10 border-2 border-orange-500/50 rounded-lg p-6 space-y-4">
            <h3 className="text-xl font-bold text-orange-300">
              Before You Continue: Important Privacy & Consent Information
            </h3>
            
            <div className="space-y-3 text-slate-300 text-sm leading-relaxed">
              <p className="font-semibold text-orange-200">
                This app tracks sensitive reproductive health data. You MUST have your partner's explicit consent.
              </p>
              
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>
                  <strong className="text-white">Get Partner Consent:</strong> Your partner MUST know and agree to you tracking their cycle. Tracking without consent is a violation of privacy and trust.
                </li>
                <li>
                  <strong className="text-white">Privacy Mode:</strong> All data is stored ONLY on YOUR device. We never see it, and it never leaves your browser.
                </li>
                <li>
                  <strong className="text-white">No Account Needed:</strong> No login, no tracking, no server-side storage. Your data stays with you.
                </li>
                <li>
                  <strong className="text-white">Legal Risks:</strong> In some regions, reproductive health data can be used as evidence. While your data stays local, be aware of the legal landscape.
                </li>
                <li>
                  <strong className="text-white">AI Usage:</strong> If you use the AI Wingman, messages are sent anonymously to OpenAI. Don't share identifying details in chat.
                </li>
              </ul>
            </div>
          </div>

          <div className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={understood}
                onChange={(e) => setUnderstood(e.target.checked)}
                className="mt-1 w-5 h-5 cursor-pointer"
              />
              <span className="text-slate-300 group-hover:text-white transition-colors">
                I understand that all data will be stored locally on my device and that I am responsible for backing it up if needed.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={hasConsent}
                onChange={(e) => setHasConsent(e.target.checked)}
                className="mt-1 w-5 h-5 cursor-pointer"
              />
              <span className="text-slate-300 group-hover:text-white transition-colors">
                <strong className="text-orange-300">I confirm that I have discussed this app with my partner and have their explicit consent to track their cycle data.</strong>
              </span>
            </label>
          </div>

          <div className="pt-4">
            <Button
              onClick={handleSubmit}
              disabled={!understood || !hasConsent}
              className="w-full bg-cyan-500 hover:bg-cyan-600 text-white py-6 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              I Understand and Have Consent - Continue
            </Button>
          </div>

          <div className="text-center text-xs text-slate-500">
            By continuing, you acknowledge these responsibilities and agree to use this app ethically and legally.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PartnerConsent;
