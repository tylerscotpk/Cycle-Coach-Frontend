import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
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

const AdminDashboard = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({ users: {} });
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [userFilter, setUserFilter] = useState('all');
  const [lifetimeTarget, setLifetimeTarget] = useState(null);
  const [grantingLifetime, setGrantingLifetime] = useState(false);

  useEffect(() => {
    const verifySession = async () => {
      const token = sessionStorage.getItem('admin_token');
      if (token) {
        try {
          const response = await fetch(`${API}/api/admin/verify`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            setIsAuthenticated(true);
          } else {
            sessionStorage.removeItem('admin_token');
          }
        } catch (error) {
          console.error('Session verification failed:', error);
          sessionStorage.removeItem('admin_token');
        }
      }
      setAuthLoading(false);
    };
    verifySession();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchStats();
      fetchUsers();
    }
  }, [isAuthenticated, userFilter]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      const response = await fetch(`${API}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        sessionStorage.setItem('admin_token', data.token);
        setIsAuthenticated(true);
        toast.success('Admin access granted');
      } else {
        toast.error(data.detail || 'Invalid password');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Login failed. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const getAdminHeaders = () => {
    const token = sessionStorage.getItem('admin_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API}/api/admin/stats`, { headers: getAdminHeaders() });
      if (response.status === 401) { sessionStorage.removeItem('admin_token'); setIsAuthenticated(false); return; }
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      let url = `${API}/api/admin/users?`;
      if (userFilter === 'cancelled') {
        url += 'cancelled=true';
      } else if (userFilter === 'trial') {
        url += 'plan_type=trial';
      } else if (userFilter === 'no_plan') {
        url += 'no_plan=true';
      } else if (userFilter === 'deactivated') {
        url += 'deactivated=true';
      } else if (userFilter !== 'all') {
        url += `subscription_tier=${userFilter}`;
      }
      const response = await fetch(url, { headers: getAdminHeaders() });
      if (response.status === 401) { sessionStorage.removeItem('admin_token'); setIsAuthenticated(false); return; }
      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (email) => {
    try {
      const response = await fetch(`${API}/api/admin/cancel-user/${email}`, { method: 'POST', headers: getAdminHeaders() });
      const result = await response.json();
      if (result.status === 'cancelled') {
        toast.success('User access cancelled');
        fetchUsers();
        fetchStats();
      } else {
        toast.error('Failed to cancel');
      }
    } catch (error) {
      console.error('Error cancelling:', error);
      toast.error('Failed to cancel user');
    }
  };

  const handleRestoreCancelled = async (email) => {
    try {
      const response = await fetch(`${API}/api/admin/restore-user/${email}`, { method: 'POST', headers: getAdminHeaders() });
      const result = await response.json();
      if (result.status === 'restored') {
        toast.success('User access restored');
        fetchUsers();
        fetchStats();
      } else {
        toast.error(result.detail || 'Failed to restore');
      }
    } catch (error) {
      console.error('Error restoring:', error);
      toast.error('Failed to restore user');
    }
  };

  const handleRestoreDeactivated = async (email) => {
    try {
      const response = await fetch(`${API}/api/admin/unarchive-user/${email}`, { method: 'POST', headers: getAdminHeaders() });
      const result = await response.json();
      if (result.status === 'unarchived') {
        toast.success(`User reactivated${result.restored_tier ? ` (restored to ${result.restored_tier})` : ''}`);
        fetchUsers();
        fetchStats();
      } else {
        toast.error(result.detail || 'Failed to reactivate');
      }
    } catch (error) {
      console.error('Error reactivating:', error);
      toast.error('Failed to reactivate user');
    }
  };

  const handleArchive = async (email) => {
    try {
      const response = await fetch(`${API}/api/admin/archive-user/${email}`, { method: 'POST', headers: getAdminHeaders() });
      const result = await response.json();
      if (result.status === 'archived') {
        toast.success('User deactivated');
        fetchUsers();
        fetchStats();
      } else {
        toast.error('Failed to deactivate');
      }
    } catch (error) {
      console.error('Error archiving:', error);
      toast.error('Failed to deactivate user');
    }
  };

  const handleGrantLifetime = async () => {
    if (!lifetimeTarget) return;
    setGrantingLifetime(true);
    try {
      const response = await fetch(`${API}/api/admin/grant-lifetime/${lifetimeTarget}`, { method: 'POST', headers: getAdminHeaders() });
      let result;
      try { result = await response.json(); } catch { result = {}; }
      if (response.ok && result.status === 'granted') {
        toast.success(`Lifetime access granted to ${lifetimeTarget}${result.stripe_cancelled ? ' (Stripe sub cancelled)' : ''}`);
        setLifetimeTarget(null);
        fetchUsers();
        fetchStats();
      } else {
        toast.error(result.detail || 'Failed to grant lifetime access');
      }
    } catch (error) {
      console.error('Error granting lifetime:', error);
      toast.error('Failed to grant lifetime access');
    } finally {
      setGrantingLifetime(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  const getTierBadge = (user) => {
    const tier = user.subscription_tier || user.plan_type;
    const map = {
      trial: { label: 'Free Trial', cls: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
      basic: { label: 'Basic', cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
      advanced: { label: 'Advanced', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
      grandfathered: { label: 'Lifetime', cls: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    };
    const info = map[tier];
    if (!info) return <span className="px-2 py-0.5 rounded text-xs border bg-slate-500/20 text-slate-400 border-slate-500/30">No Plan</span>;
    return <span className={`px-2 py-0.5 rounded text-xs border ${info.cls}`}>{info.label}</span>;
  };

  const getStatusBadge = (user) => {
    if (user.is_active === false) {
      return <span className="px-2 py-0.5 rounded text-xs border bg-gray-500/20 text-gray-400 border-gray-500/30">deactivated</span>;
    }
    const status = user.subscription_status;
    const map = {
      active: { label: 'active', cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
      trialing: { label: 'trialing', cls: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
      cancelling: { label: 'cancelling', cls: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
      cancelled: { label: 'cancelled', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
      past_due: { label: 'past due', cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    };
    const info = map[status];
    if (!info) return null;
    return <span className={`px-2 py-0.5 rounded text-xs border ${info.cls}`}>{info.label}</span>;
  };

  const handleLogout = async () => {
    const token = sessionStorage.getItem('admin_token');
    try {
      await fetch(`${API}/api/admin/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
    sessionStorage.removeItem('admin_token');
    setIsAuthenticated(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-white text-lg">Verifying session...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="bg-slate-800/90 border-slate-700 w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-white text-center">Admin Access</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                className="bg-slate-700 border-slate-600 text-white"
                data-testid="admin-password-input"
              />
              <Button
                type="submit"
                className="w-full bg-cyan-500 hover:bg-cyan-600"
                disabled={authLoading}
                data-testid="admin-login-btn"
              >
                {authLoading ? 'Logging in...' : 'Login'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const userFilters = [
    { key: 'all', label: 'All Users', count: stats.users?.total || 0 },
    { key: 'trial', label: 'Free Trial', count: stats.users?.trial || 0 },
    { key: 'basic', label: 'Basic', count: stats.users?.basic || 0 },
    { key: 'advanced', label: 'Advanced', count: stats.users?.advanced || 0 },
    { key: 'grandfathered', label: 'Lifetime', count: stats.users?.lifetime || 0 },
    { key: 'cancelled', label: 'Cancelled', count: stats.users?.cancelled || 0 },
    { key: 'no_plan', label: 'No Plan', count: stats.users?.no_plan || 0 },
    { key: 'deactivated', label: 'Deactivated', count: stats.users?.deactivated || 0 },
  ];

  const statCards = [
    { label: 'Free Trial', count: stats.users?.trial || 0, color: 'cyan' },
    { label: 'Basic', count: stats.users?.basic || 0, color: 'blue' },
    { label: 'Advanced', count: stats.users?.advanced || 0, color: 'emerald' },
    { label: 'Lifetime', count: stats.users?.lifetime || 0, color: 'purple' },
    { label: 'Cancelled', count: stats.users?.cancelled || 0, color: 'red' },
  ];

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-white" data-testid="admin-dashboard-title">Admin Dashboard</h1>
          <Button
            variant="outline"
            className="border-slate-600 text-slate-300"
            onClick={handleLogout}
            data-testid="admin-logout-btn"
          >
            Logout
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {statCards.map((s) => (
            <Card key={s.label} className="border-slate-700 bg-slate-800/50">
              <CardContent className="p-4 text-center">
                <p className={`text-2xl font-bold text-${s.color}-400`}>{s.count}</p>
                <p className="text-slate-400 text-sm">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 flex-wrap">
          {userFilters.map((f) => (
            <Button
              key={f.key}
              variant={userFilter === f.key ? 'default' : 'outline'}
              size="sm"
              className={userFilter === f.key
                ? 'bg-cyan-500 hover:bg-cyan-600'
                : 'border-slate-600 text-slate-300 hover:bg-slate-700'}
              onClick={() => setUserFilter(f.key)}
              data-testid={`admin-filter-${f.key}`}
            >
              {f.label} ({f.count})
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="border-slate-600 text-slate-300 ml-auto"
            onClick={() => { fetchUsers(); fetchStats(); }}
            data-testid="admin-refresh-btn"
          >
            Refresh
          </Button>
        </div>

        {/* Users List */}
        <Card className="bg-slate-800/90 border-slate-700">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-slate-400">Loading...</div>
            ) : users.length === 0 ? (
              <div className="p-8 text-center text-slate-400" data-testid="admin-no-users">
                No users found for this filter
              </div>
            ) : (
              <div className="divide-y divide-slate-700">
                {users.map((user, index) => (
                  <div key={index} className="p-4" data-testid={`admin-user-row-${index}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="text-white font-medium truncate">{user.email}</p>
                          {getTierBadge(user)}
                          {getStatusBadge(user)}
                        </div>
                        <div className="flex gap-4 mt-1 text-xs text-slate-500 flex-wrap">
                          <span>Joined: {formatDate(user.created_at)}</span>
                          {user.cancels_at && <span>Cancels: {formatDate(user.cancels_at)}</span>}
                          {user.trial_ends_at && <span>Trial ends: {formatDate(user.trial_ends_at)}</span>}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap justify-end flex-shrink-0">
                        {/* Reactivate deactivated users */}
                        {user.is_active === false && (
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => handleRestoreDeactivated(user.email)}
                            data-testid={`admin-reactivate-${index}`}
                          >
                            Reactivate
                          </Button>
                        )}
                        {user.is_active !== false && (
                          <>
                            {/* Grant Lifetime Access */}
                            {user.subscription_tier !== 'grandfathered' && (
                              <Button
                                size="sm"
                                className="bg-purple-600 hover:bg-purple-700 text-white"
                                onClick={() => setLifetimeTarget(user.email)}
                                data-testid={`admin-grant-lifetime-${index}`}
                              >
                                Grant Lifetime
                              </Button>
                            )}
                            {/* Restore (for cancelled) */}
                            {(user.subscription_status === 'cancelled' || user.subscription_status === 'cancelling') && (
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => handleRestoreCancelled(user.email)}
                                data-testid={`admin-restore-${index}`}
                              >
                                Restore
                              </Button>
                            )}
                            {/* Cancel (for active) */}
                            {user.subscription_status === 'active' && user.subscription_tier !== 'grandfathered' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
                                onClick={() => handleCancel(user.email)}
                                data-testid={`admin-cancel-${index}`}
                              >
                                Cancel
                              </Button>
                            )}
                            {/* Deactivate */}
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-slate-600 text-slate-400 hover:bg-slate-700"
                              onClick={() => handleArchive(user.email)}
                              data-testid={`admin-deactivate-${index}`}
                            >
                              Deactivate
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Grant Lifetime Modal */}
      <AlertDialog open={!!lifetimeTarget} onOpenChange={(open) => { if (!open) setLifetimeTarget(null); }}>
        <AlertDialogContent className="bg-slate-800 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Grant Lifetime Access?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-300">
              This will set <span className="text-purple-400 font-medium">{lifetimeTarget}</span> to
              &quot;Grandfathered&quot; status with permanent access. Any active Stripe subscription will be cancelled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-600 text-slate-300" disabled={grantingLifetime}>
              Cancel
            </AlertDialogCancel>
            <Button
              onClick={handleGrantLifetime}
              disabled={grantingLifetime}
              className="bg-purple-600 text-white hover:bg-purple-700"
              data-testid="admin-confirm-lifetime-btn"
            >
              {grantingLifetime ? 'Granting...' : 'Confirm Grant Lifetime'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminDashboard;
