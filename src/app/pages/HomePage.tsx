import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
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

const emptyForm = { name: "", ic: "", birthDate: "", sex: "female", allergy: "" };

export function HomePage() {
  const { addPatient, history, language, patients, settings, setActivePatient } = useStore();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const isBm = language === "bm";
  const results = useMemo(() => {
    if (!query.trim()) return [];
    const term = query.toLowerCase();
    return patients.filter(
      (patient) => patient.name.toLowerCase().includes(term) || patient.ic.includes(query)
    );
  }, [patients, query]);
  const draftCount = history.filter(
    (record) => record.status === "Draf" && record.lastEditedBy === settings.displayName
  ).length;

  function openPatient(patient: (typeof patients)[number]) {
    setActivePatient(patient);
    navigate(`/pesakit/${patient.id}`);
  }

  function registerPatient(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const birthDate = new Date(form.birthDate);
    const now = new Date("2026-10-12T12:00:00");
    let age = now.getFullYear() - birthDate.getFullYear();
    if (
      now.getMonth() < birthDate.getMonth() ||
      (now.getMonth() === birthDate.getMonth() && now.getDate() < birthDate.getDate())
    ) age -= 1;
    const digits = form.ic.replace(/\D/g, "");
    const patient = {
      id: `patient-${Date.now()}`,
      name: form.name,
      age: Math.max(0, age),
      sexMs: form.sex === "male" ? "Lelaki" : "Perempuan",
      sexEn: form.sex === "male" ? "Male" : "Female",
      ic: `${digits.slice(0, 6).padEnd(6, "0")}-${digits.slice(6, 8).padEnd(2, "0")}-${digits.slice(8, 12).padEnd(4, "0")}`,
      lastVisit: "2026-10-12",
      allergiesMs: form.allergy.trim() || "Tiada diketahui",
      allergiesEn: form.allergy.trim() || "None known",
    };
    addPatient(patient);
    setActivePatient(patient);
    setForm(emptyForm);
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
                      <span className="text-xs">{patient.age} {isBm ? "tahun" : "years"}</span>
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
              onClick={() => setModalOpen(true)}
            >
              + {isBm ? "Daftar pesakit baharu" : "Register new patient"}
            </button>
          </div>
        </section>
      </main>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-8" role="presentation" onMouseDown={() => setModalOpen(false)}>
          <section
            aria-labelledby="register-patient-title"
            aria-modal="true"
            className="max-h-full w-full max-w-[700px] overflow-y-auto rounded border border-[#C9D1CF] bg-white"
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#DCE3E1] px-5 py-4">
              <h2 className="font-semibold" id="register-patient-title">{isBm ? "Daftar pesakit baharu" : "Register new patient"}</h2>
              <button aria-label={isBm ? "Tutup" : "Close"} className="rounded p-2 text-[#405955] hover:bg-[#EDF2F1]" onClick={() => setModalOpen(false)}>
                <Icon name="close" size={18} />
              </button>
            </div>
            <form onSubmit={registerPatient}>
              <div className="grid gap-5 p-5 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className="mb-2 block text-sm font-semibold">{isBm ? "Nama penuh" : "Full name"}</span>
                  <input autoFocus className="h-10 w-full rounded border border-[#9FB0AD] px-3 text-sm" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
                </label>
                <label>
                  <span className="mb-2 block text-sm font-semibold">{isBm ? "No. kad pengenalan" : "Identity card no."}</span>
                  <input className="h-10 w-full rounded border border-[#9FB0AD] px-3 text-sm" required value={form.ic} onChange={(event) => setForm({ ...form, ic: event.target.value })} />
                </label>
                <label>
                  <span className="mb-2 block text-sm font-semibold">{isBm ? "Tarikh lahir" : "Date of birth"}</span>
                  <input className="h-10 w-full rounded border border-[#9FB0AD] px-3 text-sm" required type="date" value={form.birthDate} onChange={(event) => setForm({ ...form, birthDate: event.target.value })} />
                </label>
                <label>
                  <span className="mb-2 block text-sm font-semibold">{isBm ? "Jantina" : "Sex"}</span>
                  <select className="h-10 w-full rounded border border-[#9FB0AD] bg-white px-3 text-sm" value={form.sex} onChange={(event) => setForm({ ...form, sex: event.target.value })}>
                    <option value="female">{isBm ? "Perempuan" : "Female"}</option>
                    <option value="male">{isBm ? "Lelaki" : "Male"}</option>
                  </select>
                </label>
                <label>
                  <span className="mb-2 block text-sm font-semibold">{isBm ? "Alergi (pilihan)" : "Allergy (optional)"}</span>
                  <input className="h-10 w-full rounded border border-[#9FB0AD] px-3 text-sm" value={form.allergy} onChange={(event) => setForm({ ...form, allergy: event.target.value })} />
                </label>
              </div>
              <div className="flex justify-end gap-3 border-t border-[#DCE3E1] px-5 py-4">
                <button className="h-10 rounded border border-[#9FB0AD] bg-white px-4 text-sm font-semibold text-[#1F5446] hover:bg-[#F1F4F3]" onClick={() => setModalOpen(false)} type="button">
                  {isBm ? "Batal" : "Cancel"}
                </button>
                <button className="h-10 rounded bg-[#1F5446] px-5 text-sm font-semibold text-white hover:bg-[#173F35]" type="submit">{isBm ? "Simpan" : "Save"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
