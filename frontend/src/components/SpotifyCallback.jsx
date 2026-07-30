import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSpotifyAuth } from "../context/SpotifyAuthContext.jsx";

const REDIRECT_DELAY_MS = 2000;

const SpotifyCallback = () => {
  const [status, setStatus] = useState("Processing authentication…");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { handleCallback } = useSpotifyAuth();

  useEffect(() => {
    let redirectTimer;

    const finishAuthentication = async () => {
      const code = searchParams.get("code");

      if (!code) {
        setStatus("Authentication failed: no code provided");
        return;
      }

      const succeeded = await handleCallback(code, searchParams.get("state"));

      setStatus(
        succeeded
          ? "Authentication successful! Redirecting…"
          : "Authentication failed. Please try again."
      );

      if (succeeded) {
        redirectTimer = setTimeout(() => navigate("/profile"), REDIRECT_DELAY_MS);
      }
    };

    finishAuthentication();

    return () => clearTimeout(redirectTimer);
  }, [searchParams, handleCallback, navigate]);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-[#181818]">
      <div className="bg-[#252525] p-8 rounded-lg shadow-lg max-w-md w-full">
        <h2 className="text-2xl font-bold text-white mb-4">Spotify Authentication</h2>
        <p className="text-gray-300">{status}</p>
        <div className="mt-4 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#1DB954]" />
        </div>
      </div>
    </div>
  );
};

export default SpotifyCallback;
