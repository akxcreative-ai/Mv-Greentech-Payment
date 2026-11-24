import { create } from 'zustand';
import { User, Role } from '@/types';
import { authService, normalizeUser } from '@/services/authService';

const AUTH_TOKEN_KEY = 'mv_payment_token';
const AUTH_USER_KEY = 'mv_payment_user';

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  /**
   * Primary authentication action:
   * Accepts (email, password) to call the backend authentication API,
   * or (user, token) for immediate state hydration.
   */
  login: (emailOrUser: string | User, passwordOrToken?: string) => Promise<void>;

  /**
   * Terminate current session: clear state and call logout API
   */
  logout: () => Promise<void>;

  /**
   * Update or initialize user profile
   */
  setUser: (user: User | null) => void;

  /**
   * Update partial fields of current user profile
   */
  updateUser: (updatedUser: Partial<User>) => void;

  /**
   * Refresh access token in memory via refresh token / httpOnly cookie
   */
  refreshToken: () => Promise<string | null>;

  /**
   * Verify token validity or attempt silent refresh on application initialization
   */
  checkAuth: () => Promise<boolean>;

  /**
   * Convenience permission verification helper
   */
  hasRole: (roles: Role | Role[]) => boolean;
}

// Read persisted session on initial boot
function getInitialState() {
  try {
    const storedToken = localStorage.getItem(AUTH_TOKEN_KEY);
    const storedUserRaw = localStorage.getItem(AUTH_USER_KEY);
    if (storedToken && storedUserRaw) {
      const user = normalizeUser(JSON.parse(storedUserRaw));
      return {
        token: storedToken,
        user,
        isAuthenticated: true,
      };
    }
  } catch (err) {
    console.warn('Could not read stored auth state:', err);
  }
  return {
    token: null,
    user: null,
    isAuthenticated: false,
  };
}

const initial = getInitialState();

export const useAuthStore = create<AuthState>((set, get) => ({
  user: initial.user,
  token: initial.token,
  isAuthenticated: initial.isAuthenticated,
  isLoading: false,

  login: async (emailOrUser: string | User, passwordOrToken?: string) => {
    if (typeof emailOrUser === 'string') {
      const email = emailOrUser;
      const password = passwordOrToken || '';
      set({ isLoading: true });
      try {
        const response = await authService.login(email, password);
        const token = response.token;
        const user = response.user;

        if (token) {
          localStorage.setItem(AUTH_TOKEN_KEY, token);
        }
        if (user) {
          localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
        }

        set({
          user,
          token,
          isAuthenticated: Boolean(token && user),
          isLoading: false,
        });
      } catch (error) {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(AUTH_USER_KEY);
        set({ isLoading: false, user: null, token: null, isAuthenticated: false });
        throw error;
      }
    } else {
      // Direct hydration support (e.g., demo/mock logins)
      const user = normalizeUser(emailOrUser);
      const token = passwordOrToken || `mv_demo_token_${user.role.toLowerCase()}`;

      localStorage.setItem(AUTH_TOKEN_KEY, token);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));

      set({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
      });
    }
  },

  logout: async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.warn('Logout network notice:', error);
    } finally {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_USER_KEY);
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  setUser: (user: User | null) => {
    const normalized = user ? normalizeUser(user) : null;
    if (normalized) {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(normalized));
    } else {
      localStorage.removeItem(AUTH_USER_KEY);
    }
    set({
      user: normalized,
      isAuthenticated: Boolean(normalized && get().token),
    });
  },

  updateUser: (updatedUser: Partial<User>) => {
    const currentUser = get().user;
    if (!currentUser) return;
    const merged = { ...currentUser, ...updatedUser };
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(merged));
    set({ user: merged });
  },

  refreshToken: async (): Promise<string | null> => {
    try {
      const currentToken = get().token;
      // If demo token, don't ping backend refresh
      if (currentToken?.startsWith('mv_demo_')) {
        return currentToken;
      }

      const result = await authService.refreshToken();
      if (result && result.token) {
        localStorage.setItem(AUTH_TOKEN_KEY, result.token);
        if (result.user) {
          localStorage.setItem(AUTH_USER_KEY, JSON.stringify(result.user));
        }
        set({
          token: result.token,
          ...(result.user ? { user: result.user } : {}),
          isAuthenticated: true,
        });
        return result.token;
      }
      return null;
    } catch {
      // Don't wipe demo session on refresh error
      const token = get().token;
      if (token?.startsWith('mv_demo_')) {
        return token;
      }
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_USER_KEY);
      set({
        user: null,
        token: null,
        isAuthenticated: false,
      });
      return null;
    }
  },

  checkAuth: async (): Promise<boolean> => {
    const currentToken = get().token || localStorage.getItem(AUTH_TOKEN_KEY);

    if (currentToken) {
      // If it's a demo session, keep it valid!
      if (currentToken.startsWith('mv_demo_')) {
        set({ isAuthenticated: true });
        return true;
      }

      try {
        const profile = await authService.getProfile();
        set({ user: profile, token: currentToken, isAuthenticated: true });
        return true;
      } catch {
        // Token may be expired, attempt refresh
        const refreshedToken = await get().refreshToken();
        return Boolean(refreshedToken);
      }
    }
    return false;
  },

  hasRole: (roles: Role | Role[]): boolean => {
    const user = get().user;
    if (!user) return false;
    const userRole = String(user.role).toUpperCase();
    if (Array.isArray(roles)) {
      return roles.some((r) => String(r).toUpperCase() === userRole);
    }
    return String(roles).toUpperCase() === userRole;
  },
}));

export default useAuthStore;
