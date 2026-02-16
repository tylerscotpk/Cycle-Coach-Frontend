import { useState, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import LandingPage from "@/pages/LandingPage";
import Dashboard from "@/pages/Dashboard";
import PrivacySettings from "@/pages/PrivacySettings";
import AccountSettings from "@/pages/AccountSettings";
import Contact from "@/pages/Contact";
import PhasePredictor from "@/pages/PhasePredictor";
import AdminDashboard from "@/pages/AdminDashboard";
import PartnerConsent from "@/components/PartnerConsent";
import Paywall from "@/components/Paywall";
import StatePrivacyWaiver from "@/components/StatePrivacyWaiver";
import { Toaster } from "@/components/ui/sonner";
import { LocalStorage } from "@/utils/localStorageManager";

// Informational Website Pages
import InfoHome from "@/pages/InfoHome";
import InfoAbout from "@/pages/InfoAbout";
import InfoPricing from "@/pages/InfoPricing";
import InfoContact from "@/pages/InfoContact";
import InfoLogin from "@/pages/InfoLogin";

// Routes that bypass paywall/consent flow
const PUBLIC_ROUTES = ['/', '/info', '/about', '/signup', '/login', '/info/contact', '/admin'];

function AppContent() {
  const location = useLocation();
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [hasLocationSetup, setHasLocationSetup] = useState(false);
  const [hasConsent, setHasConsent] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = () => {
    try {
      const unlocked = LocalStorage.isUnlocked();
      setIsUnlocked(unlocked);
      
      if (unlocked) {
        const locationSetup = LocalStorage.hasCompletedLocationSetup();
        setHasLocationSetup(locationSetup);
        
        if (locationSetup) {
          const consent = LocalStorage.getConsent();
          setHasConsent(consent?.granted === true);
        }
      }
    } catch (error) {
      console.error('Error checking app state:', error);
      // On error, default to showing public routes
      setIsUnlocked(false);
    } finally {
      setLoading(false);
    }
  };

  // Check if current route is public (bypasses paywall)
  const isPublicRoute = PUBLIC_ROUTES.some(route => 
    location.pathname === route || location.pathname.startsWith('/info')
  );

  // Always show public routes immediately without waiting for localStorage check
  if (isPublicRoute) {
    return (
      <Routes>
        <Route path="/" element={<InfoHome />} />
        <Route path="/info" element={<InfoHome />} />
        <Route path="/about" element={<InfoAbout />} />
        <Route path="/signup" element={<InfoPricing />} />
        <Route path="/login" element={<InfoLogin />} />
        <Route path="/info/contact" element={<InfoContact />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  // Show paywall if not unlocked
  if (!isUnlocked) {
    return <Paywall onUnlock={handleUnlock} />;
  }

  // Show state privacy waiver if not completed
  if (!hasLocationSetup) {
    return <StatePrivacyWaiver onComplete={handleLocationComplete} />;
  }

  // Show consent screen if not granted
  if (!hasConsent) {
    return <PartnerConsent onConsentGranted={handleConsentGranted} />;
  }

  // Protected app routes (for paying users)
  return (
    <Routes>
      <Route path="/app" element={<Dashboard />} />
      <Route path="/privacy" element={<PrivacySettings />} />
      <Route path="/account" element={<AccountSettings />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/predictor" element={<PhasePredictor />} />
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/admin" element={<AdminDashboard />} />
      {/* Redirect authenticated users from / to /app */}
      <Route path="/" element={<Dashboard />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
      <Toaster />
    </BrowserRouter>
  );
}

export default App;
