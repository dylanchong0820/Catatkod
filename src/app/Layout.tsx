import { useEffect, useState } from "react";
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { Icon, LanguageToggle, type IconName } from "./ui";
import { useStore } from "./store";

export function AppShell() {
  const { authenticated, history, language, logout, settings, syncStatus } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [locked, setLocked] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState("");
  const isBm = language === "bm";
  const draftCount = history.filter(
    (record) => record.status === "Draf" && record.lastEditedBy === settings.displayName
  ).length;

  useEffect(() => {
    if (locked || !authenticated) return;
    let timeout = window.setTimeout(() => setLocked(true), 10 * 60 * 1000);
    const resetTimeout = () => {
      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => setLocked(true), 10 * 60 * 1000);
    };
    const events = ["mousedown", "keydown", "touchstart", "scroll"] as const;
    events.forEach((event) => window.addEventListener(event, resetTimeout, { passive: true }));
    return () => {
      window.clearTimeout(timeout);
      events.forEach((event) => window.removeEventListener(event, resetTimeout));
    };
  }, [authenticated, locked]);

  if (!authenticated) return <Navigate replace to="/login" />;

  const navItems: { to: string; label: string; icon: IconName }[] = [
    { to: "/utama", label: isBm ? "Utama" : "Home", icon: "home" },
    { to: "/rekod", label: isBm ? "Rekod" : "Records", icon: "history" },
  ];
  const lowerItems: { to: string; label: string; icon: IconName }[] = [
    { to: "/bantuan", label: isBm ? "Bantuan & panduan" : "Help & guidance", icon: "help" },
    { to: "/tetapan", label: isBm ? "Tetapan" : "Settings", icon: "settings" },
  ];

  function toggleNavigation() {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      setCollapsed((current) => !current);
    } else {
      setMenuOpen((current) => !current);
    }
  }

  function signOut() {
    setLocked(false);
    setUnlockPassword("");
    logout();
    navigate("/login");
  }

  const linkClass = (isActive: boolean) =>
    `flex w-full items-center gap-3 rounded px-3 py-2.5 text-sm font-medium ${
      collapsed ? "lg:justify-center lg:gap-0 lg:px-2" : ""
    } ${isActive ? "bg-[#E3ECE9] text-[#1F5446]" : "text-[#354B46] hover:bg-[#F1F4F3]"}`;

  return (
    <div
      className={`min-h-screen bg-[#EAF1F0] text-[#1A1A1A] ${
        settings.textSize === "large" ? "app-text-large" : ""
      }`}
    >
      <header className="sticky top-0 z-30 flex h-16 items-center border-b border-[#C9D1CF] bg-white px-4 sm:px-6">
        <button
          aria-label={isBm ? "Buka atau kecilkan menu" : "Open or collapse menu"}
          className="mr-3 rounded p-2 text-[#405955] hover:bg-[#EDF2F1]"
          onClick={toggleNavigation}
        >
          <Icon name="menu" size={20} />
        </button>
        <div className="flex items-center gap-2 text-[22px] font-extrabold leading-none tracking-[-0.01em] text-[#1F5446]">
          <img alt="" className="h-8 w-8" src="/favicon.svg" />
          CatatKod
        </div>
        <div className="ml-auto flex items-center gap-3 sm:gap-5">
          <LanguageToggle />
          <span className="hidden text-sm text-[#263B37] sm:inline">
            {settings.displayName}, {isBm ? "Jururawat U29" : "Nurse U29"}
          </span>
          <button
            className="text-xs font-semibold text-[#1F5446] underline-offset-2 hover:underline sm:text-sm"
            onClick={signOut}
          >
            {isBm ? "Log keluar" : "Sign out"}
          </button>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-4rem)]">
        {menuOpen && (
          <button
            aria-label={isBm ? "Tutup menu" : "Close menu"}
            className="fixed inset-0 z-30 bg-black/20 lg:hidden"
            onClick={() => setMenuOpen(false)}
          />
        )}
        <aside
          className={`fixed bottom-0 left-0 top-16 z-40 flex w-60 flex-col border-r border-[#C9D1CF] bg-white p-3 transition-[transform,width] duration-200 lg:sticky lg:z-20 lg:h-[calc(100vh-4rem)] lg:shrink-0 lg:translate-x-0 ${
            collapsed ? "lg:w-16" : "lg:w-60"
          } ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          <div className="mb-2 flex items-center justify-end lg:hidden">
            <button
              aria-label={isBm ? "Tutup menu" : "Close menu"}
              className="rounded p-2 text-[#405955]"
              onClick={() => setMenuOpen(false)}
            >
              <Icon name="close" size={18} />
            </button>
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = item.to === "/utama"
                ? location.pathname === "/utama" || location.pathname.startsWith("/pesakit/")
                : item.to === "/rekod"
                  ? location.pathname.startsWith("/rekod")
                  : location.pathname === item.to;
              return (
                <div key={item.to}>
                  <NavLink
                    className={linkClass(isActive)}
                    onClick={() => setMenuOpen(false)}
                    title={collapsed ? item.label : undefined}
                    to={item.to}
                  >
                    <Icon name={item.icon} size={18} />
                    <span className={collapsed ? "lg:hidden" : ""}>{item.label}</span>
                  </NavLink>
                  {item.to === "/rekod" && isActive && (
                    <div className={`mt-1 space-y-1 pl-8 ${collapsed ? "lg:hidden" : ""}`}>
                      <NavLink
                        className={`flex items-center rounded px-3 py-2 text-xs font-medium ${
                          location.pathname !== "/rekod/draf"
                            ? "bg-[#E3ECE9] text-[#1F5446]"
                            : "text-[#52635F] hover:bg-[#F1F4F3]"
                        }`}
                        onClick={() => setMenuOpen(false)}
                        to="/rekod"
                      >
                        {isBm ? "Semua rekod" : "All records"}
                      </NavLink>
                      <NavLink
                        className={`flex items-center justify-between gap-2 rounded px-3 py-2 text-xs font-medium ${
                          location.pathname === "/rekod/draf"
                            ? "bg-[#E3ECE9] text-[#1F5446]"
                            : "text-[#52635F] hover:bg-[#F1F4F3]"
                        }`}
                        onClick={() => setMenuOpen(false)}
                        to="/rekod/draf"
                      >
                        <span>{isBm ? "Draf saya" : "My drafts"}</span>
                        {draftCount > 0 && (
                          <span className="rounded-full bg-[#DCE7E4] px-1.5 py-0.5 text-[10px] font-bold text-[#1F5446]">
                            {draftCount}
                          </span>
                        )}
                      </NavLink>
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
          <nav className="mt-auto space-y-1 border-t border-[#DCE3E1] pt-3">
            {lowerItems.map((item) => (
              <NavLink
                className={({ isActive }) => linkClass(isActive)}
                key={item.to}
                onClick={() => setMenuOpen(false)}
                title={collapsed ? item.label : undefined}
                to={item.to}
              >
                <Icon name={item.icon} size={18} />
                <span className={collapsed ? "lg:hidden" : ""}>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <Outlet />
          <footer className="border-t border-[#C9D1CF] bg-[#EAF1F0] px-4 py-3 text-center text-[11px] text-[#52635F]">
            {isBm
              ? "Prototaip demo. Bukan sistem rasmi KKM. Data adalah sintetik."
              : "Demo prototype. Not an official MOH system. Data is synthetic."}
            <span className="ml-2" title={isBm ? "Tempat rekod disimpan" : "Where records are saved"}>
              ·{" "}
              {syncStatus === "database"
                ? isBm ? "Rekod disimpan dalam pangkalan data" : "Records saved to the database"
                : syncStatus === "offline"
                  ? isBm ? "Pangkalan data tidak dapat dihubungi: rekod disimpan dalam pelayar ini sahaja" : "Database unreachable: records saved in this browser only"
                  : isBm ? "Menyambung ke pangkalan data…" : "Connecting to the database…"}
            </span>
          </footer>
        </div>
      </div>
      {locked && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#EAF1F0] px-4 py-8">
          <main className="w-full max-w-[440px] rounded border border-[#C9D1CF] bg-white p-6 sm:p-8">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-[24px] font-extrabold leading-none tracking-[-0.01em] text-[#1F5446]">
                <img alt="" className="h-8 w-8" src="/favicon.svg" />
                CatatKod
              </div>
              <LanguageToggle />
            </div>
            <h1 className="text-xl font-bold tracking-[-0.02em]">
              {isBm ? "Sesi dikunci" : "Session locked"}
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#405955]">
              {isBm
                ? "Sesi dikunci. Masukkan kata laluan untuk sambung."
                : "Session locked. Enter your password to continue."}
            </p>
            <form
              className="mt-6"
              onSubmit={(event) => {
                event.preventDefault();
                if (!unlockPassword.trim()) return;
                setUnlockPassword("");
                setLocked(false);
              }}
            >
              <label className="mb-2 block text-sm font-semibold" htmlFor="unlock-password">
                {isBm ? "Kata laluan" : "Password"}
              </label>
              <input
                autoFocus
                className="h-11 w-full rounded border border-[#9FB0AD] bg-white px-3 text-sm outline-none focus:border-[#1F5446] focus:ring-2 focus:ring-[#1F5446]/20"
                id="unlock-password"
                onChange={(event) => setUnlockPassword(event.target.value)}
                type="password"
                value={unlockPassword}
              />
              <button className="mt-4 h-11 w-full rounded bg-[#1F5446] px-4 text-sm font-semibold text-white hover:bg-[#173F35] disabled:bg-[#7E9891]" disabled={!unlockPassword.trim()} type="submit">
                {isBm ? "Buka kunci" : "Unlock"}
              </button>
            </form>
            <button className="mt-5 w-full text-center text-sm font-semibold text-[#1F5446] hover:underline" onClick={signOut}>
              {isBm ? "Log keluar" : "Sign out"}
            </button>
          </main>
        </div>
      )}
    </div>
  );
}
