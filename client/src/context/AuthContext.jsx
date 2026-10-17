/**
 * FixIt Now - Authentication Context
 * Manages active user session, JWT token, user roles, and authentication lifecycle.
 * Conforms to docs/SRS.md Section 5, Section 3.1-3.4 & docs/PLAN.md Phase 3.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { get, post } from '../services/api';

const AuthContext = createContext(null);

const TOKEN_KEY = 'fixit_token';
const USER_KEY = 'fixit_user';
const ROLE_KEY = 'fixit_role';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [role, setRole] = useState(() => {
    try {
      return localStorage.getItem(ROLE_KEY) || null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem(TOKEN_KEY) || null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(true);

  // Synchronize state with persistent storage
  const setSession = (newToken, newUser, newRole) => {
    if (newToken) {
      localStorage.setItem(TOKEN_KEY, newToken);
      setToken(newToken);
    } else {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
    }

    if (newUser) {
      localStorage.setItem(USER_KEY, JSON.stringify(newUser));
      setUser(newUser);
    } else {
      localStorage.removeItem(USER_KEY);
      setUser(null);
    }

    if (newRole) {
      localStorage.setItem(ROLE_KEY, newRole);
      setRole(newRole);
    } else {
      localStorage.removeItem(ROLE_KEY);
      setRole(null);
    }

    if (newRole === 'customer' && newUser) {
      localStorage.setItem('fixit_customer_user', JSON.stringify(newUser));
    } else if (newRole === 'partner' && newUser) {
      localStorage.setItem('fixit_partner_user', JSON.stringify(newUser));
      localStorage.setItem('fixit_current_partner', JSON.stringify(newUser));
    } else if (newRole === 'admin' && newUser) {
      localStorage.setItem('fixit_admin_session', JSON.stringify(newUser));
    }
  };

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem('fixit_customer_user');
    localStorage.removeItem('fixit_partner_user');
    localStorage.removeItem('fixit_current_partner');
    localStorage.removeItem('fixit_admin_session');
    setToken(null);
    setUser(null);
    setRole(null);
  }, []);

  const reloadSession = useCallback(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);
    const storedRole = localStorage.getItem(ROLE_KEY);
    if (storedToken && storedUser && storedRole) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        setRole(storedRole);
      } catch {
        // ignore
      }
    } else {
      setToken(null);
      setUser(null);
      setRole(null);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('fixit_auth_change', reloadSession);
    window.addEventListener('storage', reloadSession);
    return () => {
      window.removeEventListener('fixit_auth_change', reloadSession);
      window.removeEventListener('storage', reloadSession);
    };
  }, [reloadSession]);

  // Verify active JWT token on mount via GET /api/auth/me
  useEffect(() => {
    let isMounted = true;
    async function verifySession() {
      const existingToken = localStorage.getItem(TOKEN_KEY);
      if (!existingToken) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        const response = await get('/api/auth/me');
        if (response && response.user && isMounted) {
          setUser(response.user);
          setRole(response.user.role);
          localStorage.setItem(USER_KEY, JSON.stringify(response.user));
          localStorage.setItem(ROLE_KEY, response.user.role);
          if (response.user.role === 'partner') {
            localStorage.setItem('fixit_partner_user', JSON.stringify(response.user));
            localStorage.setItem('fixit_current_partner', JSON.stringify(response.user));
          }
        }
      } catch (err) {
        console.warn('[Session Verification Failed]:', err.message);
        if (isMounted) {
          logout();
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    verifySession();
    return () => {
      isMounted = false;
    };
  }, [logout]);

  // Customer Login
  const loginCustomer = async (email, password) => {
    const res = await post('/api/auth/customer/login', { email, password });
    if (res.token && res.user) {
      setSession(res.token, res.user, 'customer');
    }
    return res.user;
  };

  // Customer Register
  const registerCustomer = async (data) => {
    const res = await post('/api/auth/customer/register', data);
    if (res.token && res.user) {
      setSession(res.token, res.user, 'customer');
    }
    return res.user;
  };

  // Partner Login
  const loginPartner = async (email, password) => {
    const res = await post('/api/auth/partner/login', { email, password });
    if (res.token && res.user) {
      setSession(res.token, res.user, 'partner');
    }
    return res.user;
  };

  // Partner Register
  const registerPartner = async (data) => {
    const res = await post('/api/auth/partner/register', data);
    if (res.token && res.user) {
      setSession(res.token, res.user, 'partner');
    }
    return res.user;
  };

  // Admin Login (Separate /api/admin/login)
  const loginAdmin = async (email, password) => {
    const res = await post('/api/admin/login', { email, password });
    if (res.token && res.user) {
      setSession(res.token, res.user, 'admin');
    }
    return res.user;
  };

  const value = {
    user,
    role,
    token,
    isAuthenticated: Boolean(token && user),
    loading,
    loginCustomer,
    registerCustomer,
    loginPartner,
    registerPartner,
    loginAdmin,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
