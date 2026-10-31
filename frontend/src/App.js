import { useState, useEffect, createContext, useContext, useCallback } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import Dashboard from "@/pages/Dashboard";
import PrivacySettings from "@/pages/PrivacySettings";
import AccountSettings from "@/pages/AccountSettings";
import Contact from "@/pages/Contact";
import PhasePredictor from "@/pages/PhasePredictor";
import AdminDashboard from "@/pages/AdminDashboard";
import PartnerConsent from "@/components/PartnerConsent";
import StatePrivacyWaiver from "@/components/StatePrivacyWaiver";
import { Toaster } from "@/components/ui/sonner";

// Informational Website Pages
import InfoHome from "@/pages/InfoHome";
import InfoAbout from "@/pages/InfoAbout";
import InfoPricing from "@/pages/InfoPricing";
import InfoContact from "@/pages/InfoContact";
import InfoLogin from "@/pages/InfoLogin";
import InfoSignUp from "@/pages/InfoSignUp";
import InfoForgotPassword from "@/pages/InfoForgotPassword";
import InfoResetPassword from "@/pages/InfoResetPassword";
import InfoPrivacyPolicy from "@/pages/InfoPrivacyPolicy";
import InfoTermsOfService from "@/pages/InfoTermsOfService";
import DeleteAccount from "@/pages/DeleteAccount";
import VerifyEmail from "@/pages/VerifyEmail";
import CheckoutSuccess from "@/pages/CheckoutSuccess";
import AccountDeleted from "@/pages/AccountDeleted";
import { ExternalCheckoutDialog } from "@/components/ExternalCheckoutDialog";
import { Loader2 } from "lucide-react";
import AppBackground from "@/components/AppBackground";
import { LocalStorage } from "@/utils/localStorageManager";

const API = process.env.REACT_APP_BACKEND_URL || "";

// Auth Context
const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

// Public routes (no auth required)
const PUBLIC_ROUTES = ['/', '/info', '/about', '/pricing', '/signup', '/login', '/forgot-password', '/reset-password', '/info/contact', '/info/terms-of-service', '/admin', '/checkout-success', '/privacy-policy', '/delete-account', '/verify-email', '/account-deleted'];

