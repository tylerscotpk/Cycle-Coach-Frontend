import { useState, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "@/pages/LandingPage";
import Dashboard from "@/pages/Dashboard";
import PrivacySettings from "@/pages/PrivacySettings";
import AdminDashboard from "@/pages/AdminDashboard";
import PartnerConsent from "@/components/PartnerConsent";
import Paywall from "@/components/Paywall";
import { Toaster } from "@/components/ui/sonner";
import { LocalStorage } from "@/utils/localStorageManager";

function App() {
  // LOCAL-ONLY MODE: No server authentication
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [hasConsent, setHasConsent] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = () => {
    // Check license first, then consent
    const unlocked = LocalStorage.isUnlocked();
    setIsUnlocked(unlocked);
    
    if (unlocked) {
      const consent = LocalStorage.getConsent();
      setHasConsent(consent?.granted === true);
    }
    
    setLoading(false);
  };

  const handleUnlock = () => {
    setIsUnlocked(true);
  };

  const handleConsentGranted = () => {
    setHasConsent(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  // Show paywall if not unlocked
  if (!isUnlocked) {
    return (
      <>
        <Paywall onUnlock={handleUnlock} />
        <Toaster />
      </>
    );
  }

  // Show consent screen if not granted
  if (!hasConsent) {
    return (
      <>
        <PartnerConsent onConsentGranted={handleConsentGranted} />
        <Toaster />
      </>
    );
  }

  // LOCAL-ONLY MODE: Simple routing, no auth required
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/privacy" element={<PrivacySettings />} />
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </div>
  );
}

export default App;
