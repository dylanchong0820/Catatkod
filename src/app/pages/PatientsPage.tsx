import { useEffect, useMemo, useState } from "react";
import type { Patient } from "../data";
import { currentAge, icDigits } from "../identity";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { PatientFormModal } from "../PatientForm";
import { useStore } from "../store";
import { PageHeader, PatientBanner, RecordBy, RecordCodeChips, RecordDateTime, RecordStatusBadge } from "../ui";

export function PatientPage() {
  const { deletePatient, history, language, patients, setActivePatient, settings, updatePatient } = useStore();
  const { patientId } = useParams();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isBm = language === "bm";
  const [toast, setToast] = useState<string>(location.state?.toast ?? "");
  const patient = patients.find((item) => item.id === patientId);
  const records = history.filter((item) => item.patient.id === patientId);

  useEffect(() => {
    if (patient) setActivePatient(patient);
  }, [patient, setActivePatient]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => {
      setToast("");
      navigate(location.pathname, { replace: true, state: null });
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [location.pathname, navigate, toast]);

  if (!patient) return null;

  return (
    <main className="mx-auto max-w-[1100px] px-4 py-5 sm:px-6 lg:px-8">
      {toast && (
        <div className="fixed right-4 top-20 z-50 rounded border border-[#8EAAA3] bg-white px-4 py-3 text-sm font-semibold text-[#1F5446]">{toast}</div>
      )}
      <PageHeader
        crumbs={[
          { label: isBm ? "Pesakit" : "Patients", to: "/pesakit" },
          { label: patient.name },
        ]}
        title={patient.name}
      />
      <PatientBanner isBm={isBm} patient={patient} />
      <div className="mb-6 flex flex-wrap items-center gap-5">
        <Link className="flex min-h-14 items-center justify-center rounded bg-[#1F5446] px-8 text-base font-semibold text-white hover:bg-[#173F35]" to={`/pesakit/${patient.id}/lawatan-baharu`}>
          {isBm ? "Lawatan baharu" : "New visit"}
        </Link>
        <Link className="text-sm font-semibold text-[#1F5446] hover:underline" to="/pesakit">
          {isBm ? "Tukar pesakit" : "Change patient"}
        </Link>
        <button className="text-sm font-semibold text-[#1F5446] hover:underline" onClick={() => setEditing(true)}>
          {isBm ? "Kemas kini butiran" : "Edit details"}
        </button>
        {records.length === 0 && (
          <button className="text-sm font-semibold text-[#B42318] hover:underline" onClick={() => setConfirmingDelete(true)}>
            {isBm ? "Padam pesakit" : "Delete patient"}
          </button>
        )}
      </div>
      {editing && (
        <PatientFormModal
          isBm={isBm}
          onClose={() => setEditing(false)}
          onSave={(next) => {
            updatePatient(next);
            setEditing(false);
            setToast(isBm ? "Butiran pesakit dikemas kini" : "Patient details updated");
          }}
          patient={patient}
          patients={patients}
        />
      )}
      {confirmingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4" role="presentation" onMouseDown={() => setConfirmingDelete(false)}>
          <section aria-labelledby="delete-patient-title" aria-modal="true" className="w-full max-w-[440px] rounded border border-[#C9D1CF] bg-white p-5" role="dialog" onMouseDown={(event) => event.stopPropagation()}>
            <h2 className="font-semibold" id="delete-patient-title">{isBm ? "Padam pesakit ini?" : "Delete this patient?"}</h2>
            <p className="mt-2 text-sm leading-6 text-[#405955]">
              {isBm
                ? `${patient.name} (${patient.ic}) akan dikeluarkan daripada senarai pesakit. Tindakan ini tidak boleh dibatalkan.`
                : `${patient.name} (${patient.ic}) will be removed from the patient list. This can't be undone.`}
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button autoFocus className="h-10 rounded border border-[#9FB0AD] bg-white px-4 text-sm font-semibold text-[#1F5446] hover:bg-[#F1F4F3]" onClick={() => setConfirmingDelete(false)}>
                {isBm ? "Batal" : "Cancel"}
              </button>
              <button
                className="h-10 rounded bg-[#B42318] px-4 text-sm font-semibold text-white hover:bg-[#912018]"
                onClick={() => {
                  if (deletePatient(patient.id)) navigate("/pesakit", { replace: true });
                  setConfirmingDelete(false);
                }}
              >
                {isBm ? "Padam" : "Delete"}
              </button>
            </div>
          </section>
        </div>
      )}
      <section className="overflow-hidden rounded border border-[#C9D1CF] bg-white">
        <h2 className="border-b border-[#DCE3E1] px-4 py-3 font-semibold">{isBm ? "Rekod pesakit" : "Patient records"}</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[130px]" />
              <col />
              <col className="w-[200px]" />
              <col className="w-[170px]" />
              <col className="w-[160px]" />
            </colgroup>
            <thead className="bg-[#F4F7F6] text-xs text-[#354B46]">
              <tr>
                <th className="border-b border-[#C9D1CF] px-4 py-3">{isBm ? "Tarikh & masa" : "Date & time"}</th>
                <th className="border-b border-[#C9D1CF] px-4 py-3">{isBm ? "Ringkasan" : "Summary"}</th>
                <th className="border-b border-[#C9D1CF] px-4 py-3">{isBm ? "Kod" : "Codes"}</th>
                <th className="border-b border-[#C9D1CF] px-4 py-3">{isBm ? "Oleh" : "By"}</th>
                <th className="border-b border-[#C9D1CF] px-4 py-3">{isBm ? "Status" : "Status"}</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr className="h-14 cursor-pointer hover:bg-[#F1F4F3]" key={record.id} onClick={() => navigate(`/rekod/${record.id}`)}>
                  <td className="border-b border-[#DCE3E1] px-4 py-2 align-middle"><RecordDateTime language={language} value={record.date} /></td>
                  <td className="truncate border-b border-[#DCE3E1] px-4 py-2 align-middle" title={record.note}>{record.note}</td>
                  <td className="overflow-hidden border-b border-[#DCE3E1] px-4 py-2 align-middle"><RecordCodeChips record={record} /></td>
                  <td className="border-b border-[#DCE3E1] px-4 py-2 align-middle"><RecordBy currentUser={settings.displayName} language={language} record={record} /></td>
                  <td className="border-b border-[#DCE3E1] px-4 py-2 align-middle"><RecordStatusBadge language={language} record={record} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {records.length === 0 && <p className="p-6 text-sm text-[#52635F]">{isBm ? "Belum ada rekod." : "No records yet."}</p>}
      </section>
    </main>
  );
}

