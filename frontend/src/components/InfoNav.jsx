import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const API = process.env.REACT_APP_BACKEND_URL;

const InfoNav = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [authState, setAuthState] = useState({ isAuthenticated: false, hasSubscription: false });
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Check auth state for nav display
    const sessionToken = localStorage.getItem('session_token');
    if (sessionToken) {
      fetch(`${API}/api/auth/check`, {
        credentials: 'include',
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      })
        .then(r => r.json())
        .then(data => {
          setAuthState({
            isAuthenticated: data.authenticated,
            hasSubscription: data.has_subscription
          });
        })
        .catch(() => {});
    }
  }, []);

  const isActive = (path) => location.pathname === path;

  const linkClasses = (path) =>
    `transition-colors duration-200 ${
      isActive(path) ? 'text-cyan-400' : 'text-slate-300 hover:text-white'
    }`;

  const handleLogout = async () => {
    const sessionToken = localStorage.getItem('session_token');
    try {
      if (sessionToken) {
        await fetch(`${API}/api/auth/logout`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Authorization': `Bearer ${sessionToken}` }
        });
      }
    } catch (e) {}
    localStorage.removeItem('session_token');
    localStorage.removeItem('user');
    localStorage.removeItem('pending_plan');
    window.location.href = '/';
  };

  // Active subscriber — don't show public nav, they should be in-app
  if (authState.isAuthenticated && authState.hasSubscription) {
    return null;
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50">
      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl font-bold text-white tracking-tight" data-testid="nav-logo">Cycle Coach</span>
          </Link>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <Link to="/" className={linkClasses('/')} data-testid="nav-home">Home</Link>
            <Link to="/about" className={linkClasses('/about')} data-testid="nav-about">About</Link>
            <Link to="/pricing" className={linkClasses('/pricing')} data-testid="nav-pricing">Pricing</Link>
            <Link to="/info/contact" className={linkClasses('/info/contact')} data-testid="nav-contact">Contact</Link>
            
            {authState.isAuthenticated ? (
              <div className="flex items-center gap-4">
                <Link to="/pricing">
                  <Button variant="outline" className="border-cyan-500 text-cyan-400 hover:bg-cyan-500/10" data-testid="nav-choose-plan-btn">
                    Choose a Plan
                  </Button>
                </Link>
                <Button 
                  variant="ghost" 
                  className="text-slate-400 hover:text-white"
                  onClick={handleLogout}
                  data-testid="nav-logout-btn"
                >
                  Log Out
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <Link to="/login">
                  <Button variant="ghost" className="text-slate-300 hover:text-white" data-testid="nav-login-btn">
                    Log In
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button className="bg-cyan-500 hover:bg-cyan-600 text-white" data-testid="nav-signup-btn">
                    Sign Up
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden text-slate-300 hover:text-white p-2"
            data-testid="nav-mobile-menu-btn"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden mt-4 pt-4 border-t border-slate-800/50 space-y-4 pb-4">
            <Link
              to="/"
              className={`block ${linkClasses('/')}`}
              onClick={() => setIsMenuOpen(false)}
            >
              Home
            </Link>
            <Link
              to="/about"
              className={`block ${linkClasses('/about')}`}
              onClick={() => setIsMenuOpen(false)}
            >
              About
            </Link>
            <Link
              to="/pricing"
              className={`block ${linkClasses('/pricing')}`}
              onClick={() => setIsMenuOpen(false)}
            >
              Pricing
            </Link>
            <Link
              to="/info/contact"
              className={`block ${linkClasses('/info/contact')}`}
              onClick={() => setIsMenuOpen(false)}
            >
              Contact
            </Link>
            
            <div className="pt-4 border-t border-slate-800/50 space-y-3">
              {authState.isAuthenticated ? (
                <>
                  <Link to="/pricing" onClick={() => setIsMenuOpen(false)}>
                    <Button variant="outline" className="w-full border-cyan-500 text-cyan-400 hover:bg-cyan-500/10">
                      Choose a Plan
                    </Button>
                  </Link>
                  <Button 
                    variant="ghost" 
                    className="w-full text-slate-400 hover:text-white"
                    onClick={() => { handleLogout(); setIsMenuOpen(false); }}
                  >
                    Log Out
                  </Button>
                </>
              ) : (
                <>
                  <Link to="/login" onClick={() => setIsMenuOpen(false)}>
                    <Button variant="ghost" className="w-full text-slate-300 hover:text-white">
                      Log In
                    </Button>
                  </Link>
                  <Link to="/signup" onClick={() => setIsMenuOpen(false)}>
                    <Button className="w-full bg-cyan-500 hover:bg-cyan-600 text-white">
                      Sign Up
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default InfoNav;
