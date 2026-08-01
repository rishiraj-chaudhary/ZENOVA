import { Suspense, lazy } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import NotificationToast from "./components/Gamification/NotificationToast.jsx";
import Navbar from "./components/Navbar.jsx";
import Onboarding from "./components/Onboarding.jsx";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { GamificationProvider } from "./context/GamificationContext.jsx";
import { SocketProvider } from "./context/SocketContext.jsx";
import { SpotifyAuthProvider } from "./context/SpotifyAuthContext.jsx";
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";

/**
 * Routes behind auth are lazily loaded: a signed-out visitor on the landing
 * page should not download the playlist editor, the chat client or the charts.
 */
const Gamification = lazy(() => import("./pages/Gamification.jsx"));
const Insights = lazy(() => import("./pages/Insights.jsx"));
const InviteAccept = lazy(() => import("./pages/InviteAccept.jsx"));
const Playlist = lazy(() => import("./pages/Playlist.jsx"));
const Profile = lazy(() => import("./pages/Profile.jsx"));
const Settings = lazy(() => import("./pages/Settings.jsx"));
const SpotifyCallback = lazy(() => import("./components/SpotifyCallback.jsx"));

const FullPageMessage = ({ children }) => (
  <div className="flex min-h-viewport items-center justify-center text-gray-300">
    {children}
  </div>
);

const RequireAuth = ({ children }) => {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
};

const AppRoutes = () => {
  const { loading, needsOnboarding, completeOnboarding } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageMessage>Loading…</FullPageMessage>;

  return (
    <>
      <ErrorBoundary label="the navigation bar">
        <Navbar />
      </ErrorBoundary>
      <ErrorBoundary label="notifications">
        <NotificationToast />
      </ErrorBoundary>

      {/* Blocks the app until the intro is done, so nobody lands on a blank
          chat and no mood is recorded before consent is given. */}
      {needsOnboarding && <Onboarding onComplete={completeOnboarding} />}

      {/* pt-nav clears the fixed navbar. Pages size themselves against
          h-viewport / min-h-viewport, which subtract the same amount — the two
          used to disagree, so every page was 4rem taller than the window and
          the document scrolled behind its own scrolling panes. */}
      <div className="pt-nav">
        <ErrorBoundary resetKey={location.pathname} label="this page">
          <Suspense fallback={<FullPageMessage>Loading…</FullPageMessage>}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/spotify-callback" element={<SpotifyCallback />} />
              <Route path="/invite/:inviteCode" element={<InviteAccept />} />

              {[
                ["/profile", <Profile />],
                ["/playlist", <Playlist />],
                ["/insights", <Insights />],
                ["/gamification", <Gamification />],
                ["/settings", <Settings />],
              ].map(([path, element]) => (
                <Route
                  key={path}
                  path={path}
                  element={<RequireAuth>{element}</RequireAuth>}
                />
              ))}

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </div>
    </>
  );
};

// BrowserRouter wraps the providers so context consumers may use router hooks.
const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <SpotifyAuthProvider>
        <SocketProvider>
          <GamificationProvider>
            <AppRoutes />
          </GamificationProvider>
        </SocketProvider>
      </SpotifyAuthProvider>
    </AuthProvider>
  </BrowserRouter>
);

export default App;
