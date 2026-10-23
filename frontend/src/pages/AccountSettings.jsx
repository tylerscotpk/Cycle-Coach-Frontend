import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { LocalStorage } from '../utils/localStorageManager';
import { redirectToCheckout, checkoutSuccessUrl } from '../utils/checkout';
import { UndoCancellationSection } from '@/components/account/UndoCancellationSection';
import { DeleteAccountSection } from '@/components/account/DeleteAccountSection';
import {
  AlertDialog,
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
  const [showDowngradeModal, setShowDowngradeModal] = useState(false);
  const [downgrading, setDowngrading] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

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

      // 1. Attempt the cancellation
      let cancelOk = false;
      try {
        const response = await fetch(`${API}/api/account/cancel-subscription`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${sessionToken}` }
        });
        let result;
        try { result = await response.json(); } catch { result = {}; }
        cancelOk = response.ok && result.success;
        if (!cancelOk && !response.ok) {
          // Definitive server error — don't bother re-fetching
          setShowCancelModal(false);
          toast.error(result.detail || result.message || 'Failed to cancel subscription');
          setCancelling(false);
          return;
        }
      } catch {
        // Network error / timeout — cancellation may or may not have succeeded
        // Fall through to verification step
      }

      // 2. Verify authoritative state regardless of cancel response
      try {
        const subResp = await fetch(`${API}/api/account/subscription`, {
          headers: { 'Authorization': `Bearer ${sessionToken}` }
        });
        if (subResp.ok) {
          const subData = await subResp.json();
          if (subData.subscription_status === 'cancelling' && subData.cancels_at) {
            // Cancellation confirmed
            setSubscription(prev => ({ ...prev, ...subData }));
            setShowCancelModal(false);
            toast.success('Subscription cancelled. You have access until ' + formatDate(subData.cancels_at));
            setCancelling(false);
            return;
          }
        }
      } catch { /* verification fetch failed */ }

      // 3. If we reach here: cancel request said OK but verification couldn't confirm
      if (cancelOk) {
        // Cancel API returned success but re-fetch didn't confirm yet (propagation delay)
        setSubscription(prev => ({ ...prev, subscription_status: 'cancelling' }));
        setShowCancelModal(false);
        toast.success('Cancellation processing. Refresh in a moment to see the updated status.');
      } else {
        setShowCancelModal(false);
        toast.error('Could not confirm cancellation. Please refresh and check your subscription status.');
      }
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      setShowCancelModal(false);
      toast.error('Failed to cancel subscription. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  const handleDowngrade = async () => {
    setDowngrading(true);
    try {
      const sessionToken = localStorage.getItem('session_token');
      const response = await fetch(`${API}/api/subscription/downgrade`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sessionToken}` },
      });
      let result;
      try {
        result = await response.json();
      } catch {
        result = {};
      }
      if (response.ok && result.success) {
        // Keep advanced locally — user retains access until period end
        setSubscription(prev => ({
          ...prev,
          downgrade_at_period_end: true,
          downgrade_to: 'basic',
          downgrade_date: result.effective_date,
        }));
        setShowDowngradeModal(false);
        const effectiveDate = result.effective_date
          ? formatDate(result.effective_date)
          : 'the end of your current billing period';
        toast.success(`Downgrade scheduled. You'll keep Advanced access until ${effectiveDate}.`);
        // Update localStorage — keep tier as advanced
        try {
          const user = JSON.parse(localStorage.getItem('user') || '{}');
          user.downgrade_at_period_end = true;
          user.downgrade_to = 'basic';
          user.downgrade_date = result.effective_date;
          localStorage.setItem('user', JSON.stringify(user));
        } catch { /* ignore localStorage error */ }
      } else {
        toast.error(result.detail || 'Failed to downgrade. Please try again.');
      }
    } catch (error) {
      console.error('Error downgrading:', error);
      toast.error('Failed to downgrade. Please try again.');
    } finally {
      setDowngrading(false);
    }
  };

  const handleUpgradeToAdvanced = async () => {
    setUpgrading(true);
    try {
      const sessionToken = localStorage.getItem('session_token');
      let useCheckout = !subscription?.stripe_subscription_id;

      if (!useCheckout) {
        const res = await fetch(`${API}/api/subscription/upgrade`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${sessionToken}` },
        });
        let data;
        try { data = await res.json(); } catch { data = {}; }
        if (res.ok && data.success) {
          toast.success('Upgraded to Advanced! AI Wingman is now unlocked.');
          loadSubscriptionData();
          return;
        }
        if (data.use_checkout) {
          useCheckout = true;
        } else {
          throw new Error(data.detail || 'Failed to upgrade');
        }
      }

      if (useCheckout) {
        const origin = window.location.origin;
        const res = await fetch(`${API}/api/subscription/create-checkout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            plan: 'advanced',
            success_url: checkoutSuccessUrl('advanced'),
            cancel_url: `${origin}/account`,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Failed to create checkout');
        redirectToCheckout(data.checkout_url);
      }
    } catch (err) {
      toast.error(err.message || 'Something went wrong');
    } finally {
      setUpgrading(false);
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
      'trial': 'Free Trial',
      'basic': 'Basic',
      'advanced': 'Advanced',
      'grandfathered': 'Lifetime',
      'monthly': 'Monthly (Legacy)',
      'quarterly': 'Quarterly (Legacy)',
      'annual': 'Annual (Legacy)',
    };
    return names[tier] || tier || 'Unknown';
  };

  // Effective tier: plan_type takes priority over subscription_tier because
  // during a trial, subscription_tier = "basic" (the underlying Stripe price)
  // while plan_type = "trial" (the actual account state).
  const rawTier = subscription?.plan_type || subscription?.subscription_tier;
  const hasPlan = !!rawTier && !['none', 'expired'].includes(rawTier) &&
    !['cancelled', 'expired'].includes(subscription?.subscription_status);
  const effectiveTier = hasPlan ? rawTier : null;

  const getTierBadgeColor = (tier) => {
    const colors = {
      'trial': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      'basic': 'bg-slate-500/20 text-slate-300 border-slate-500/30',
      'advanced': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      'grandfathered': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      'monthly': 'bg-green-500/20 text-green-400 border-green-500/30',
      'quarterly': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      'annual': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    };
    return colors[tier] || 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  };

  const getBillingAmount = (tier) => {
    const prices = {
      'basic': '$5',
      'advanced': '$8',
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
      'basic': 'per month',
      'advanced': 'per month',
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
    const tier = effectiveTier;
    return (
      subscription?.stripe_subscription_id &&
      ['active', 'trialing'].includes(subscription?.subscription_status) &&
      !['lifetime', 'grandfathered'].includes(tier)
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
            onClick={() => navigate(hasPlan ? '/app' : '/pricing')}
            data-testid="back-to-dashboard-btn"
          >
            {hasPlan ? 'Back to Dashboard' : 'Choose a Plan'}
          </Button>
        </div>

        {/* Subscription Status Card */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex flex-wrap items-center gap-2" data-testid="subscription-status-title">
              Subscription Status
              {effectiveTier && (
                <span className={`px-3 py-1 rounded-full text-xs sm:text-sm border ${getTierBadgeColor(effectiveTier)}`}>
                  {getTierDisplayName(effectiveTier)}
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
                  ) : subscription?.subscription_status === 'trialing' || subscription?.plan_type === 'trial' ? (
                    <span className="text-cyan-400">
                      Free Trial{subscription?.trial_ends_at ? ` — ends ${formatDate(subscription.trial_ends_at)}` : ''}
                    </span>
                  ) : (
                    <span className="text-slate-400">{hasPlan ? subscription?.subscription_status : 'No active plan'}</span>
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

              {effectiveTier && !['lifetime', 'grandfathered', 'trial'].includes(effectiveTier) && (
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

            <UndoCancellationSection
              subscription={subscription}
              tierName={getTierDisplayName(effectiveTier)}
              formatDate={formatDate}
              onRestored={loadSubscriptionData}
            />

            {/* Downgrade Scheduled Notice */}
            {subscription?.downgrade_at_period_end && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4" data-testid="downgrade-scheduled-notice">
                <p className="text-amber-400 font-medium">Downgrade Scheduled</p>
                <p className="text-amber-300/80 text-sm mt-1">
                  You&apos;ll switch to Basic on {subscription.downgrade_date ? formatDate(subscription.downgrade_date) : 'the end of your current billing period'}.
                  You keep full Advanced access — including AI Wingman — until then.
                </p>
              </div>
            )}

            {/* Trial → Advanced confirmation notice */}
            {effectiveTier === 'advanced' && subscription?.subscription_status === 'trialing' && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4" data-testid="trial-advanced-notice">
                <p className="text-emerald-400 font-medium">Advanced Selected</p>
                <p className="text-emerald-300/80 text-sm mt-1">
                  Your free trial ends {subscription?.trial_ends_at ? formatDate(subscription.trial_ends_at) : 'soon'}.
                  Advanced ($8/month) begins after that. You can cancel anytime before then.
                </p>
              </div>
            )}

            {/* Upgrade Button — Basic users */}
            {effectiveTier === 'basic' &&
             subscription?.subscription_status === 'active' && (
              <div className="pt-4 border-t border-slate-700">
                <Button
                  onClick={handleUpgradeToAdvanced}
                  disabled={upgrading}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white"
                  data-testid="upgrade-to-advanced-btn"
                >
                  {upgrading ? 'Processing...' : 'Upgrade to Advanced — $8/mo'}
                </Button>
                <p className="text-slate-500 text-xs mt-2">
                  Unlock AI Wingman and personalized advice. Prorated for this billing period.
                </p>
              </div>
            )}

            {/* Upgrade Button — Trial users */}
            {effectiveTier === 'trial' &&
             subscription?.subscription_status === 'trialing' && (
              <div className="pt-4 border-t border-slate-700" data-testid="trial-upgrade-section">
                <Button
                  onClick={handleUpgradeToAdvanced}
                  disabled={upgrading}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white"
                  data-testid="trial-upgrade-to-advanced-btn"
                >
                  {upgrading ? 'Processing...' : 'Upgrade to Advanced — $8/mo'}
                </Button>
                <p className="text-slate-400 text-xs mt-2">
                  Keep all your Advanced features after your free trial. You won&apos;t be charged until your trial ends.
                </p>
              </div>
            )}

            {/* Downgrade Button — Advanced users only, hidden if downgrade already scheduled */}
            {effectiveTier === 'advanced' &&
             subscription?.subscription_status === 'active' && !subscription?.downgrade_at_period_end && (
              <div className="pt-4 border-t border-slate-700">
                <Button
                  onClick={() => setShowDowngradeModal(true)}
                  variant="outline"
                  className="border-orange-600/50 text-orange-400 hover:bg-orange-600/20"
                  data-testid="downgrade-btn"
                >
                  Downgrade to Basic
                </Button>
                <p className="text-slate-500 text-xs mt-2">
                  Switch to Basic ($5/mo). Takes effect at the end of your current billing period.
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
            {!hasPlan && (
              <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-4">
                <p className="text-slate-400 text-sm">
                  No active subscription. <a href="/pricing" className="text-cyan-400 hover:text-cyan-300">Choose a plan</a> to get started.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Features Card */}
        {hasPlan && <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Your Features</CardTitle>
            <CardDescription className="text-slate-400">
              What&apos;s included in your plan
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(() => {
              const hasAI = ['advanced', 'grandfathered', 'trial'].includes(effectiveTier);
              const baseFeatures = [
                'Cycle Tracking & Phase Detection',
                'MoodMap Visualizer',
                'Phase-Based Tips & Insights',
                'Research-Backed Resources',
                'Partner Profile & Preferences',
                'Push Notifications',
              ];
              const aiFeature = 'AI Wingman (Personalized Advice)';
              return (
                <ul className="space-y-3">
                  {baseFeatures.map((feature) => (
                    <li key={feature} className="flex items-center gap-3 text-white">
                      <span className="text-green-400">&#10003;</span>
                      {feature}
                    </li>
                  ))}
                  <li className={`flex items-center gap-3 ${hasAI ? 'text-white' : 'text-slate-500'}`}>
                    <span className={hasAI ? 'text-green-400' : 'text-slate-600'}>
                      {hasAI ? '\u2713' : '\u2717'}
                    </span>
                    {aiFeature}
                    {!hasAI && <span className="text-xs text-slate-500 ml-1">(Advanced plan)</span>}
                  </li>
                </ul>
              );
            })()}
          </CardContent>
        </Card>}

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
              onClick={() => navigate(hasPlan ? '/app' : '/pricing')}
              data-testid="dashboard-link"
            >
              {hasPlan ? 'Back to Dashboard' : 'Choose a Plan'}
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
                LocalStorage.clearOnLogout();
                window.location.href = '/login';
              }}
              data-testid="logout-btn"
            >
              Log Out
            </Button>
          </CardContent>
        </Card>

        <DeleteAccountSection subscription={subscription} />
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
                Are you sure you want to cancel your <span className="text-cyan-400 font-medium">{getTierDisplayName(effectiveTier)}</span> subscription?
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
              disabled={cancelling}
              data-testid="cancel-modal-keep-btn"
            >
              Keep My Subscription
            </AlertDialogCancel>
            <Button
              onClick={handleCancelSubscription}
              disabled={cancelling}
              className="bg-red-600 text-white hover:bg-red-700"
              data-testid="cancel-modal-confirm-btn"
            >
              {cancelling ? 'Cancelling...' : 'Yes, Cancel Subscription'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Downgrade Modal */}
      <AlertDialog open={showDowngradeModal} onOpenChange={setShowDowngradeModal}>
        <AlertDialogContent className="bg-slate-800 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white text-xl">
              Downgrade to Basic?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-slate-300 space-y-3">
                <p>
                  You&apos;re currently on the <span className="text-emerald-400 font-medium">Advanced</span> plan ($8/mo).
                  Downgrading moves you to <span className="text-cyan-400 font-medium">Basic</span> ($5/mo).
                </p>
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <p className="text-red-400 text-sm font-medium mb-2">You&apos;ll lose access to:</p>
                  <ul className="text-slate-300 text-sm space-y-1">
                    <li>• AI Wingman — personalized advice 24/7</li>
                    <li>• Real-time relationship guidance</li>
                    <li>• AI-driven phase recommendations</li>
                    <li>• Personalized tips based on your data</li>
                  </ul>
                </div>
                <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3">
                  <p className="text-cyan-300 text-sm">
                    The downgrade takes effect at the end of your current billing period.
                    You&apos;ll keep full Advanced access until then.
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-600 text-slate-300">
              Keep Advanced
            </AlertDialogCancel>
            <Button
              onClick={handleDowngrade}
              disabled={downgrading}
              className="bg-orange-600 text-white hover:bg-orange-700"
              data-testid="downgrade-confirm-btn"
            >
              {downgrading ? 'Processing...' : 'Confirm Downgrade to Basic'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AccountSettings;
