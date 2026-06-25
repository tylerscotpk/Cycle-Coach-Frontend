import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL || "";

const AdminDashboard = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [requests, setRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({ requests: {}, users: {} });
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [requestFilter, setRequestFilter] = useState('pending');
  const [userFilter, setUserFilter] = useState('monthly');
  const [activeTab, setActiveTab] = useState('requests');

  // Check for existing admin session on mount
  useEffect(() => {
    const verifySession = async () => {
      const token = sessionStorage.getItem('admin_token');
      if (token) {
        try {
          const response = await fetch(`${API}/api/admin/verify`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            }
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
      if (activeTab === 'requests') {
        fetchRequests();
      } else {
        fetchUsers();
      }
    }
  }, [isAuthenticated, requestFilter, userFilter, activeTab]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    
    try {
      const response = await fetch(`${API}/api/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
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

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API}/api/admin/stats`);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const url = requestFilter === 'all' 
        ? `${API}/api/trial/requests`
        : `${API}/api/trial/requests?status=${requestFilter}`;
      const response = await fetch(url);
      const data = await response.json();
      setRequests(data.requests || []);
    } catch (error) {
      console.error('Error fetching requests:', error);
      toast.error('Failed to fetch requests');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      let url = `${API}/api/admin/users?`;
      
      if (userFilter === 'cancelled') {
        url += 'cancelled=true';
      } else if (userFilter !== 'all') {
        url += `subscription_tier=${userFilter}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (email) => {
    try {
      const response = await fetch(`${API}/api/trial/approve/${email}`, {
        method: 'POST'
      });
      const result = await response.json();
      
      if (result.status === 'approved' || result.status === 'already_approved') {
        toast.success(`Approved! 1-month trial key sent: ${result.license_key}`);
        fetchRequests();
        fetchStats();
      } else {
        toast.error('Failed to approve');
      }
    } catch (error) {
      console.error('Error approving:', error);
      toast.error('Failed to approve request');
    }
  };

  const handleReject = async (email) => {
    try {
      const response = await fetch(`${API}/api/trial/reject/${email}`, {
        method: 'POST'
      });
      const result = await response.json();
      
      if (result.status === 'rejected') {
        toast.success('Request rejected');
        fetchRequests();
        fetchStats();
      } else {
        toast.error('Failed to reject');
      }
    } catch (error) {
      console.error('Error rejecting:', error);
      toast.error('Failed to reject request');
    }
  };

  const handleGrantKey = async (email, keyType) => {
    try {
      const response = await fetch(`${API}/api/admin/grant-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, key_type: keyType })
      });
      const result = await response.json();
      
      if (result.status === 'success') {
        toast.success(`${keyType.toUpperCase()} key sent: ${result.license_key}`);
        fetchUsers();
        fetchStats();
      } else {
        toast.error('Failed to grant key');
      }
    } catch (error) {
      console.error('Error granting key:', error);
      toast.error('Failed to grant key');
    }
  };

  const handleArchive = async (email) => {
    try {
      const response = await fetch(`${API}/api/admin/archive-user/${email}`, {
        method: 'POST'
      });
      const result = await response.json();
      
      if (result.status === 'archived') {
        toast.success('User archived');
        fetchUsers();
        fetchStats();
      } else {
        toast.error('Failed to archive');
      }
    } catch (error) {
      console.error('Error archiving:', error);
      toast.error('Failed to archive user');
    }
  };

  const handleUnarchive = async (email) => {
    try {
      const response = await fetch(`${API}/api/admin/unarchive-user/${email}`, {
        method: 'POST'
      });
      const result = await response.json();
      
      if (result.status === 'unarchived') {
        toast.success('User restored from archive');
        fetchUsers();
        fetchStats();
      } else {
        toast.error('Failed to restore');
      }
    } catch (error) {
      console.error('Error unarchiving:', error);
      toast.error('Failed to restore user');
    }
  };

  const handleCancel = async (email) => {
    try {
      const response = await fetch(`${API}/api/admin/cancel-user/${email}`, {
        method: 'POST'
      });
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
      const response = await fetch(`${API}/api/admin/restore-user/${email}`, {
        method: 'POST'
      });
      const result = await response.json();
      
      if (result.status === 'restored') {
        toast.success('User access restored');
        fetchUsers();
        fetchStats();
      } else {
        toast.error('Failed to restore');
      }
    } catch (error) {
      console.error('Error restoring:', error);
      toast.error('Failed to restore user');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  const getKeyTypeColor = (keyType) => {
    switch(keyType) {
      case 'lifetime': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'yearly': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'quarterly': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
      case 'monthly': return 'bg-green-500/20 text-green-400 border-green-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const isExpired = (expiresAt) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const handleLogout = async () => {
    const token = sessionStorage.getItem('admin_token');
    try {
      await fetch(`${API}/api/admin/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
    sessionStorage.removeItem('admin_token');
    setIsAuthenticated(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen  flex items-center justify-center p-6">
        <div className="text-white text-lg">Verifying session...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen  flex items-center justify-center p-6">
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
    { key: 'all', label: 'All Users', color: 'cyan', count: stats.users?.total || 0 },
    { key: 'monthly', label: 'Monthly', color: 'green', count: stats.users?.monthly || 0 },
    { key: 'quarterly', label: 'Quarterly', color: 'cyan', count: stats.users?.quarterly || 0 },
    { key: 'yearly', label: 'Annual', color: 'blue', count: stats.users?.annual || 0 },
    { key: 'cancelled', label: 'Cancelled', color: 'red', count: stats.users?.cancelled || 0 },
  ];

  return (
    <div className="min-h-screen  p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
          <Button 
            variant="outline" 
            className="border-slate-600 text-slate-300"
            onClick={handleLogout}
            data-testid="admin-logout-btn"
          >
            Logout
          </Button>
        </div>

        {/* Main Tab Navigation */}
        <div className="flex gap-2 border-b border-slate-700 pb-2">
          <Button
            variant={activeTab === 'requests' ? 'default' : 'ghost'}
            className={activeTab === 'requests' ? 'bg-cyan-500' : 'text-slate-400'}
            onClick={() => setActiveTab('requests')}
          >
            Trial Requests
          </Button>
          <Button
            variant={activeTab === 'users' ? 'default' : 'ghost'}
            className={activeTab === 'users' ? 'bg-cyan-500' : 'text-slate-400'}
            onClick={() => setActiveTab('users')}
          >
            Users
          </Button>
        </div>

        {/* Trial Requests Tab */}
        {activeTab === 'requests' && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <Card className={`border ${requestFilter === 'pending' ? 'border-yellow-500' : 'border-slate-700'} bg-slate-800/50 cursor-pointer`}
                    onClick={() => setRequestFilter('pending')}>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-yellow-400">{stats.requests?.pending || 0}</p>
                  <p className="text-slate-400 text-sm">Pending</p>
                </CardContent>
              </Card>
              <Card className={`border ${requestFilter === 'approved' ? 'border-green-500' : 'border-slate-700'} bg-slate-800/50 cursor-pointer`}
                    onClick={() => setRequestFilter('approved')}>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-green-400">{stats.requests?.approved || 0}</p>
                  <p className="text-slate-400 text-sm">Approved</p>
                </CardContent>
              </Card>
              <Card className={`border ${requestFilter === 'rejected' ? 'border-red-500' : 'border-slate-700'} bg-slate-800/50 cursor-pointer`}
                    onClick={() => setRequestFilter('rejected')}>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-red-400">{stats.requests?.rejected || 0}</p>
                  <p className="text-slate-400 text-sm">Rejected</p>
                </CardContent>
              </Card>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2">
              {['pending', 'approved', 'rejected', 'all'].map((f) => (
                <Button
                  key={f}
                  variant={requestFilter === f ? 'default' : 'outline'}
                  size="sm"
                  className={requestFilter === f 
                    ? 'bg-cyan-500 hover:bg-cyan-600' 
                    : 'border-slate-600 text-slate-300 hover:bg-slate-700'}
                  onClick={() => setRequestFilter(f)}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Button>
              ))}
              <Button 
                variant="outline" 
                size="sm"
                className="border-slate-600 text-slate-300 ml-auto"
                onClick={() => { fetchRequests(); fetchStats(); }}
              >
                Refresh
              </Button>
            </div>

            {/* Requests List */}
            <Card className="bg-slate-800/90 border-slate-700">
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-8 text-center text-slate-400">Loading...</div>
                ) : requests.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    No {requestFilter === 'all' ? '' : requestFilter} requests found
                  </div>
                ) : (
                  <div className="divide-y divide-slate-700">
                    {requests.map((request, index) => (
                      <div key={index} className="p-4 flex items-center justify-between">
                        <div>
                          <p className="text-white font-medium">{request.email}</p>
                          <p className="text-slate-400 text-sm">
                            Requested: {formatDate(request.created_at)}
                          </p>
                          {request.license_key && (
                            <p className="text-cyan-400 text-sm font-mono">
                              Key: {request.license_key}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {request.status === 'pending' ? (
                            <>
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => handleApprove(request.email)}
                              >
                                Approve (1-mo trial)
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
                                onClick={() => handleReject(request.email)}
                              >
                                Reject
                              </Button>
                            </>
                          ) : (
                            <span className={`px-3 py-1 rounded-full text-sm ${
                              request.status === 'approved' 
                                ? 'bg-green-500/20 text-green-400' 
                                : 'bg-red-500/20 text-red-400'
                            }`}>
                              {request.status}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-5 gap-3">
              {userFilters.map((f) => (
                <Card 
                  key={f.key}
                  className={`border ${userFilter === f.key ? `border-${f.color}-500` : 'border-slate-700'} bg-slate-800/50 cursor-pointer`}
                  onClick={() => setUserFilter(f.key)}
                >
                  <CardContent className="p-3 text-center">
                    <p className={`text-xl font-bold text-${f.color}-400`}>{f.count}</p>
                    <p className="text-slate-400 text-xs">{f.label}</p>
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
                    ? `bg-${f.color}-500 hover:bg-${f.color}-600` 
                    : 'border-slate-600 text-slate-300 hover:bg-slate-700'}
                  onClick={() => setUserFilter(f.key)}
                >
                  {f.label} ({f.count})
                </Button>
              ))}
              <Button 
                variant="outline" 
                size="sm"
                className="border-slate-600 text-slate-300 ml-auto"
                onClick={() => { fetchUsers(); fetchStats(); }}
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
                  <div className="p-8 text-center text-slate-400">
                    No {userFilter} users found
                  </div>
                ) : (
                  <div className="divide-y divide-slate-700">
                    {users.map((user, index) => (
                      <div key={index} className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-white font-medium">{user.email}</p>
                              {user.subscription_tier && (
                                <span className={`px-2 py-0.5 rounded text-xs border ${getKeyTypeColor(user.subscription_tier)}`}>
                                  {user.subscription_tier}
                                </span>
                              )}
                              {user.subscription_status === 'active' && (
                                <span className="px-2 py-0.5 rounded text-xs bg-green-500/20 text-green-400 border border-green-500/30">
                                  active
                                </span>
                              )}
                              {user.subscription_status === 'cancelling' && (
                                <span className="px-2 py-0.5 rounded text-xs bg-orange-500/20 text-orange-400 border border-orange-500/30">
                                  cancelling
                                </span>
                              )}
                              {(user.subscription_status === 'cancelled') && (
                                <span className="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400 border border-red-500/30">
                                  cancelled
                                </span>
                              )}
                              {!user.subscription_status && (
                                <span className="px-2 py-0.5 rounded text-xs bg-slate-500/20 text-slate-400 border border-slate-500/30">
                                  no plan
                                </span>
                              )}
                            </div>
                            {user.phone && (
                              <p className="text-slate-400 text-sm">{user.phone}</p>
                            )}
                            <div className="flex gap-4 mt-1 text-xs text-slate-500">
                              <span>Joined: {formatDate(user.created_at)}</span>
                              {user.cancels_at && <span>Cancels: {formatDate(user.cancels_at)}</span>}
                            </div>
                          </div>
                          <div className="flex gap-2 flex-wrap justify-end">
                            {userFilter === 'cancelled' ? (
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => handleRestoreCancelled(user.email)}
                              >
                                Restore Access
                              </Button>
                            ) : (
                              <>
                                {user.subscription_status === 'active' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
                                    onClick={() => handleCancel(user.email)}
                                  >
                                    Cancel
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-slate-600 text-slate-400 hover:bg-slate-700"
                                  onClick={() => handleArchive(user.email)}
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
          </>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
