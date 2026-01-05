import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;
const ADMIN_PASSWORD = 'cyclecoach2024';

const AdminDashboard = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [requests, setRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('pending');
  const [activeTab, setActiveTab] = useState('requests'); // 'requests' or 'users'

  useEffect(() => {
    const auth = sessionStorage.getItem('admin_auth');
    if (auth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      if (activeTab === 'requests') {
        fetchRequests();
      } else {
        fetchUsers();
      }
    }
  }, [isAuthenticated, filter, activeTab]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem('admin_auth', 'true');
      toast.success('Admin access granted');
    } else {
      toast.error('Invalid password');
    }
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const url = filter === 'all' 
        ? `${API}/api/trial/requests`
        : `${API}/api/trial/requests?status=${filter}`;
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
      const response = await fetch(`${API}/api/admin/users`);
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
      } else {
        toast.error('Failed to grant key');
      }
    } catch (error) {
      console.error('Error granting key:', error);
      toast.error('Failed to grant key');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  const getKeyTypeColor = (keyType) => {
    switch(keyType) {
      case 'lifetime': return 'bg-purple-500/20 text-purple-400';
      case 'yearly': return 'bg-blue-500/20 text-blue-400';
      case 'trial': return 'bg-yellow-500/20 text-yellow-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  };

  const isExpired = (expiresAt) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
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
              />
              <Button type="submit" className="w-full bg-cyan-500 hover:bg-cyan-600">
                Login
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
          <Button 
            variant="outline" 
            className="border-slate-600 text-slate-300"
            onClick={() => {
              sessionStorage.removeItem('admin_auth');
              setIsAuthenticated(false);
            }}
          >
            Logout
          </Button>
        </div>

        {/* Tab Navigation */}
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
            All Users & Keys
          </Button>
        </div>

        {/* Trial Requests Tab */}
        {activeTab === 'requests' && (
          <>
            {/* Filter Tabs */}
            <div className="flex gap-2">
              {['pending', 'approved', 'rejected', 'all'].map((f) => (
                <Button
                  key={f}
                  variant={filter === f ? 'default' : 'outline'}
                  size="sm"
                  className={filter === f 
                    ? 'bg-cyan-500 hover:bg-cyan-600' 
                    : 'border-slate-600 text-slate-300 hover:bg-slate-700'}
                  onClick={() => setFilter(f)}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Button>
              ))}
              <Button 
                variant="outline" 
                size="sm"
                className="border-slate-600 text-slate-300 ml-auto"
                onClick={fetchRequests}
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
                    No {filter === 'all' ? '' : filter} requests found
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
            <div className="flex justify-end">
              <Button 
                variant="outline" 
                size="sm"
                className="border-slate-600 text-slate-300"
                onClick={fetchUsers}
              >
                Refresh
              </Button>
            </div>

            <Card className="bg-slate-800/90 border-slate-700">
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-8 text-center text-slate-400">Loading...</div>
                ) : users.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">No users found</div>
                ) : (
                  <div className="divide-y divide-slate-700">
                    {users.map((user, index) => (
                      <div key={index} className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-white font-medium">{user.customer_email}</p>
                              <span className={`px-2 py-0.5 rounded text-xs ${getKeyTypeColor(user.key_type)}`}>
                                {user.key_type || 'standard'}
                              </span>
                              {user.is_trial && (
                                <span className="px-2 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-400">
                                  trial
                                </span>
                              )}
                              {isExpired(user.expires_at) && (
                                <span className="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400">
                                  expired
                                </span>
                              )}
                            </div>
                            <p className="text-cyan-400 text-sm font-mono">{user.license_key}</p>
                            <div className="flex gap-4 mt-1 text-xs text-slate-500">
                              <span>Created: {formatDate(user.created_at)}</span>
                              <span>Expires: {user.expires_at ? formatDate(user.expires_at) : 'Never'}</span>
                              <span>Activations: {user.activation_count || 0}</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="bg-purple-600 hover:bg-purple-700"
                              onClick={() => handleGrantKey(user.customer_email, 'lifetime')}
                            >
                              Grant Lifetime
                            </Button>
                            <Button
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700"
                              onClick={() => handleGrantKey(user.customer_email, 'yearly')}
                            >
                              Grant Yearly
                            </Button>
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

        {/* Stats */}
        {activeTab === 'requests' && (
          <div className="grid grid-cols-3 gap-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-yellow-400">
                  {requests.filter(r => r.status === 'pending').length}
                </p>
                <p className="text-slate-400 text-sm">Pending</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-green-400">
                  {requests.filter(r => r.status === 'approved').length}
                </p>
                <p className="text-slate-400 text-sm">Approved</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-red-400">
                  {requests.filter(r => r.status === 'rejected').length}
                </p>
                <p className="text-slate-400 text-sm">Rejected</p>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="grid grid-cols-4 gap-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-white">{users.length}</p>
                <p className="text-slate-400 text-sm">Total Users</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-yellow-400">
                  {users.filter(u => u.key_type === 'trial').length}
                </p>
                <p className="text-slate-400 text-sm">Trial</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-blue-400">
                  {users.filter(u => u.key_type === 'yearly').length}
                </p>
                <p className="text-slate-400 text-sm">Yearly</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-purple-400">
                  {users.filter(u => u.key_type === 'lifetime').length}
                </p>
                <p className="text-slate-400 text-sm">Lifetime</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
