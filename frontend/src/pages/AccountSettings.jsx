import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { LocalStorage } from '../utils/localStorageManager';

const API = process.env.REACT_APP_BACKEND_URL;

const AccountSettings = () => {
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    loadSubscriptionData();
  }, []);

  const loadSubscriptionData = () => {
    try {
      const tierData = LocalStorage.getSubscriptionTier();
      const licenseData = LocalStorage.getLicenseKey();
      
      setSubscription({
        tier: tierData?.tier || 'unknown',
        email: tierData?.email || licenseData?.email || null,
        customerId: tierData?.customer_id || null,
        subscriptionId: tierData?.subscription_id || null,
        expiresAt: tierData?.expires_at || null,
        cancelsAt: tierData?.cancels_at || null,
        isCancelled: tierData?.is_cancelled || false,
        activatedAt: licenseData?.activatedAt || null
      });
    } catch (error) {
      console.error('Error loading subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscription?.customerId || !subscription?.subscriptionId) {
      toast.error('Unable to cancel: Missing subscription information');
      return;
    }

    const confirmed = window.confirm(
      'Are you sure you want to cancel your subscription?\n\n' +
      'You will keep access to all features until your current billing period ends.'
    );

    if (!confirmed) return;

    setCancelling(true);
    try {
      const response = await fetch(`${API}/api/cancel-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: subscription.customerId,
          subscriptionId: subscription.subscriptionId
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Update local storage with cancellation info
        const tierData = LocalStorage.getSubscriptionTier();
        LocalStorage.saveSubscriptionTier({
          ...tierData,
          cancels_at: result.cancels_at,
          is_cancelled: true
        });

        // Update local state
        setSubscription(prev => ({
          ...prev,
          cancelsAt: result.cancels_at,
          isCancelled: true
        }));

        toast.success('Subscription cancelled. You have access until ' + formatDate(result.cancels_at));
      } else {
        toast.error(result.message || 'Failed to cancel subscription');
      }
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      toast.error('Failed to cancel subscription. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getTierDisplayName = (tier) => {
    const names = {
      'monthly': 'Monthly Training Plan',
      'quarterly': 'Quarter by Quarter',
      'yearly': 'Full Season Strategy',
      'lifetime': 'Lifetime Access',
      'grandfathered': 'Lifetime Access (Grandfathered)',
      'free_trial': 'Free Trial',
      'premium': 'Premium',
      'basic': 'Basic'
    };
    return names[tier] || tier || 'Unknown';
  };

  const getTierBadgeColor = (tier) => {
    const colors = {
      'monthly': 'bg-green-500/20 text-green-400 border-green-500/30',
      'quarterly': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      'yearly': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'lifetime': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      'grandfathered': 'bg-purple-500/20 text-purple-400 border-purple-500/30'
    };
    return colors[tier] || 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  };

  const canCancel = () => {
    // Can cancel if: has subscription IDs, not already cancelled, and not lifetime/grandfathered
    return (
      subscription?.customerId &&
      subscription?.subscriptionId &&
      !subscription?.isCancelled &&
      !['lifetime', 'grandfathered'].includes(subscription?.tier)
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Account Settings</h1>
            <p className="text-slate-400 mt-1">Manage your subscription and account</p>
          </div>
          <Button
            variant="outline"
            className="border-slate-600 text-slate-300"
            onClick={() => navigate('/')}
            data-testid="back-to-dashboard-btn"
          >
            ← Back to Dashboard
          </Button>
        </div>

        {/* Subscription Status Card */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-3">
              Subscription Status
              <span className={`px-3 py-1 rounded-full text-sm border ${getTierBadgeColor(subscription?.tier)}`}>
                {getTierDisplayName(subscription?.tier)}
              </span>
            </CardTitle>
            <CardDescription className="text-slate-400">
              Your current plan and billing information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900/50 rounded-lg p-4">
                <p className="text-slate-400 text-sm">Status</p>
                <p className="text-white font-medium mt-1">
                  {subscription?.isCancelled ? (
                    <span className="text-orange-400">Cancels on {formatDate(subscription?.cancelsAt)}</span>
                  ) : (
                    <span className="text-green-400">Active</span>
                  )}
                </p>
              </div>
              
              <div className="bg-slate-900/50 rounded-lg p-4">
                <p className="text-slate-400 text-sm">Member Since</p>
                <p className="text-white font-medium mt-1">
                  {formatDate(subscription?.activatedAt)}
                </p>
              </div>

              {subscription?.email && (
                <div className="bg-slate-900/50 rounded-lg p-4 col-span-2">
                  <p className="text-slate-400 text-sm">Account Email</p>
                  <p className="text-white font-medium mt-1">{subscription.email}</p>
                </div>
              )}

              {subscription?.expiresAt && !subscription?.isCancelled && (
                <div className="bg-slate-900/50 rounded-lg p-4 col-span-2">
                  <p className="text-slate-400 text-sm">Next Billing Date</p>
                  <p className="text-white font-medium mt-1">{formatDate(subscription.expiresAt)}</p>
                </div>
              )}
            </div>

            {/* Cancellation Notice */}
            {subscription?.isCancelled && (
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                <p className="text-orange-400 font-medium">Subscription Cancelled</p>
                <p className="text-orange-300/80 text-sm mt-1">
                  Your subscription will end on {formatDate(subscription.cancelsAt)}. 
                  You will continue to have full access to all features until then.
                </p>
              </div>
            )}

            {/* Lifetime/Grandfathered Notice */}
            {['lifetime', 'grandfathered'].includes(subscription?.tier) && (
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                <p className="text-purple-400 font-medium">🎉 Lifetime Access</p>
                <p className="text-purple-300/80 text-sm mt-1">
                  You have lifetime access to all Cycle Coach features. No billing, no expiration.
                </p>
              </div>
            )}

            {/* Cancel Button */}
            {canCancel() && (
              <div className="pt-4 border-t border-slate-700">
                <Button
                  onClick={handleCancelSubscription}
                  disabled={cancelling}
                  variant="outline"
                  className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
                  data-testid="cancel-subscription-btn"
                >
                  {cancelling ? 'Cancelling...' : 'Cancel Subscription'}
                </Button>
                <p className="text-slate-500 text-xs mt-2">
                  You&apos;ll keep access until your current billing period ends.
                </p>
              </div>
            )}

            {/* No subscription IDs - show message */}
            {!subscription?.customerId && !['lifetime', 'grandfathered'].includes(subscription?.tier) && (
              <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-4">
                <p className="text-slate-400 text-sm">
                  To manage your subscription billing, please contact support or manage it through your Stripe account.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Features Card */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Your Features</CardTitle>
            <CardDescription className="text-slate-400">
              What&apos;s included in your plan
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <li className="flex items-center gap-3 text-white">
                <span className="text-green-400">✓</span>
                Cycle Tracking & Phase Detection
              </li>
              <li className="flex items-center gap-3 text-white">
                <span className="text-green-400">✓</span>
                MoodMap Visualizer
              </li>
              <li className="flex items-center gap-3 text-white">
                <span className="text-green-400">✓</span>
                Phase-Based Tips & Insights
              </li>
              <li className="flex items-center gap-3 text-white">
                <span className="text-green-400">✓</span>
                Research-Backed Resources
              </li>
              <li className="flex items-center gap-3 text-white">
                <span className="text-green-400">✓</span>
                Partner Profile & Preferences
              </li>
              <li className="flex items-center gap-3 text-white">
                <span className="text-green-400">✓</span>
                AI Wingman (Personalized Advice)
              </li>
              <li className="flex items-center gap-3 text-white">
                <span className="text-green-400">✓</span>
                Push Notifications
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Quick Links */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Quick Links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start border-slate-600 text-slate-300 hover:bg-slate-700"
              onClick={() => navigate('/privacy')}
              data-testid="privacy-settings-link"
            >
              🔒 Privacy & Data Settings
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start border-slate-600 text-slate-300 hover:bg-slate-700"
              onClick={() => navigate('/contact')}
              data-testid="contact-link"
            >
              ✉️ Contact Support
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start border-slate-600 text-slate-300 hover:bg-slate-700"
              onClick={() => navigate('/')}
              data-testid="dashboard-link"
            >
              📊 Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AccountSettings;
