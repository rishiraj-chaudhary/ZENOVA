import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUserStats } from "../api/gamificationAPI.js";
import AuthField from "../components/AuthField.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useGamification } from "../context/GamificationContext.jsx";
import { useSpotifyAuth } from "../context/SpotifyAuthContext.jsx";
import { hasStoredAuth } from "../utils/authStorage.js";

const PENDING_INVITE_KEY = "pendingInvite";

const takePendingInvite = () => {
  const code = sessionStorage.getItem(PENDING_INVITE_KEY);
  if (code) sessionStorage.removeItem(PENDING_INVITE_KEY);
  return code;
};

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { dispatch } = useGamification();
  const { login: loginWithSpotify } = useSpotifyAuth();

  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // A user who followed an invite link while signed out lands here; send them
  // straight on if they already have a session.
  useEffect(() => {
    const pendingInvite = takePendingInvite();
    if (pendingInvite && hasStoredAuth()) navigate(`/invite/${pendingInvite}`);
  }, [navigate]);

  const updateField = (field) => (event) =>
    setCredentials((current) => ({ ...current, [field]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const profile = await login(credentials);

      // Seeds the navbar counters so they are correct before the first
      // realtime event arrives. A failure here must not block the login.
      try {
        const stats = await getUserStats();
        dispatch({ type: "SET_STATS", payload: stats });
      } catch (statsError) {
        console.error("Could not load gamification stats:", statsError.message);
      }

      const pendingInvite = takePendingInvite();
      navigate(pendingInvite ? `/invite/${pendingInvite}` : "/profile", {
        state: { userId: profile._id },
      });
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#121212] text-white p-4">
      <div className="w-full max-w-md p-8 space-y-8 bg-[#1e1e1e] rounded-2xl shadow-lg">
        <h2 className="text-3xl font-bold text-center text-[#e94c36]">Welcome Back</h2>

        {error && (
          <p role="alert" className="text-sm text-center text-red-400">
            {error}
          </p>
        )}

        <form className="space-y-6" onSubmit={handleSubmit}>
          <AuthField
            type="email"
            placeholder="Email"
            value={credentials.email}
            onChange={updateField("email")}
          />
          <AuthField
            type="password"
            placeholder="Password"
            value={credentials.password}
            onChange={updateField("password")}
          />

          <button
            type="submit"
            disabled={submitting}
            className="w-full p-3 bg-[#e94c36] hover:bg-[#ff6347] disabled:opacity-60 text-white rounded-full font-semibold transition-all duration-300"
          >
            {submitting ? "Signing in…" : "Login"}
          </button>

          <button
            type="button"
            onClick={() => loginWithSpotify("login")}
            className="w-full p-3 bg-[#1DB954] hover:bg-[#1ed760] text-white rounded-full font-semibold transition-all duration-300"
          >
            Login with Spotify
          </button>
        </form>

        <p className="text-center text-sm">
          Don&apos;t have an account?{" "}
          <button
            type="button"
            onClick={() => navigate("/register")}
            className="text-orange-400 hover:underline"
          >
            Register
          </button>
        </p>
      </div>
    </div>
  );
};

export default Login;
