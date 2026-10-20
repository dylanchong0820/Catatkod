import { useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { LanguageToggle } from "../ui";
import { useStore } from "../store";

export function LoginPage() {
  const { authenticated, language, login } = useStore();
  const navigate = useNavigate();
  const [staffId, setStaffId] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isBm = language === "bm";

  if (authenticated) return <Navigate replace to="/utama" />;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!staffId.trim() || !password.trim()) {
      setError(isBm ? "ID kakitangan atau kata laluan tidak sah." : "Staff ID or password is incorrect.");
      return;
    }
    setError("");
    setLoading(true);
    window.setTimeout(() => {
      login(remember);
      navigate("/utama");
    }, 600);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#EAF1F0] px-4 py-20 text-[#1A1A1A]">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <LanguageToggle />
      </div>
      <div className="w-full max-w-[420px]">
        <main className="rounded-lg border border-[#C9D1CF] bg-white px-6 py-8 sm:px-8 sm:py-9">
          <div className="mb-9 text-[40px] font-extrabold leading-none tracking-[-0.02em] text-[#0B5345] sm:text-[44px]">
            CatatKod
          </div>
          <h1 className="mb-6 text-[22px] font-bold tracking-[-0.02em]">
            {isBm ? "Log masuk" : "Sign in"}
          </h1>
          <form className="space-y-5" onSubmit={submit}>
            <div>
              <label className="mb-2 block text-sm font-semibold" htmlFor="staff-id">
                {isBm ? "ID kakitangan" : "Staff ID"}
              </label>
              <input
                aria-invalid={Boolean(error)}
                autoComplete="username"
                className={`h-11 w-full rounded border bg-white px-3 text-sm outline-none placeholder:text-[#6B7B78] focus:ring-2 focus:ring-[#0B5345]/25 ${
                  error ? "border-[#B42318]" : "border-[#9FB0AD] focus:border-[#0B5345]"
                }`}
                id="staff-id"
                onChange={(event) => {
                  setStaffId(event.target.value);
                  setError("");
                }}
                placeholder={isBm ? "Contoh: KKM10248" : "Example: KKM10248"}
                value={staffId}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold" htmlFor="password">
                {isBm ? "Kata laluan" : "Password"}
              </label>
              <div className="relative">
                <input
                  aria-invalid={Boolean(error)}
                  autoComplete="current-password"
                  className={`h-11 w-full rounded border bg-white px-3 pr-16 text-sm outline-none placeholder:text-[#6B7B78] focus:ring-2 focus:ring-[#0B5345]/25 ${
                    error ? "border-[#B42318]" : "border-[#9FB0AD] focus:border-[#0B5345]"
                  }`}
                  id="password"
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError("");
                  }}
                  placeholder={isBm ? "Kata laluan" : "Password"}
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#1F5446]"
                  onClick={() => setShowPassword((current) => !current)}
                  type="button"
                >
                  {showPassword ? (isBm ? "Sorok" : "Hide") : isBm ? "Tunjuk" : "Show"}
                </button>
              </div>
              {error && <p className="mt-2 text-xs font-semibold text-[#B42318]">{error}</p>}
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-[#263B37]">
              <input checked={remember} className="h-4 w-4 accent-[#0B5345]" onChange={(event) => setRemember(event.target.checked)} type="checkbox" />
              {isBm ? "Kekalkan sesi pada peranti ini" : "Keep me signed in on this device"}
            </label>
            <button
              className="flex h-12 w-full items-center justify-center rounded bg-[#0B5345] text-sm font-semibold text-white hover:bg-[#083F35] disabled:cursor-wait disabled:bg-[#416F66]"
              disabled={loading}
              type="submit"
            >
              {loading ? (isBm ? "Sedang log masuk..." : "Signing in...") : isBm ? "Log masuk" : "Sign in"}
            </button>
            <div className="text-center">
              <button className="text-[14px] font-medium text-[#0B5345] hover:underline" type="button">
                {isBm ? "Lupa kata laluan?" : "Forgot password?"}
              </button>
            </div>
          </form>
        </main>
        <p className="mt-5 border-t border-[#C9D1CF] pt-4 text-center text-[11px] leading-5 text-[#52635F]">
          {isBm
            ? "Prototaip demo. Bukan sistem rasmi KKM. Data adalah sintetik."
            : "Demo prototype. Not an official MOH system. Data is synthetic."}
        </p>
      </div>
    </div>
  );
}
