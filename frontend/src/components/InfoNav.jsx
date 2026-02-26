import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';

// Cycle Coach circular icon
const CYCLE_COACH_ICON = "https://customer-assets.emergentagent.com/job_partner-cycle/artifacts/mdtjfodq_Cycle%20Coach%20Circle%20Icon.png";

const InfoNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasSubscription, setHasSubscription] = useState(false);

  useEffect(() => {
    // Check auth state from localStorage
    const sessionToken = localStorage.getItem('session_token');
    const user = localStorage.getItem('user');
    
    if (sessionToken && user) {
      setIsAuthenticated(true);
      try {
        const userData = JSON.parse(user);
        setHasSubscription(userData.has_subscription || false);
      } catch {
        setHasSubscription(false);
      }
    } else {
      setIsAuthenticated(false);
      setHasSubscription(false);
    }
  }, [location]);

  // Public navigation links
  const publicNavLinks = [
    { path: '/', label: 'Home' },
    { path: '/about', label: 'About' },
    { path: '/pricing', label: 'Pricing' },
    { path: '/login', label: 'Login' },
    { path: '/info/contact', label: 'Contact' },
  ];

  // Authenticated user navigation links (with subscription)
  const appNavLinks = [
    { path: '/app', label: 'Dashboard' },
    { path: '/account', label: 'Account' },
  ];

  const navLinks = (isAuthenticated && hasSubscription) ? appNavLinks : publicNavLinks;

  const isActive = (path) => {
    if (path === '/' || path === '/info') {
      return location.pathname === '/info' || location.pathname === '/';
    }
    return location.pathname === path;
  };

  const handleLogout = () => {
    localStorage.removeItem('session_token');
    localStorage.removeItem('user');
    window.location.href = '/';
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo with Icon */}
          <Link to={isAuthenticated && hasSubscription ? "/app" : "/"} className="flex items-center gap-2">
            <img 
              src={CYCLE_COACH_ICON} 
              alt="Cycle Coach" 
              className="w-8 h-8 object-contain"
            />
            <span className="text-xl font-bold text-white tracking-tight">
              Cycle<span className="text-cyan-500">Coach</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`text-sm font-medium transition-colors ${
                  isActive(link.path)
                    ? 'text-cyan-400'
                    : 'text-slate-400 hover:text-white'
                }`}
                data-testid={`nav-${link.label.toLowerCase().replace(' ', '-')}`}
              >
                {link.label}
              </Link>
            ))}
            {isAuthenticated && (
              <button
                onClick={handleLogout}
                className="text-sm font-medium text-slate-400 hover:text-white transition-colors"
                data-testid="nav-logout"
              >
                Logout
              </button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-400 hover:text-white"
            data-testid="mobile-menu-btn"
          >
            {mobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-slate-800/50">
            <div className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`text-base font-medium py-2 ${
                    isActive(link.path)
                      ? 'text-cyan-400'
                      : 'text-slate-400'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              {isAuthenticated && (
                <button
                  onClick={handleLogout}
                  className="text-base font-medium py-2 text-slate-400 text-left"
                >
                  Logout
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default InfoNav;
