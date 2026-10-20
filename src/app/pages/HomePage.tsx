import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import type { Patient } from "../data";
import { currentAge, icDigits } from "../identity";
import { PatientFormModal } from "../PatientForm";
import { useStore } from "../store";
import { Icon } from "../ui";

function formatDate(value: string, language: "bm" | "en", withTime = false) {
  return new Intl.DateTimeFormat(language === "bm" ? "ms-MY" : "en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
  }).format(new Date(value));
}

export function HomePage() {
  const { addPatient, history, language, patients, settings, setActivePatient } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const isBm = language === "bm";
  const results = useMemo(() => {
    if (!query.trim()) return [];
    const term = query.trim().toLowerCase();
    const digits = icDigits(query);
    return patients.filter(
      (patient) => patient.name.toLowerCase().includes(term) || (digits.length > 0 && icDigits(patient.ic).includes(digits))
    );
  }, [patients, query]);
  const draftCount = history.filter(
    (record) => record.status === "Draf" && record.lastEditedBy === settings.displayName
  ).length;

  function openPatient(patient: (typeof patients)[number]) {
    setActivePatient(patient);
    navigate(`/pesakit/${patient.id}`);
  }

  function openRegistration() {
    setModalOpen(true);
  }

  // "Register new patient" on the patient list comes here with { register: true }.
  useEffect(() => {
    if (!location.state?.register) return;
    openRegistration();
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  function registerPatient(patient: Patient) {
    addPatient(patient);
    setActivePatient(patient);
    setModalOpen(false);
    navigate(`/pesakit/${patient.id}`);
  }

  return (
    <>
      <main className="mx-auto max-w-[1200px] px-4 pb-5 pt-10 sm:px-6 lg:px-8">
        <div className="mb-5">
          <h1 className="text-3xl font-bold tracking-[-0.02em] text-[#1A1A1A] sm:text-4xl">
            {isBm ? `Selamat datang, ${settings.displayName}` : `Welcome, ${settings.displayName}`}
          </h1>
        </div>
        {draftCount > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded border border-[#D5DCDA] bg-[#F1F3F2] px-4 py-3 text-sm text-[#405955]">
            <span>
              {isBm
                ? `Anda ada ${draftCount} draf belum siap.`
                : `You have ${draftCount} unfinished ${draftCount === 1 ? "draft" : "drafts"}.`}
            </span>
            <Link className="font-semibold text-[#1F5446] hover:underline" to="/rekod/draf">
              {isBm ? "Lihat draf" : "View drafts"}
            </Link>
          </div>
        )}
        <section className="mb-6 rounded border border-[#C9D1CF] bg-white p-4 sm:p-6">
          <div>
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-3.5 text-[#52635F]">
                <Icon name="search" size={20} />
              </span>
              <input
                className="h-12 w-full rounded border border-[#9FB0AD] pl-10 pr-3 text-sm outline-none placeholder:text-[#6B7B78] focus:border-[#1F5446] focus:ring-2 focus:ring-[#1F5446]/20"
                onChange={(event) => setQuery(event.target.value)}
                placeholder={isBm ? "Cari pesakit (nama atau no. kad pengenalan)" : "Search patients (name or identity card no.)"}
                type="search"
                value={query}
              />
              {query && (
                <div className="absolute left-0 right-0 z-10 mt-1 overflow-hidden rounded border border-[#C9D1CF] bg-white">
                  {results.length > 0 ? results.map((patient) => (
                    <button
                      className="grid w-full gap-1 border-b border-[#DCE3E1] px-4 py-3 text-left hover:bg-[#F1F4F3] sm:grid-cols-[1.4fr_1fr_0.5fr_0.7fr_1fr]"
                      key={patient.id}
                      onClick={() => openPatient(patient)}
                    >
                      <strong className="text-sm">{patient.name}</strong>
                      <span className="font-mono text-xs text-[#52635F]">{patient.ic}</span>
                      <span className="text-xs">{currentAge(patient)} {isBm ? "tahun" : "years"}</span>
                      <span className="text-xs">{isBm ? patient.sexMs : patient.sexEn}</span>
                      <span className="text-xs text-[#52635F]">{isBm ? "Terakhir" : "Last"}: {formatDate(patient.lastVisit, language)}</span>
                    </button>
                  )) : (
                    <p className="px-4 py-4 text-sm text-[#52635F]">{isBm ? "Tiada pesakit ditemui." : "No patients found."}</p>
                  )}
                </div>
              )}
            </div>
            <button
              className="mt-3 text-sm font-semibold text-[#1F5446] hover:underline"
              onClick={openRegistration}
            >
              + {isBm ? "Daftar pesakit baharu" : "Register new patient"}
            </button>
          </div>
        </section>
      </main>

      {modalOpen && (
        <PatientFormModal isBm={isBm} onClose={() => setModalOpen(false)} onSave={registerPatient} patients={patients} />
      )}
    </>
  );
}
