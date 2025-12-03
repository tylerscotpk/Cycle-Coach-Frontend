import { useState, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "@/pages/LandingPage";
import Dashboard from "@/pages/Dashboard";
import PrivacySettings from "@/pages/PrivacySettings";
import PartnerConsent from "@/components/PartnerConsent";
import { Toaster } from "@/components/ui/sonner";
import { LocalStorage } from "@/utils/localStorageManager";

function App() {
  // LOCAL-ONLY MODE: No server authentication
  const [hasConsent, setHasConsent] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkLocalConsent();
  }, []);

  const checkLocalConsent = () => {
    const consent = LocalStorage.getConsent();
    setHasConsent(consent?.granted === true);
    setLoading(false);
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

  // Show consent screen if not granted
  if (!hasConsent) {
    return (
      <>
        <PartnerConsent onConsentGranted={handleConsentGranted} />
        <Toaster />
      </>
    );
  }

  const oldCheckAuth = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, { withCredentials: true });
      setUser(response.data);
    } catch (error) {
      console.log("Not authenticated");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={user ? <Navigate to="/dashboard" /> : <LandingPage setUser={setUser} />} />
          <Route path="/dashboard" element={user ? <Dashboard user={user} setUser={setUser} /> : <Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </div>
  );
}

export default App;
