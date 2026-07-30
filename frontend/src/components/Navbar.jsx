import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useGamification } from "../context/GamificationContext.jsx";

const NAV_LINKS = [
  { to: "/profile", label: "Chat", icon: "fa-comment" },
  { to: "/playlist", label: "Playlists", icon: "fa-list-music" },
  { to: "/insights", label: "Patterns", icon: "fa-chart-line" },
  { to: "/gamification", label: "Achievements", icon: "fa-gamepad" },
];

const Stat = ({ icon, color, value, label }) => (
  <div className="flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-1">
    <i className={`fa-solid ${icon} ${color} text-sm`} aria-hidden="true" />
    <span className="text-sm font-medium text-white">
      <span className="sr-only">{label}: </span>
      {value}
    </span>
  </div>
);

const Navbar = () => {
  const { user, logout } = useAuth();
  const { state, dispatch } = useGamification();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    dispatch({ type: "RESET" });
    navigate("/");
  };

  const linkClass = ({ isActive }) =>
    `rounded-lg px-3 py-2 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e94c36] ${
      isActive ? "text-[#e94c36]" : "text-white hover:text-[#e94c36]"
    }`;

  return (
    <nav className="fixed inset-x-0 top-0 z-50 bg-[#1e1e1e] shadow-md">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex h-16 items-center justify-between">
          <Link
            to="/"
            className="text-xl font-bold text-[#e94c36] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e94c36]"
          >
            ZENOVA
          </Link>

          {user ? (
            <>
              <div className="hidden items-center gap-4 md:flex">
                <div className="flex items-center gap-2">
                  <Stat icon="fa-coins" color="text-yellow-400" value={state.points} label="Points" />
                  <Stat icon="fa-trophy" color="text-orange-400" value={`L${state.level}`} label="Level" />
                  {state.streak > 0 && (
                    <Stat icon="fa-fire" color="text-red-400" value={state.streak} label="Day streak" />
                  )}
                </div>

                {NAV_LINKS.map((link) => (
                  <NavLink key={link.to} to={link.to} className={linkClass}>
                    {link.label}
                  </NavLink>
                ))}

                <NavLink to="/settings" className={linkClass} aria-label="Settings">
                  <i className="fa-solid fa-gear" aria-hidden="true" />
                </NavLink>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-md bg-[#e94c36] px-4 py-2 text-white transition-colors hover:bg-[#ff6347]"
                >
                  Logout
                </button>
              </div>

              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                aria-controls="mobile-menu"
                aria-label="Toggle navigation menu"
                className="rounded-lg p-2 text-white transition-colors hover:bg-white/10 md:hidden"
              >
                <i className={`fa-solid ${menuOpen ? "fa-xmark" : "fa-bars"}`} aria-hidden="true" />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-4">
              <Link to="/login" className="text-white transition-colors hover:text-[#e94c36]">
                Login
              </Link>
              <Link
                to="/register"
                className="rounded-md bg-[#e94c36] px-4 py-2 text-white transition-colors hover:bg-[#ff6347]"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </div>

      {user && menuOpen && (
        <div id="mobile-menu" className="border-t border-white/10 bg-[#1e1e1e] md:hidden">
          <div className="flex items-center gap-2 px-4 py-3">
            <Stat icon="fa-coins" color="text-yellow-400" value={state.points} label="Points" />
            <Stat icon="fa-trophy" color="text-orange-400" value={`L${state.level}`} label="Level" />
            {state.streak > 0 && (
              <Stat icon="fa-fire" color="text-red-400" value={state.streak} label="Day streak" />
            )}
          </div>

          <ul className="pb-3">
            {[...NAV_LINKS, { to: "/settings", label: "Settings", icon: "fa-gear" }].map(
              (link) => (
                <li key={link.to}>
                  <NavLink
                    to={link.to}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-3 text-sm ${
                        isActive ? "bg-white/5 text-[#e94c36]" : "text-white hover:bg-white/5"
                      }`
                    }
                  >
                    <i className={`fa-solid ${link.icon} w-4`} aria-hidden="true" />
                    {link.label}
                  </NavLink>
                </li>
              )
            )}
            <li>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-3 px-4 py-3 text-sm text-white hover:bg-white/5"
              >
                <i className="fa-solid fa-arrow-right-from-bracket w-4" aria-hidden="true" />
                Logout
              </button>
            </li>
          </ul>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
