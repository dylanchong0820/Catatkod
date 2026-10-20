import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  ageFrom,
  birthDateFromIc,
  formatDateInput,
  formatDayMonthYear,
  formatIc,
  icDigits,
  parseDayMonthYear,
  sexFromIc,
  todayIso,
} from "../identity";
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

// birthDate is typed as DD/MM/YYYY. It and sex are filled in from the IC number until the nurse edits them.
const emptyForm = { name: "", ic: "", birthDate: "", birthDateFromIc: true, sex: "", sexFromIc: true, allergy: "" };
type FormErrors = Partial<Record<"name" | "ic" | "birthDate" | "sex", string>>;

export function HomePage() {
  const { addPatient, history, language, patients, settings, setActivePatient } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const isBm = language === "bm";
  const results = useMemo(() => {
    if (!query.trim()) return [];
    const term = query.trim().toLowerCase();
    const digits = icDigits(query);
    return patients.filter(
      (patient) => patient.name.toLowerCase().includes(term) || (digits.length > 0 && icDigits(patient.ic).includes(digits))
    );
  }, [patients, query]);
  const birthIso = parseDayMonthYear(form.birthDate);
  const draftCount = history.filter(
    (record) => record.status === "Draf" && record.lastEditedBy === settings.displayName
  ).length;

  function openPatient(patient: (typeof patients)[number]) {
    setActivePatient(patient);
    navigate(`/pesakit/${patient.id}`);
  }

  function openRegistration() {
    setForm(emptyForm);
    setErrors({});
    setModalOpen(true);
  }

  // "Register new patient" on the patient list comes here with { register: true }.
  useEffect(() => {
    if (!location.state?.register) return;
    openRegistration();
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  function changeIc(value: string) {
    const ic = formatIc(value);
    const fromIc = birthDateFromIc(ic);
    const sex = sexFromIc(ic);
    setForm((current) => ({
      ...current,
      ic,
      birthDate: current.birthDateFromIc ? (fromIc ? formatDayMonthYear(fromIc) : "") : current.birthDate,
      sex: current.sexFromIc ? sex ?? "" : current.sex,
    }));
    setErrors((current) => ({ ...current, ic: undefined, birthDate: undefined, sex: undefined }));
  }

  function registerPatient(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = form.name.trim().replace(/\s+/g, " ");
    const digits = icDigits(form.ic);
    const next: FormErrors = {};
    if (!name) next.name = isBm ? "Masukkan nama penuh." : "Enter the full name.";
    if (digits.length !== 12) {
      next.ic = isBm ? "No. kad pengenalan mesti 12 digit." : "The identity card no. must be 12 digits.";
    } else if (!birthDateFromIc(digits)) {
      next.ic = isBm ? "6 digit pertama bukan tarikh lahir yang sah." : "The first 6 digits aren't a valid birth date.";
    } else if (patients.some((patient) => icDigits(patient.ic) === digits)) {
      next.ic = isBm ? "Pesakit dengan no. kad pengenalan ini sudah didaftarkan." : "A patient with this identity card no. is already registered.";
    }
    if (!birthIso) next.birthDate = isBm ? "Masukkan tarikh lahir yang sah (HH/BB/TTTT)." : "Enter a valid date of birth (DD/MM/YYYY).";
    if (!form.sex) next.sex = isBm ? "Pilih jantina." : "Choose the sex.";
    setErrors(next);
    if (Object.keys(next).length > 0 || !birthIso) return;
    const patient = {
      id: `patient-${Date.now()}`,
      name,
      age: ageFrom(birthIso),
      birthDate: birthIso,
      sexMs: form.sex === "male" ? "Lelaki" : "Perempuan",
      sexEn: form.sex === "male" ? "Male" : "Female",
      ic: formatIc(digits),
      lastVisit: todayIso(),
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
              onClick={openRegistration}
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
            <form noValidate onSubmit={registerPatient}>
              <div className="grid gap-5 p-5 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className="mb-2 block text-sm font-semibold">{isBm ? "Nama penuh" : "Full name"}</span>
                  <input aria-invalid={Boolean(errors.name)} autoFocus className={fieldClass(errors.name)} value={form.name} onChange={(event) => { setForm({ ...form, name: event.target.value }); setErrors({ ...errors, name: undefined }); }} />
                  <FieldError message={errors.name} />
                </label>
                <label>
                  <span className="mb-2 block text-sm font-semibold">{isBm ? "No. kad pengenalan" : "Identity card no."}</span>
                  <input aria-invalid={Boolean(errors.ic)} className={`${fieldClass(errors.ic)} font-mono`} inputMode="numeric" placeholder="890512-10-5678" value={form.ic} onChange={(event) => changeIc(event.target.value)} />
                  <FieldError message={errors.ic} />
                </label>
                <label>
                  <span className="mb-2 block text-sm font-semibold">{isBm ? "Tarikh lahir" : "Date of birth"}</span>
                  <input
                    aria-invalid={Boolean(errors.birthDate)}
                    className={fieldClass(errors.birthDate)}
                    inputMode="numeric"
                    placeholder={isBm ? "HH/BB/TTTT" : "DD/MM/YYYY"}
                    value={form.birthDate}
                    onChange={(event) => {
                      setForm({ ...form, birthDate: formatDateInput(event.target.value), birthDateFromIc: false });
                      setErrors({ ...errors, birthDate: undefined });
                    }}
                  />
                  {errors.birthDate ? <FieldError message={errors.birthDate} /> : (
                    <span className="mt-1 block text-xs text-[#52635F]">
                      {birthIso
                        ? `${ageFrom(birthIso)} ${isBm ? "tahun" : "years old"}${form.birthDateFromIc ? (isBm ? " · daripada no. kad pengenalan" : " · from the identity card no.") : ""}`
                        : isBm ? "Diisi daripada no. kad pengenalan." : "Filled in from the identity card no."}
                    </span>
                  )}
                </label>
                <label>
                  <span className="mb-2 block text-sm font-semibold">{isBm ? "Jantina" : "Sex"}</span>
                  <select aria-invalid={Boolean(errors.sex)} className={`${fieldClass(errors.sex)} bg-white`} value={form.sex} onChange={(event) => { setForm({ ...form, sex: event.target.value, sexFromIc: false }); setErrors({ ...errors, sex: undefined }); }}>
                    <option disabled value="">{isBm ? "Pilih" : "Choose"}</option>
                    <option value="female">{isBm ? "Perempuan" : "Female"}</option>
                    <option value="male">{isBm ? "Lelaki" : "Male"}</option>
                  </select>
                  <FieldError message={errors.sex} />
                </label>
                <label>
                  <span className="mb-2 block text-sm font-semibold">{isBm ? "Alergi (pilihan)" : "Allergy (optional)"}</span>
                  <input className={fieldClass()} placeholder={isBm ? "cth. Penisilin" : "e.g. Penicillin"} value={form.allergy} onChange={(event) => setForm({ ...form, allergy: event.target.value })} />
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

function fieldClass(error?: string) {
  return `h-10 w-full rounded border px-3 text-sm outline-none focus:ring-2 ${
    error ? "border-[#B42318] focus:ring-[#B42318]/20" : "border-[#9FB0AD] focus:border-[#1F5446] focus:ring-[#1F5446]/20"
  }`;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <span className="mt-1 block text-xs font-medium text-[#B42318]">{message}</span>;
}
