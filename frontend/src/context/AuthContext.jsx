import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as authAPI from "../api/authAPI.js";
import { fetchUserProfile } from "../api/userAPI.js";
import { clearStoredAuth, hasStoredAuth, storeAuth } from "../utils/authStorage.js";

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restores the session on reload. A failed lookup means the stored token is
  // stale, so it is discarded rather than left to fail every later request.
  useEffect(() => {
    const restoreSession = async () => {
      if (!hasStoredAuth()) {
        setLoading(false);
        return;
      }

      try {
        setUser(await fetchUserProfile());
      } catch {
        clearStoredAuth();
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  const login = useCallback(async (credentials) => {
    const { user: authenticatedUser } = await authAPI.login(credentials);
    const { token, ...profile } = authenticatedUser;

    storeAuth({ token, userId: profile._id });
    setUser(profile);

    return profile;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      // The local session must be cleared even if the server call fails.
      console.error("Logout request failed:", error.message);
    } finally {
      clearStoredAuth();
      setUser(null);
    }
  }, []);

  /** Replaces the profile once the intro flow has been completed. */
  const completeOnboarding = useCallback((profile) => setUser(profile), []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      // Existing accounts predate onboarding, so only a profile that has been
      // loaded and has no onboardedAt should be prompted.
      needsOnboarding: Boolean(user) && !user.onboardedAt,
      login,
      logout,
      completeOnboarding,
    }),
    [user, loading, login, logout, completeOnboarding]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};

export default AuthContext;
