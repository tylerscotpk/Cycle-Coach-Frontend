import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const API = process.env.REACT_APP_BACKEND_URL || "";

const AccountSettings = () => {
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  useEffect(() => {
    loadSubscriptionData();
  }, []);

  const loadSubscriptionData = async () => {
    try {
      const sessionToken = localStorage.getItem('session_token');
      if (!sessionToken) {
        navigate('/login');
        return;
      }

      const response = await fetch(`${API}/api/account/subscription`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });

      if (!response.ok) {
        if (response.status === 401) {
          navigate('/login');
          return;
        }
        throw new Error('Failed to load subscription');
      }

      const data = await response.json();
      setSubscription(data);
    } catch (error) {
      console.error('Error loading subscription:', error);
      toast.error('Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    setCancelling(true);
    try {
      const sessionToken = localStorage.getItem('session_token');
      const response = await fetch(`${API}/api/account/cancel-subscription`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setSubscription(prev => ({
          ...prev,
          subscription_status: 'cancelling',
          cancels_at: result.cancels_at
        }));
        setShowCancelModal(false);
        toast.success('Subscription cancelled. You have access until ' + formatDate(result.cancels_at));
      } else {
        toast.error(result.detail || result.message || 'Failed to cancel subscription');
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
      'annual': 'Full Season Strategy',
      'yearly': 'Full Season Strategy',
      'lifetime': 'Lifetime Access',
      'grandfathered': 'Lifetime Access (Grandfathered)',
      'basic': 'Basic',
      'premium': 'Premium'
    };
    return names[tier] || tier || 'Unknown';
  };

  const getTierBadgeColor = (tier) => {
    const colors = {
      'monthly': 'bg-green-500/20 text-green-400 border-green-500/30',
      'quarterly': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      'annual': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'yearly': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'lifetime': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      'grandfathered': 'bg-purple-500/20 text-purple-400 border-purple-500/30'
    };
    return colors[tier] || 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  };

  const getBillingAmount = (tier) => {
    const prices = {
      'monthly': '$3',
      'quarterly': '$8',
      'annual': '$30',
      'yearly': '$30',
      'lifetime': 'Paid in full',
      'grandfathered': 'Free'
    };
    return prices[tier] || 'N/A';
  };

  const getBillingCycle = (tier) => {
    const cycles = {
      'monthly': 'per month',
      'quarterly': 'every 3 months',
      'annual': 'per year',
      'yearly': 'per year',
      'lifetime': '',
      'grandfathered': ''
    };
    return cycles[tier] || '';
  };

  const isCancelling = subscription?.subscription_status === 'cancelling';

  const canCancel = () => {
    return (
      subscription?.stripe_subscription_id &&
      subscription?.subscription_status === 'active' &&
      !['lifetime', 'grandfathered'].includes(subscription?.subscription_tier)
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen  flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen  p-4 sm:p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-white" data-testid="account-settings-title">Account Settings</h1>
            <p className="text-slate-400 mt-1 text-sm sm:text-base">Manage your subscription and account</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-slate-600 text-slate-300 text-xs sm:text-sm"
            onClick={() => navigate('/app')}
            data-testid="back-to-dashboard-btn"
          >
            Back to Dashboard
          </Button>
        </div>

        {/* Subscription Status Card */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex flex-wrap items-center gap-2" data-testid="subscription-status-title">
              Subscription Status
              {subscription?.subscription_tier && (
                <span className={`px-3 py-1 rounded-full text-xs sm:text-sm border ${getTierBadgeColor(subscription.subscription_tier)}`}>
                  {getTierDisplayName(subscription.subscription_tier)}
                </span>
              )}
            </CardTitle>
            <CardDescription className="text-slate-400">
              Your current plan and billing information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-900/50 rounded-lg p-4">
                <p className="text-slate-400 text-sm">Status</p>
                <p className="text-white font-medium mt-1" data-testid="subscription-status-value">
                  {isCancelling ? (
                    <span className="text-orange-400">Cancels {formatDate(subscription?.cancels_at)}</span>
                  ) : subscription?.subscription_status === 'active' ? (
                    <span className="text-green-400">Active</span>
                  ) : (
                    <span className="text-slate-400">{subscription?.subscription_status || 'None'}</span>
                  )}
                </p>
              </div>
              
              <div className="bg-slate-900/50 rounded-lg p-4">
                <p className="text-slate-400 text-sm">Member Since</p>
                <p className="text-white font-medium mt-1">
                  {formatDate(subscription?.created_at)}
                </p>
              </div>

              {subscription?.email && (
                <div className="bg-slate-900/50 rounded-lg p-4 col-span-2">
                  <p className="text-slate-400 text-sm">Account Email</p>
                  <p className="text-white font-medium mt-1" data-testid="account-email">{subscription.email}</p>
                </div>
              )}

              {subscription?.subscription_tier && !['lifetime', 'grandfathered'].includes(subscription.subscription_tier) && (
                <>
                  <div className="bg-slate-900/50 rounded-lg p-4">
                    <p className="text-slate-400 text-sm">
                      {isCancelling ? 'Access Ends' : 'Billing Amount'}
                    </p>
                    <p className="text-white font-medium mt-1">
                      {isCancelling ? (
                        <span className="text-orange-400">{formatDate(subscription?.cancels_at)}</span>
                      ) : (
                        <>
                          <span className="text-2xl text-cyan-400">{getBillingAmount(subscription.subscription_tier)}</span>
                          {getBillingCycle(subscription.subscription_tier) && (
                            <span className="text-slate-400 text-sm ml-1">{getBillingCycle(subscription.subscription_tier)}</span>
                          )}
                        </>
                      )}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Cancellation Notice */}
            {isCancelling && (
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4" data-testid="cancellation-notice">
                <p className="text-orange-400 font-medium">Subscription Cancelled</p>
                <p className="text-orange-300/80 text-sm mt-1">
                  Your subscription will end on {formatDate(subscription.cancels_at)}. 
                  You will continue to have full access until then.
                </p>
              </div>
            )}

            {/* Cancel Button */}
            {canCancel() && (
              <div className="pt-4 border-t border-slate-700">
                <Button
                  onClick={() => setShowCancelModal(true)}
                  disabled={cancelling}
                  variant="outline"
                  className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
                  data-testid="cancel-subscription-btn"
                >
                  Cancel Subscription
                </Button>
                <p className="text-slate-500 text-xs mt-2">
                  You&apos;ll keep access until your current billing period ends.
                </p>
              </div>
            )}

            {/* No subscription */}
            {!subscription?.subscription_status && (
              <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-4">
                <p className="text-slate-400 text-sm">
                  No active subscription. <a href="/pricing" className="text-cyan-400 hover:text-cyan-300">Choose a plan</a> to get started.
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
              {['Cycle Tracking & Phase Detection', 'MoodMap Visualizer', 'Phase-Based Tips & Insights', 'Research-Backed Resources', 'Partner Profile & Preferences', 'AI Wingman (Personalized Advice)', 'Push Notifications'].map((feature) => (
                <li key={feature} className="flex items-center gap-3 text-white">
                  <span className="text-green-400">&#10003;</span>
                  {feature}
                </li>
              ))}
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
              Privacy & Data Settings
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start border-slate-600 text-slate-300 hover:bg-slate-700"
              onClick={() => navigate('/contact')}
              data-testid="contact-link"
            >
              Contact Support
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start border-slate-600 text-slate-300 hover:bg-slate-700"
              onClick={() => navigate('/app')}
              data-testid="dashboard-link"
            >
              Back to Dashboard
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start border-red-800/50 text-red-400 hover:bg-red-900/30 hover:text-red-300"
              onClick={async () => {
                try {
                  const sessionToken = localStorage.getItem('session_token');
                  await fetch(`${API}/api/auth/logout`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${sessionToken}` }
                  });
                } catch (e) { /* ignore */ }
                localStorage.removeItem('session_token');
                localStorage.removeItem('user');
                window.location.href = '/login';
              }}
              data-testid="logout-btn"
            >
              Log Out
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Cancel Subscription Modal */}
      <AlertDialog open={showCancelModal} onOpenChange={setShowCancelModal}>
        <AlertDialogContent className="bg-slate-800 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white text-xl">
              Cancel Your Subscription?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-300 space-y-3">
              <p>
                Are you sure you want to cancel your <span className="text-cyan-400 font-medium">{getTierDisplayName(subscription?.subscription_tier)}</span> subscription?
              </p>
              <div className="bg-slate-900/50 rounded-lg p-4 mt-4">
                <p className="text-slate-400 text-sm mb-2">What happens when you cancel:</p>
                <ul className="text-slate-300 text-sm space-y-1">
                  <li>You&apos;ll keep full access until your billing period ends</li>
                  <li>No more charges after your current period</li>
                  <li>You can resubscribe anytime</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel 
              className="bg-slate-700 text-white border-slate-600 hover:bg-slate-600"
              data-testid="cancel-modal-keep-btn"
            >
              Keep My Subscription
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelSubscription}
              disabled={cancelling}
              className="bg-red-600 text-white hover:bg-red-700"
              data-testid="cancel-modal-confirm-btn"
            >
              {cancelling ? 'Cancelling...' : 'Yes, Cancel Subscription'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AccountSettings;
