import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useSpotifyAuth } from "../context/SpotifyAuthContext.jsx";

const REDIRECT_DELAY_MS = 1200;

/**
 * Finishes a Spotify OAuth round trip.
 *
 * The server decides what the flow was, from the intent recorded when it
 * started, and this page follows: a sign-in gets adopted as a ZENOVA session
 * and lands in the app; a connect or playback-only exchange just stores the
 * tokens. Every outcome used to be treated as the last one, so "Login with
 * Spotify" stored tokens, announced "Authentication successful!", and dropped
 * the visitor back on the login page with no account.
 */
const SpotifyCallback = () => {
  const [status, setStatus] = useState("Finishing sign-in…");
  const [failed, setFailed] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { handleCallback } = useSpotifyAuth();
  const { adoptSession } = useAuth();

  useEffect(() => {
    let redirectTimer;

    const finishAuthentication = async () => {
      const code = searchParams.get("code");
      const denied = searchParams.get("error");

      if (denied) {
        setFailed(true);
        setStatus("Spotify sign-in was cancelled.");
        return;
      }

      if (!code) {
        setFailed(true);
        setStatus("Spotify did not send an authorization code.");
        return;
      }

      const result = await handleCallback(code, searchParams.get("state"));

      if (!result.ok) {
        setFailed(true);
        setStatus(result.message ?? "Spotify sign-in failed. Please try again.");
        return;
      }

      if (result.user && result.refreshToken) {
        const profile = adoptSession(result);
        setStatus(
          result.created
            ? `Welcome to ZENOVA, ${profile.name}!`
            : `Welcome back, ${profile.name}!`
        );
        redirectTimer = setTimeout(
          () => navigate("/", { replace: true }),
          REDIRECT_DELAY_MS
        );
        return;
      }

      setStatus(
        result.linked ? "Spotify connected to your account." : "Spotify connected."
      );
      redirectTimer = setTimeout(() => navigate("/profile"), REDIRECT_DELAY_MS);
    };

    finishAuthentication();

    return () => clearTimeout(redirectTimer);
  }, [searchParams, handleCallback, adoptSession, navigate]);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-[#181818]">
      <div className="bg-[#252525] p-8 rounded-lg shadow-lg max-w-md w-full">
        <h2 className="text-2xl font-bold text-white mb-4">Spotify</h2>
        <p className="text-gray-300">{status}</p>

        {failed ? (
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="mt-6 w-full p-3 bg-[#1DB954] hover:bg-[#1ed760] text-white rounded-full font-semibold transition-all duration-300"
          >
            Back to sign in
          </button>
        ) : (
          <div className="mt-4 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#1DB954]" />
          </div>
        )}
      </div>
    </div>
  );
};

export default SpotifyCallback;
