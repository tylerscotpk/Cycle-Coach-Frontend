import { useState, useEffect, createContext, useContext } from "react";
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

const API = process.env.REACT_APP_BACKEND_URL;

// Auth Context
const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

// Public routes (no auth required)
const PUBLIC_ROUTES = ['/', '/info', '/about', '/pricing', '/signup', '/login', '/forgot-password', '/reset-password', '/info/contact', '/admin'];

function AuthProvider({ children }) {
  const [authState, setAuthState] = useState({
    isLoading: true,
    isAuthenticated: false,
    hasSubscription: false,
    user: null
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
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

      const response = await fetch(`${API}/api/auth/check`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        },
        credentials: 'include'
      });

      const result = await response.json();

      if (result.authenticated) {
        setAuthState({
          isLoading: false,
          isAuthenticated: true,
          hasSubscription: result.has_subscription,
          user: result.user
        });
        localStorage.setItem('user', JSON.stringify(result.user));
      } else {
        // Clear invalid session
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
      console.error('Auth check error:', error);
      setAuthState({
        isLoading: false,
        isAuthenticated: false,
        hasSubscription: false,
        user: null
      });
    }
  };

  const logout = async () => {
    try {
      const sessionToken = localStorage.getItem('session_token');
      if (sessionToken) {
        await fetch(`${API}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sessionToken}`
          },
          credentials: 'include'
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('session_token');
      localStorage.removeItem('user');
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
    <AuthContext.Provider value={{ ...authState, checkAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

function AppContent() {
  const location = useLocation();
  const auth = useAuth();
  const [hasLocationSetup, setHasLocationSetup] = useState(false);
  const [hasConsent, setHasConsent] = useState(false);

  useEffect(() => {
    // Check location setup and consent for app routes
    if (auth.isAuthenticated && auth.hasSubscription) {
      const locationSetup = localStorage.getItem('cyclecoach_state_waiver_complete') === 'true';
      setHasLocationSetup(locationSetup);
      
      if (locationSetup) {
        const consent = localStorage.getItem('cyclecoach_consent_granted') === 'true';
        setHasConsent(consent);
      }
    }
  }, [auth.isAuthenticated, auth.hasSubscription]);

  const handleLocationComplete = () => {
    localStorage.setItem('cyclecoach_state_waiver_complete', 'true');
    setHasLocationSetup(true);
  };

  const handleConsentGranted = () => {
    localStorage.setItem('cyclecoach_consent_granted', 'true');
    setHasConsent(true);
  };

  // Check if current route is public
  const isPublicRoute = PUBLIC_ROUTES.some(route => 
    location.pathname === route || location.pathname.startsWith('/info')
  );

  // Show loading state
  if (auth.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  // ============ ROUTING RULES ============
  
  // Rule 1: ACTIVE USER (logged in + has subscription/trial) visiting public routes
  // -> Redirect to /app (except /admin)
  if (auth.isAuthenticated && auth.hasSubscription && isPublicRoute && location.pathname !== '/admin') {
    return <Navigate to="/app" replace />;
  }

  // Rule 2: Logged in but NO subscription trying to access /app routes
  // -> Redirect to pricing
  if (auth.isAuthenticated && !auth.hasSubscription && location.pathname.startsWith('/app')) {
    return <Navigate to="/pricing" replace />;
  }

  // Rule 3: NOT logged in trying to access /app routes
  // -> Redirect to login
  if (!auth.isAuthenticated && location.pathname.startsWith('/app')) {
    return <Navigate to="/login" replace />;
  }

  // Rule 4: Logged in but NO subscription on public routes
  // -> Allow them to view public pages (they can browse Home, About, etc.)
  // -> Primary CTA on these pages should route them to Pricing
  // (This is handled by the public routes below - no redirect needed)

  // ============ PUBLIC ROUTES ============
  // Accessible by: logged-out visitors AND logged-in users without subscription
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
        <Route path="/admin" element={<AdminDashboard />} />
        {/* Catch-all for logged-in non-subscribed users */}
        <Route path="*" element={<Navigate to="/pricing" replace />} />
      </Routes>
    );
  }
        <Route path="/login" element={<InfoLogin />} />
        <Route path="/forgot-password" element={<InfoForgotPassword />} />
        <Route path="/reset-password" element={<InfoResetPassword />} />
        <Route path="/info/contact" element={<InfoContact />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    );
  }

  // Protected app routes - show setup flows if needed
  if (auth.isAuthenticated && auth.hasSubscription) {
    // Show state privacy waiver if not completed
    if (!hasLocationSetup) {
      return <StatePrivacyWaiver onComplete={handleLocationComplete} />;
    }

    // Show consent screen if not granted
    if (!hasConsent) {
      return <PartnerConsent onConsentGranted={handleConsentGranted} />;
    }

    // Show app
    return (
      <Routes>
        <Route path="/app" element={<Dashboard />} />
        <Route path="/privacy" element={<PrivacySettings />} />
        <Route path="/account" element={<AccountSettings />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/predictor" element={<PhasePredictor />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    );
  }

  // Fallback - redirect to home
  return <Navigate to="/" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
