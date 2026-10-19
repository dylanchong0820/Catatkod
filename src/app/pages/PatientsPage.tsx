import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { useStore } from "../store";
import { PageHeader, PatientBanner, RecordBy, RecordCodeChips, RecordDateTime, RecordStatusBadge } from "../ui";

export function PatientPage() {
  const { history, language, patients, setActivePatient, settings } = useStore();
  const { patientId } = useParams();
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
          { label: isBm ? "Utama" : "Home", to: "/utama" },
          { label: patient.name },
        ]}
        title={patient.name}
      />
      <PatientBanner isBm={isBm} patient={patient} />
      <div className="mb-6 flex flex-wrap items-center gap-5">
        <Link className="flex min-h-14 items-center justify-center rounded bg-[#1F5446] px-8 text-base font-semibold text-white hover:bg-[#173F35]" to={`/pesakit/${patient.id}/lawatan-baharu`}>
          {isBm ? "Lawatan baharu" : "New visit"}
        </Link>
        <Link className="text-sm font-semibold text-[#1F5446] hover:underline" to="/utama">
          {isBm ? "Tukar pesakit" : "Change patient"}
        </Link>
      </div>
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
