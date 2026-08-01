import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as authAPI from "../api/authAPI.js";
import { onSessionEnded, refreshSession } from "../api/client.js";
import { fetchUserProfile } from "../api/userAPI.js";
import { clearStoredAuth, hasStoredAuth, storeAuth } from "../utils/authStorage.js";

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /**
   * Restores the session on reload.
   *
   * The access token lives in memory, so a reload always starts without one.
   * A refresh is attempted first; if the refresh token is gone or revoked the
   * user is genuinely signed out.
   */
  useEffect(() => {
    const restoreSession = async () => {
      if (!hasStoredAuth()) {
        setLoading(false);
        return;
      }

      try {
        await refreshSession();
        setUser(await fetchUserProfile());
      } catch {
        clearStoredAuth();
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  // The API client ends the session when a refresh fails; mirror that here so
  // the UI drops to signed-out instead of rendering with a stale user.
  useEffect(() => onSessionEnded(() => setUser(null)), []);

  const login = useCallback(async (credentials) => {
    const { user: authenticatedUser, refreshToken } = await authAPI.login(credentials);
    const { token, ...profile } = authenticatedUser;

    storeAuth({ token, userId: profile._id, refreshToken });
    setUser(profile);

    return profile;
  }, []);

  /**
   * Adopts a session established by a flow that authenticated elsewhere —
   * today, signing in with Spotify, where the server does the find-or-create
   * and hands back the same payload the password login returns.
   */
  const adoptSession = useCallback(({ user: authenticatedUser, refreshToken }) => {
    const { token, ...profile } = authenticatedUser;

    storeAuth({ token, userId: profile._id, refreshToken });
    setUser(profile);
    return profile;
  }, []);

  /**
   * Mirrors a consent change into the session the rest of the app reads.
   *
   * Settings wrote consent to the server and stopped there, so the daily
   * check-in card — the whole point of turning it on — stayed hidden until a
   * full page reload.
   */
  const applyConsent = useCallback((moodTracking) => {
    setUser((current) =>
      current
        ? {
            ...current,
            consent: {
              moodTracking,
              grantedAt: moodTracking
                ? current.consent?.grantedAt ?? new Date().toISOString()
                : null,
            },
          }
        : current
    );
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
      adoptSession,
      applyConsent,
      logout,
      completeOnboarding,
    }),
    [user, loading, login, adoptSession, applyConsent, logout, completeOnboarding]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};

export default AuthContext;
