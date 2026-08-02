import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useGamification } from "../context/GamificationContext.jsx";

const NAV_LINKS = [
  { to: "/profile", label: "Chat", icon: "fa-comment" },
  { to: "/assistant", label: "Assistant", icon: "fa-wand-magic-sparkles" },
  { to: "/plan", label: "Plan", icon: "fa-route" },
  // fa-list-music and fa-gamepad are Font Awesome Pro icons; the free build
  // renders an empty box for both.
  { to: "/playlist", label: "Playlists", icon: "fa-list-ul" },
  { to: "/insights", label: "Patterns", icon: "fa-chart-line" },
  { to: "/gamification", label: "Achievements", icon: "fa-trophy" },
];

const Stat = ({ icon, color, value, label }) => (
  <div className="flex shrink-0 items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-2.5 py-1">
    <i className={`fa-solid ${icon} ${color} text-xs`} aria-hidden="true" />
    <span className="text-sm font-medium tabular-nums text-white">
      <span className="sr-only">{label}: </span>
      {value}
    </span>
  </div>
);

const Navbar = () => {
  const { user, logout } = useAuth();
  const { state, dispatch } = useGamification();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const panelRef = useRef(null);
  const toggleRef = useRef(null);

  // Navigating used to leave the menu open on top of the page it had just
  // opened, covering it until the user hit the toggle again.
  useEffect(() => setMenuOpen(false), [location.pathname]);

  // Escape closes and returns focus to the control that opened it; a pointer
  // anywhere outside dismisses. Neither worked before.
  useEffect(() => {
    if (!menuOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      toggleRef.current?.focus();
    };

    const onPointerDown = (event) => {
      if (panelRef.current?.contains(event.target)) return;
      if (toggleRef.current?.contains(event.target)) return;
      setMenuOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    dispatch({ type: "RESET" });
    navigate("/");
  };

  const linkClass = ({ isActive }) =>
    `whitespace-nowrap rounded-lg px-2.5 py-2 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e94c36] ${
      isActive ? "text-[#e94c36]" : "text-white hover:text-[#e94c36]"
    }`;

  const stats = (
    <>
      <Stat icon="fa-coins" color="text-yellow-400" value={state.points} label="Points" />
      <Stat icon="fa-trophy" color="text-orange-400" value={`L${state.level}`} label="Level" />
      {state.streak > 0 && (
        <Stat icon="fa-fire" color="text-red-400" value={state.streak} label="Day streak" />
      )}
    </>
  );

  return (
    <nav className="fixed inset-x-0 top-0 z-50 bg-[#1e1e1e] shadow-md">
      <div className="mx-auto flex h-nav max-w-7xl items-center justify-between gap-4 px-4">
        <Link
          to={user ? "/profile" : "/"}
          className="shrink-0 text-xl font-bold text-[#e94c36] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e94c36]"
        >
          ZENOVA
        </Link>

        {user ? (
          <>
            {/* lg, not md: at 768px the stats, four links, the gear and the
                logout button did not fit on one line and wrapped over the
                logo. Below this width everything lives in the menu. */}
            <div className="hidden items-center gap-3 lg:flex">
              <div className="flex items-center gap-2">{stats}</div>

              {NAV_LINKS.map((link) => (
                <NavLink key={link.to} to={link.to} className={linkClass} end>
                  {link.label}
                </NavLink>
              ))}

              <NavLink to="/settings" className={linkClass} aria-label="Settings" end>
                <i className="fa-solid fa-gear" aria-hidden="true" />
              </NavLink>

              <button
                type="button"
                onClick={handleLogout}
                className="shrink-0 rounded-md bg-[#e94c36] px-3 py-2 text-sm text-white transition-colors hover:bg-[#ff6347] focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Logout
              </button>
            </div>

            <div className="flex items-center gap-2 lg:hidden">
              {/* Points and level stay visible on small screens; the streak is
                  the first thing to go when space runs out. */}
              <div className="hidden items-center gap-2 sm:flex">{stats}</div>

              <button
                ref={toggleRef}
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                aria-controls="mobile-menu"
                aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
                className="rounded-lg p-2 text-white transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e94c36]"
              >
                <i
                  className={`fa-solid ${menuOpen ? "fa-xmark" : "fa-bars"} w-4`}
                  aria-hidden="true"
                />
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-white transition-colors hover:text-[#e94c36] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e94c36]"
            >
              Login
            </Link>
            <Link
              to="/register"
              className="whitespace-nowrap rounded-md bg-[#e94c36] px-4 py-2 text-white transition-colors hover:bg-[#ff6347] focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Register
            </Link>
          </div>
        )}
      </div>

      {user && menuOpen && (
        <div
          ref={panelRef}
          id="mobile-menu"
          /* Capped and scrollable: on a short screen in landscape the panel ran
             off the bottom and Logout was unreachable. */
          className="scroll-area max-h-[calc(100dvh-var(--nav-h))] overflow-y-auto border-t border-white/10 bg-[#1e1e1e] shadow-lg lg:hidden"
        >
          <div className="flex items-center gap-2 overflow-x-auto px-4 py-3 sm:hidden">
            {stats}
          </div>

          <ul className="pb-2">
            {[...NAV_LINKS, { to: "/settings", label: "Settings", icon: "fa-gear" }].map(
              (link) => (
                <li key={link.to}>
                  <NavLink
                    to={link.to}
                    end
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
                <i
                  className="fa-solid fa-arrow-right-from-bracket w-4"
                  aria-hidden="true"
                />
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