function formatShortDate(value: string, isBm: boolean) {
  return new Intl.DateTimeFormat(isBm ? "ms-MY" : "en-MY", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(value)
  );
}

// Every registered patient, one row per person (the Records page lists visits instead).
export function PatientListPage() {
  const { history, language, patients, setActivePatient } = useStore();
  const navigate = useNavigate();
  const isBm = language === "bm";
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"name" | "lastVisit">("name");
  const recordCounts = useMemo(() => {
    const counts = new Map<string, number>();
    history.forEach((record) => counts.set(record.patient.id, (counts.get(record.patient.id) ?? 0) + 1));
    return counts;
  }, [history]);
  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    const digits = icDigits(query);
    return patients
      .filter((patient) => !term || patient.name.toLowerCase().includes(term) || (digits.length > 0 && icDigits(patient.ic).includes(digits)))
      .sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : b.lastVisit.localeCompare(a.lastVisit));
  }, [patients, query, sort]);

  function openPatient(patient: Patient) {
    setActivePatient(patient);
    navigate(`/pesakit/${patient.id}`);
  }

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8">
      <PageHeader
        crumbs={[{ label: isBm ? "Utama" : "Home", to: "/utama" }, { label: isBm ? "Pesakit" : "Patients" }]}
        title={isBm ? "Semua pesakit" : "All patients"}
      />
      <section className="overflow-hidden rounded border border-[#C9D1CF] bg-white">
        <div className="grid gap-3 border-b border-[#DCE3E1] p-4 sm:grid-cols-[minmax(280px,1fr)_200px_auto] sm:items-end">
          <label className="min-w-0">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-[#52635F]">{isBm ? "Carian" : "Search"}</span>
            <input
              className="mt-1.5 h-10 w-full min-w-0 rounded border border-[#9FB0AD] px-3 text-sm outline-none placeholder:text-[#6B7B78] focus:border-[#1F5446] focus:ring-2 focus:ring-[#1F5446]/20"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={isBm ? "Cari nama atau no. kad pengenalan" : "Search name or identity card no."}
              type="search"
              value={query}
            />
          </label>
          <label>
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-[#52635F]">{isBm ? "Susun" : "Sort"}</span>
            <select className="mt-1.5 h-10 w-full rounded border border-[#9FB0AD] bg-white px-3 text-sm text-[#1A1A1A]" onChange={(event) => setSort(event.target.value as "name" | "lastVisit")} value={sort}>
              <option value="name">{isBm ? "Nama (A–Z)" : "Name (A–Z)"}</option>
              <option value="lastVisit">{isBm ? "Lawatan terakhir (terkini)" : "Last visit (newest)"}</option>
            </select>
          </label>
          <Link className="flex h-10 items-center justify-center rounded bg-[#1F5446] px-4 text-sm font-semibold text-white hover:bg-[#173F35]" state={{ register: true }} to="/utama">
            + {isBm ? "Daftar pesakit baharu" : "Register new patient"}
          </Link>
        </div>
        <p className="border-b border-[#DCE3E1] px-4 py-2 text-xs text-[#52635F]">
          {isBm ? `${rows.length} daripada ${patients.length} pesakit` : `${rows.length} of ${patients.length} patients`}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] table-fixed text-left text-sm">
            <colgroup>
              <col />
              <col className="w-[160px]" />
              <col className="w-[90px]" />
              <col className="w-[110px]" />
              <col className="w-[170px]" />
              <col className="w-[90px]" />
              <col className="w-[150px]" />
            </colgroup>
            <thead className="bg-[#F4F7F6] text-xs text-[#354B46]">
              <tr>
                <th className="border-b border-[#C9D1CF] px-4 py-3">{isBm ? "Nama" : "Name"}</th>
                <th className="border-b border-[#C9D1CF] px-4 py-3">{isBm ? "No. kad pengenalan" : "Identity card no."}</th>
                <th className="border-b border-[#C9D1CF] px-4 py-3">{isBm ? "Umur" : "Age"}</th>
                <th className="border-b border-[#C9D1CF] px-4 py-3">{isBm ? "Jantina" : "Sex"}</th>
                <th className="border-b border-[#C9D1CF] px-4 py-3">{isBm ? "Alergi" : "Allergies"}</th>
                <th className="border-b border-[#C9D1CF] px-4 py-3">{isBm ? "Rekod" : "Records"}</th>
                <th className="border-b border-[#C9D1CF] px-4 py-3">{isBm ? "Lawatan terakhir" : "Last visit"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((patient) => (
                <tr className="h-12 cursor-pointer hover:bg-[#F1F4F3]" key={patient.id} onClick={() => openPatient(patient)}>
                  <td className="truncate border-b border-[#DCE3E1] px-4 py-2 font-semibold" title={patient.name}>{patient.name}</td>
                  <td className="border-b border-[#DCE3E1] px-4 py-2 font-mono text-xs">{patient.ic}</td>
                  <td className="border-b border-[#DCE3E1] px-4 py-2">{currentAge(patient)}</td>
                  <td className="border-b border-[#DCE3E1] px-4 py-2">{isBm ? patient.sexMs : patient.sexEn}</td>
                  <td className="truncate border-b border-[#DCE3E1] px-4 py-2" title={isBm ? patient.allergiesMs : patient.allergiesEn}>{isBm ? patient.allergiesMs : patient.allergiesEn}</td>
                  <td className="border-b border-[#DCE3E1] px-4 py-2">{recordCounts.get(patient.id) ?? 0}</td>
                  <td className="border-b border-[#DCE3E1] px-4 py-2">{formatShortDate(patient.lastVisit, isBm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <p className="p-8 text-center text-sm text-[#52635F]">
            {patients.length === 0
              ? isBm ? "Belum ada pesakit didaftarkan." : "No patients registered yet."
              : isBm ? "Tiada pesakit ditemui." : "No patients found."}
          </p>
        )}
      </section>
    </main>
  );
}