function AuthProvider({ children }) {
  const [authState, setAuthState] = useState({
    isLoading: true,
    isAuthenticated: false,
    hasSubscription: false,
    user: null,
    error: null
  });

  const checkAuth = useCallback(async () => {
    try {
      const sessionToken = localStorage.getItem('session_token');
      
      if (!sessionToken) {
        setAuthState({
          isLoading: false,
          isAuthenticated: false,
          hasSubscription: false,
          user: null
        });
        return;
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      const response = await fetch(`${API}/api/auth/check`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        },
        signal: controller.signal
      });
      clearTimeout(timer);

      const result = await response.json();

      if (result.authenticated) {
        LocalStorage.setUser(result.user.id);
        setAuthState({
          isLoading: false,
          isAuthenticated: true,
          hasSubscription: result.has_subscription,
          user: result.user,
          error: null
        });
        localStorage.setItem('user', JSON.stringify(result.user));
      } else {
        localStorage.removeItem('session_token');
        localStorage.removeItem('user');
        setAuthState({
          isLoading: false,
          isAuthenticated: false,
          hasSubscription: false,
          user: null
        });
      }
    } catch (error) {
      // Network failure/timeout: keep the session and offer a retry instead of a blank or logged-out screen
      console.error('Auth check error:', error);
      setAuthState(prev => ({ ...prev, isLoading: false, error: 'network' }));
    }
  }, []);

  const retryAuth = useCallback(() => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const logout = async () => {
    try {
      const sessionToken = localStorage.getItem('session_token');
      if (sessionToken) {
        await fetch(`${API}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sessionToken}`
          }
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      LocalStorage.clearOnLogout();
      setAuthState({
        isLoading: false,
        isAuthenticated: false,
        hasSubscription: false,
        user: null
      });
      window.location.href = '/';
    }
  };

  return (
    <AuthContext.Provider value={{ ...authState, checkAuth, retryAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

function AppContent() {
  const location = useLocation();
  const auth = useAuth();
  const [, forceRender] = useState(0);

  // Set user ID for LocalStorage namespace as soon as auth is available
  const uid = auth.isAuthenticated && auth.hasSubscription ? auth.user?.id : null;
  if (uid) LocalStorage.setUser(uid);

  // Read onboarding flags synchronously — no useEffect delay, no stale initial state
  const hasLocationSetup = uid
    ? localStorage.getItem(`cyclecoach_state_waiver_complete_${uid}`) === 'true'
    : false;
  const hasConsent = hasLocationSetup && uid
    ? localStorage.getItem(`cyclecoach_consent_granted_${uid}`) === 'true'
    : false;

  // Poll for subscription status after Stripe payment return
  useEffect(() => {
    if (auth.isAuthenticated && !auth.hasSubscription) {
      // User is logged in but no subscription yet — might be returning from Stripe
      // Call the sync endpoint to check Stripe directly (bypasses webhook dependency)
      let pollCount = 0;
      const maxPolls = 15;

      const syncAndCheck = async () => {
        try {
          const sessionToken = localStorage.getItem('session_token');
          if (!sessionToken) return;

          // Call sync endpoint — queries Stripe API for this user's subscription
          const syncResp = await fetch(`${API}/api/subscription/sync`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${sessionToken}` }
          });
          const syncData = await syncResp.json();

          if (syncData.synced && syncData.subscription_status) {
            // Stripe confirmed subscription — refresh auth state
            await auth.checkAuth();
            return true; // stop polling
          }
        } catch (e) {
          console.error('Subscription sync error:', e);
        }
        return false;
      };

      // Immediate sync on mount
      syncAndCheck();

      const interval = setInterval(async () => {
        pollCount++;
        if (pollCount > maxPolls) {
          clearInterval(interval);
          return;
        }
        const found = await syncAndCheck();
        if (found) clearInterval(interval);
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [auth.isAuthenticated, auth.hasSubscription]);

  // Returning from Safari (email verification or checkout): refresh plan status when the app is foregrounded
  useEffect(() => {
    const onVisible = async () => {
      if (document.visibilityState !== 'visible' || !auth.isAuthenticated || auth.hasSubscription) return;
      const sessionToken = localStorage.getItem('session_token');
      if (!sessionToken) return;
      try {
        await fetch(`${API}/api/subscription/sync`, { method: 'POST', headers: { 'Authorization': `Bearer ${sessionToken}` } });
      } catch { /* best effort */ }
      auth.checkAuth();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [auth.isAuthenticated, auth.hasSubscription]);

  const handleLocationComplete = () => {
    if (uid) localStorage.setItem(`cyclecoach_state_waiver_complete_${uid}`, 'true');
    forceRender(n => n + 1);
  };

  const handleConsentGranted = () => {
    if (uid) localStorage.setItem(`cyclecoach_consent_granted_${uid}`, 'true');
    forceRender(n => n + 1);
  };

  const isPublicRoute = PUBLIC_ROUTES.some(route => 
    location.pathname === route || location.pathname.startsWith('/info')
  );

  // Show loading state
  if (auth.isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-900" data-testid="app-loading">
        <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
        <div className="text-slate-300">Loading Cycle Coach…</div>
      </div>
    );
  }

  if (auth.error && !isPublicRoute) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-900 px-6 text-center" data-testid="app-load-error">
        <h1 className="text-white text-2xl font-semibold">We couldn&apos;t connect</h1>
        <p className="text-slate-400 max-w-sm">Check your internet connection and try again. Your data on this device is safe.</p>
        <button onClick={auth.retryAuth} className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-md px-6 py-3 font-semibold" data-testid="app-retry-btn">
          Try Again
        </button>
      </div>
    );
  }

  // ============ ROUTING RULES ============
  
  // Rule 1: ACTIVE USER (logged in + subscription) visiting public routes → redirect to /app (except /admin)
  if (auth.isAuthenticated && auth.hasSubscription && isPublicRoute && location.pathname !== '/admin' && location.pathname !== '/checkout-success' && location.pathname !== '/privacy-policy' && location.pathname !== '/info/terms-of-service' && location.pathname !== '/delete-account' && location.pathname !== '/verify-email' && location.pathname !== '/pricing') {
    return <Navigate to="/app" replace />;
  }

  // Rule 2: Logged in but NO subscription trying to access /app routes → redirect to pricing
  if (auth.isAuthenticated && !auth.hasSubscription && location.pathname.startsWith('/app')) {
    return <Navigate to="/pricing" replace />;
  }

  // Rule 3: NOT logged in trying to access /app routes → redirect to login
  if (!auth.isAuthenticated && location.pathname.startsWith('/app')) {
    return <Navigate to="/login" replace />;
  }

  // ============ PUBLIC ROUTES ============
  if (isPublicRoute || (auth.isAuthenticated && !auth.hasSubscription)) {
    return (
      <Routes>
        <Route path="/" element={<InfoHome />} />
        <Route path="/info" element={<InfoHome />} />
        <Route path="/about" element={<InfoAbout />} />
        <Route path="/pricing" element={<InfoPricing />} />
        <Route path="/signup" element={<InfoSignUp />} />
        <Route path="/login" element={<InfoLogin />} />
        <Route path="/forgot-password" element={<InfoForgotPassword />} />
        <Route path="/reset-password" element={<InfoResetPassword />} />
        <Route path="/info/contact" element={<InfoContact />} />
        <Route path="/privacy-policy" element={<InfoPrivacyPolicy />} />
        <Route path="/info/terms-of-service" element={<InfoTermsOfService />} />
        <Route path="/delete-account" element={<DeleteAccount />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/checkout-success" element={<CheckoutSuccess />} />
        <Route path="/account-deleted" element={<AccountDeleted />} />
        {auth.isAuthenticated && <Route path="/account" element={<AccountSettings />} />}
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="*" element={<Navigate to="/pricing" replace />} />
      </Routes>
    );
  }

  // Protected app routes
  if (auth.isAuthenticated && auth.hasSubscription) {
    if (!hasLocationSetup) {
      return <StatePrivacyWaiver onComplete={handleLocationComplete} />;
    }

    if (!hasConsent) {
      return <PartnerConsent onConsentGranted={handleConsentGranted} />;
    }

    return (
      <Routes>
        <Route path="/app" element={<Dashboard />} />
        <Route path="/privacy" element={<PrivacySettings />} />
        <Route path="/privacy-policy" element={<InfoPrivacyPolicy />} />
        <Route path="/info/terms-of-service" element={<InfoTermsOfService />} />
        <Route path="/delete-account" element={<DeleteAccount />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/account" element={<AccountSettings />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/predictor" element={<PhasePredictor />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    );
  }

  return <Navigate to="/" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppBackground>
          <AppContent />
        </AppBackground>
        <ExternalCheckoutDialog />
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
