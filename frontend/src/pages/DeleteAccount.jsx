import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import InfoNav from '@/components/InfoNav';

const API = process.env.REACT_APP_BACKEND_URL || "";

const DeleteAccount = () => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Please enter your email');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API}/api/account/request-deletion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });

      if (response.ok) {
        setSubmitted(true);
      } else {
        const data = await response.json();
        toast.error(data.detail || 'Failed to submit request. Please try again.');
      }
    } catch (error) {
      toast.error('Failed to submit request. Please email cyclecoach4men@gmail.com directly.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <InfoNav />

      <section className="relative pt-32 pb-16 px-6">
        <div className="relative z-10 max-w-lg mx-auto">
          <h1 className="text-3xl font-bold text-white mb-4" data-testid="delete-account-title">Delete Account &amp; Data</h1>

          {submitted ? (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6" data-testid="deletion-submitted">
              <h2 className="text-green-300 font-semibold text-lg mb-2">Request Received</h2>
              <p className="text-slate-300 text-sm">
                We&apos;ve received your account deletion request. Your account and all associated server-side data will be deleted within 7 business days. You&apos;ll receive a confirmation email when complete.
              </p>
              <p className="text-slate-400 text-xs mt-4">
                To delete data stored on your device, open the app and go to Privacy &amp; Data &gt; Delete All My Data.
              </p>
            </div>
          ) : (
            <>
              <p className="text-slate-400 text-sm mb-6">
                Enter the email address associated with your Cycle Coach account. We&apos;ll delete your account and all server-side data within 7 business days.
              </p>

              <div className="bg-slate-900/80 border border-slate-700/50 rounded-lg p-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">
                      Account Email
                    </label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      required
                      className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                      data-testid="delete-email-input"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-red-600 hover:bg-red-700 text-white"
                    data-testid="delete-submit-btn"
                  >
                    {isSubmitting ? 'Submitting...' : 'Request Account Deletion'}
                  </Button>
                </form>

                <p className="text-slate-500 text-xs mt-4">
                  This will delete your account, subscription records, and any server-side data. Locally stored data on your device is not affected — you can delete that from the app&apos;s Privacy &amp; Data settings.
                </p>
              </div>

              <p className="text-slate-500 text-xs mt-6 text-center">
                You can also email us directly at{' '}
                <a href="mailto:cyclecoach4men@gmail.com" className="text-cyan-400 hover:text-cyan-300">
                  cyclecoach4men@gmail.com
                </a>
              </p>
            </>
          )}
        </div>
      </section>

      <footer className="py-12 px-6 border-t border-slate-800/50 mt-auto">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-slate-500 text-sm">
            &copy; {new Date().getFullYear()} Stars &amp; Honey, LLC. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default DeleteAccount;
