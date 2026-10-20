import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import type { RecordCode } from "../data";
import { useStore } from "../store";
import {
  ConfirmationLine,
  HighlightedNote,
  PageHeader,
  RecordBy,
  RecordCodeChips,
  RecordDateTime,
  RecordStatusBadge,
  formatAuditDate,
} from "../ui";

function formatDate(value: string, language: "bm" | "en") {
  return new Intl.DateTimeFormat(language === "bm" ? "ms-MY" : "en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

const codeCatalog = [
  { code: "R50.9", labelMs: "Demam, tidak dinyatakan", labelEn: "Fever, unspecified" },
  { code: "R05", labelMs: "Batuk", labelEn: "Cough" },
  { code: "J00", labelMs: "Nasofaringitis akut (selesema)", labelEn: "Acute nasopharyngitis (common cold)" },
  { code: "J02.9", labelMs: "Faringitis akut, tidak dinyatakan", labelEn: "Acute pharyngitis, unspecified" },
  { code: "R06.0", labelMs: "Sesak nafas", labelEn: "Shortness of breath" },
  { code: "R51", labelMs: "Sakit kepala", labelEn: "Headache" },
  { code: "E11", labelMs: "Diabetes mellitus jenis 2", labelEn: "Type 2 diabetes mellitus" },
  { code: "I10", labelMs: "Hipertensi esensial", labelEn: "Essential hypertension" },
  { code: "R11", labelMs: "Loya dan muntah", labelEn: "Nausea and vomiting" },
  { code: "R07.4", labelMs: "Sakit dada", labelEn: "Chest pain" },
];

export function HistoryPage() {
  const { history, language, settings } = useStore();
  const navigate = useNavigate();
  const isBm = language === "bm";
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Semua");
  const [author, setAuthor] = useState("Semua");
  const [date, setDate] = useState("");
  const filtered = useMemo(() => history.filter((item) => {
    const currentCodes = item.codes.filter((code) => !code.removed);
    const matchesQuery =
      item.patient.name.toLowerCase().includes(query.toLowerCase()) ||
      item.patient.ic.includes(query) ||
      currentCodes.some((code) => code.code.toLowerCase().includes(query.toLowerCase()));
    const matchesDate = !date || item.date.slice(0, 10) === date;
    const recordAuthor = item.status === "Draf" ? item.lastEditedBy : item.confirmedBy;
    const matchesAuthor = author === "Semua" || recordAuthor === settings.displayName;
    return matchesQuery && matchesDate && matchesAuthor && (status === "Semua" || item.status === status);
  }), [author, date, history, query, settings.displayName, status]);

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8">
      <PageHeader
        crumbs={[{ label: isBm ? "Utama" : "Home", to: "/utama" }, { label: isBm ? "Rekod" : "Records" }]}
        title={isBm ? "Rekod" : "Records"}
      />
      <section className="overflow-hidden rounded border border-[#C9D1CF] bg-white">
        <div className="grid gap-3 border-b border-[#DCE3E1] p-4 sm:grid-cols-2 lg:grid-cols-[minmax(280px,1fr)_160px_130px_180px] lg:items-end">
          <label className="min-w-0 sm:col-span-2 lg:col-span-1">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-[#52635F]">{isBm ? "Carian" : "Search"}</span>
            <input
              className="mt-1.5 h-10 w-full min-w-0 rounded border border-[#9FB0AD] px-3 text-sm outline-none placeholder:text-[#6B7B78] focus:border-[#1F5446] focus:ring-2 focus:ring-[#1F5446]/20"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={isBm ? "Cari nama pesakit, no. kad pengenalan atau kod" : "Search patient name, identity card no. or code"}
              type="search"
              value={query}
            />
          </label>
          <label>
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-[#52635F]">{isBm ? "Status" : "Status"}</span>
            <select className="mt-1.5 h-10 w-full rounded border border-[#9FB0AD] bg-white px-3 text-sm text-[#1A1A1A]" onChange={(event) => setStatus(event.target.value)} value={status}>
              <option value="Semua">{isBm ? "Semua status" : "All statuses"}</option>
              <option value="Disahkan">{isBm ? "Disahkan" : "Confirmed"}</option>
              <option value="Draf">{isBm ? "Draf" : "Draft"}</option>
            </select>
          </label>
          <label>
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-[#52635F]">{isBm ? "Oleh" : "By"}</span>
            <select className="mt-1.5 h-10 w-full rounded border border-[#9FB0AD] bg-white px-3 text-sm text-[#1A1A1A]" onChange={(event) => setAuthor(event.target.value)} value={author}>
              <option value="Semua">{isBm ? "Semua" : "All"}</option>
              <option value="Saya">{isBm ? "Saya" : "Me"}</option>
            </select>
          </label>
          <label>
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-[#52635F]">{isBm ? "Tarikh" : "Date"}</span>
            <input className="mt-1.5 h-10 w-full rounded border border-[#9FB0AD] bg-white px-3 text-sm text-[#1A1A1A]" onChange={(event) => setDate(event.target.value)} type="date" value={date} />
          </label>
        </div>
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
              {filtered.map((item) => (
                <tr className="h-14 cursor-pointer hover:bg-[#F1F4F3]" key={item.id} onClick={() => navigate(`/rekod/${item.id}`)}>
                  <td className="border-b border-[#DCE3E1] px-4 py-2 align-middle"><RecordDateTime language={language} value={item.date} /></td>
                  <td className="truncate border-b border-[#DCE3E1] px-4 py-2 align-middle" title={item.note}>{item.note}</td>
                  <td className="overflow-hidden border-b border-[#DCE3E1] px-4 py-2 align-middle"><RecordCodeChips record={item} /></td>
                  <td className="border-b border-[#DCE3E1] px-4 py-2 align-middle"><RecordBy currentUser={settings.displayName} language={language} record={item} /></td>
                  <td className="border-b border-[#DCE3E1] px-4 py-2 align-middle"><RecordStatusBadge language={language} record={item} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <p className="p-8 text-center text-sm text-[#52635F]">{isBm ? "Tiada rekod ditemui." : "No records found."}</p>}
      </section>
    </main>
  );
}

export function DraftsPage() {
  const { deleteDraft, history, language, settings } = useStore();
  const [draftToDelete, setDraftToDelete] = useState<string | null>(null);
  const isBm = language === "bm";
  const drafts = history.filter(
    (record) => record.status === "Draf" && record.lastEditedBy === settings.displayName
  );

  return (
    <>
      <main className="mx-auto max-w-[1200px] px-4 py-5 sm:px-6 lg:px-8">
        <PageHeader
          crumbs={[
            { label: isBm ? "Utama" : "Home", to: "/utama" },
            { label: isBm ? "Rekod" : "Records", to: "/rekod" },
            { label: isBm ? "Draf saya" : "My drafts" },
          ]}
          title={isBm ? "Draf saya" : "My drafts"}
        />
        <section className="overflow-hidden rounded border border-[#C9D1CF] bg-white">
          {drafts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-[220px]" />
                  <col />
                  <col className="w-[160px]" />
                  <col className="w-[170px]" />
                </colgroup>
                <thead className="bg-[#F4F7F6] text-xs text-[#354B46]">
                  <tr>
                    <th className="border-b border-[#C9D1CF] px-4 py-3">{isBm ? "Pesakit" : "Patient"}</th>
                    <th className="border-b border-[#C9D1CF] px-4 py-3">{isBm ? "Ringkasan" : "Summary"}</th>
                    <th className="border-b border-[#C9D1CF] px-4 py-3">{isBm ? "Kemas kini terakhir" : "Last updated"}</th>
                    <th className="border-b border-[#C9D1CF] px-4 py-3"><span className="sr-only">{isBm ? "Tindakan" : "Actions"}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {drafts.map((record) => (
                    <tr className="h-14 hover:bg-[#F1F4F3]" key={record.id}>
                      <td className="truncate border-b border-[#DCE3E1] px-4 py-2 align-middle font-semibold">{record.patient.name}</td>
                      <td className="truncate border-b border-[#DCE3E1] px-4 py-2 align-middle" title={record.note}>{record.note}</td>
                      <td className="border-b border-[#DCE3E1] px-4 py-2 align-middle"><RecordDateTime language={language} value={record.date} /></td>
                      <td className="border-b border-[#DCE3E1] px-4 py-2 text-right align-middle">
                        <div className="flex items-center justify-end gap-4">
                          <Link className="font-semibold text-[#1F5446] hover:underline" to={`/pesakit/${record.patient.id}/lawatan-baharu?draft=${record.id}`}>
                            {isBm ? "Sambung" : "Resume"}
                          </Link>
                          <button className="text-sm font-medium text-[#52635F] hover:text-[#1F5446] hover:underline" onClick={() => setDraftToDelete(record.id)}>
                            {isBm ? "Padam" : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="p-8 text-center text-sm text-[#52635F]">{isBm ? "Tiada draf." : "No drafts."}</p>
          )}
        </section>
      </main>

      {draftToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-8" role="presentation" onMouseDown={() => setDraftToDelete(null)}>
          <section
            aria-labelledby="delete-draft-title"
            aria-modal="true"
            className="w-full max-w-[420px] rounded border border-[#C9D1CF] bg-white"
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="p-5">
              <h2 className="font-semibold" id="delete-draft-title">{isBm ? "Padam draf ini?" : "Delete this draft?"}</h2>
            </div>
            <div className="flex justify-end gap-3 border-t border-[#DCE3E1] px-5 py-4">
              <button className="h-10 rounded border border-[#9FB0AD] bg-white px-4 text-sm font-semibold text-[#1F5446] hover:bg-[#F1F4F3]" onClick={() => setDraftToDelete(null)}>
                {isBm ? "Batal" : "Cancel"}
              </button>
              <button
                className="h-10 rounded bg-[#1F5446] px-4 text-sm font-semibold text-white hover:bg-[#173F35]"
                onClick={() => {
                  deleteDraft(draftToDelete);
                  setDraftToDelete(null);
                }}
              >
                {isBm ? "Padam" : "Delete"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export function HistoryDetailPage() {
  const { amendRecord, history, language } = useStore();
  const navigate = useNavigate();
  const { recordId } = useParams();
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editableCodes, setEditableCodes] = useState<RecordCode[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [codeQuery, setCodeQuery] = useState("");
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const isBm = language === "bm";
  const record = history.find((item) => item.id === recordId);

  if (!record) {
    return (
      <main className="mx-auto max-w-[1000px] px-4 py-5 sm:px-6 lg:px-8">
        <PageHeader crumbs={[{ label: isBm ? "Utama" : "Home", to: "/utama" }, { label: isBm ? "Rekod" : "Records" }]} title={isBm ? "Rekod tidak ditemui" : "Record not found"} />
        <button className="text-sm font-semibold text-[#1F5446] hover:underline" onClick={() => navigate("/rekod")}>{isBm ? "Kembali" : "Back"}</button>
      </main>
    );
  }

  const codeSource = editing ? editableCodes : record.codes;
  const displayedCodes = [
    ...codeSource.filter((code) => !code.removed),
    ...codeSource.filter((code) => code.removed),
  ];
  const baselineActive = record.codes.filter((code) => !code.removed);
  const editedActive = editableCodes.filter((code) => !code.removed);
  const added = editedActive.filter((code) => !baselineActive.some((item) => item.code === code.code));
  const removed = baselineActive.filter((code) => !editedActive.some((item) => item.code === code.code));
  const hasChange = added.length > 0 || removed.length > 0;
  const amendmentMissing = !hasChange
    ? isBm
      ? "Buang atau tambah sekurang-kurangnya satu kod."
      : "Remove or add at least one code."
    : !reason.trim()
      ? isBm
        ? "Isi sebab pindaan."
        : "Enter a reason for the amendment."
      : !password
        ? isBm
          ? "Masukkan kata laluan."
          : "Enter a password."
        : "";
  const filteredCatalog = codeCatalog.filter((item) => {
    const term = codeQuery.toLowerCase();
    const matches = item.code.toLowerCase().includes(term) ||
      item.labelMs.toLowerCase().includes(term) ||
      item.labelEn.toLowerCase().includes(term);
    return matches && !editedActive.some((code) => code.code === item.code);
  });

  function startEditing() {
    if (!record) return;
    setEditableCodes(record.codes.map((code) => ({ ...code })));
    setReason("");
    setPassword("");
    setCodeQuery("");
    setAddOpen(false);
    setEditing(true);
  }

  function cancelEditing() {
    setEditableCodes([]);
    setReason("");
    setPassword("");
    setAddOpen(false);
    setEditing(false);
  }

  function toggleRemoved(codeId: string) {
    setEditableCodes((current) => current.map((code) =>
      code.id === codeId ? { ...code, removed: !code.removed } : code
    ));
  }

  function addCode(item: (typeof codeCatalog)[number]) {
    setEditableCodes((current) => {
      const existing = current.find((code) => code.code === item.code);
      if (existing) {
        return current.map((code) => code.code === item.code ? { ...code, removed: false } : code);
      }
      return [
        ...current,
        {
          id: `manual-${item.code}-${Date.now()}`,
          ...item,
          evidence: "Ditambah secara manual",
          start: -1,
          end: -1,
          origin: "added",
          removed: false,
        },
      ];
    });
    setCodeQuery("");
    setAddOpen(false);
  }

  const amendments = (record.amendments ?? [])
    .map((amendment, index) => ({ amendment, number: index + 1 }))
    .reverse();
  const latestAmendment = record.amendments?.[record.amendments.length - 1];

  return (
    <main className="mx-auto max-w-[1000px] px-4 py-5 sm:px-6 lg:px-8">
      <PageHeader
        crumbs={[
          { label: isBm ? "Utama" : "Home", to: "/utama" },
          { label: isBm ? "Rekod" : "Records", to: "/rekod" },
          { label: record.patient.name },
        ]}
        title={isBm ? "Butiran rekod" : "Record details"}
      />
      {latestAmendment && (
        <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded border border-[#D5DCDA] bg-[#F1F3F2] px-4 py-2.5 text-sm text-[#405955]">
          <span>
            {isBm ? "Dipinda pada" : "Amended on"} {formatAuditDate(latestAmendment.date, language)}{" "}
            {isBm ? "oleh" : "by"} {latestAmendment.user}
          </span>
          <button
            className="font-semibold text-[#1F5446] hover:underline"
            onClick={() => document.getElementById("record-history")?.scrollIntoView({ behavior: "smooth" })}
          >
            {isBm ? "Lihat sejarah" : "View history"}
          </button>
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-5">
        <button className="text-sm font-semibold text-[#1F5446] hover:underline" onClick={() => navigate("/rekod")}>{isBm ? "Kembali" : "Back"}</button>
        <button className="text-sm font-semibold text-[#1F5446] hover:underline" onClick={() => navigate(`/pesakit/${record.patient.id}`)}>{isBm ? "Buka pesakit" : "Open patient"}</button>
        {record.status === "Disahkan" && !editing && (
          <button className="ml-auto h-10 rounded border border-[#9FB0AD] bg-white px-4 text-sm font-semibold text-[#1F5446] hover:bg-[#F1F4F3]" onClick={startEditing}>
            {isBm ? "Pinda rekod" : "Amend record"}
          </button>
        )}
      </div>
      <section className="rounded border border-[#C9D1CF] bg-white">
        <div className="grid gap-3 border-b border-[#DCE3E1] p-4 sm:grid-cols-3">
          <div><p className="text-xs text-[#52635F]">{isBm ? "Pesakit" : "Patient"}</p><p className="mt-1 font-semibold">{record.patient.name}</p></div>
          <div><p className="text-xs text-[#52635F]">{isBm ? "Tarikh" : "Date"}</p><p className="mt-1 font-semibold">{formatDate(record.date, language)}</p></div>
          <div>
            <p className="text-xs text-[#52635F]">{isBm ? "Status" : "Status"}</p>
            <p className="mt-1 font-semibold">
              {record.status === "Disahkan"
                ? record.amendments?.length
                  ? isBm ? "Disahkan (dipinda)" : "Confirmed (amended)"
                  : isBm ? "Disahkan" : "Confirmed"
                : isBm ? "Draf" : "Draft"}
            </p>
            <ConfirmationLine language={language} record={record} />
          </div>
        </div>
        <div className="p-4">
          <h2 className="mb-2 font-semibold">{isBm ? "Butiran lawatan" : "Visit details"}</h2>
          <div className="whitespace-pre-wrap rounded border border-[#9FB0AD] p-3 font-mono text-sm leading-7">
            <HighlightedNote
              hoveredCode={hoveredCode}
              result={{ codes: record.codes.filter((code) => !code.removed && code.start >= 0), negated: record.negated }}
              removedCodes={record.codes.filter((code) => code.removed)}
              setHoveredCode={setHoveredCode}
              text={record.note}
            />
          </div>

          <div className="mb-2 mt-5 flex flex-wrap items-center gap-3">
            <h2 className="font-semibold">{isBm ? "Kod disimpan" : "Saved codes"}</h2>
            {editing && (
              <div className="relative ml-auto">
                <button className="h-9 rounded border border-[#9FB0AD] bg-white px-3 text-sm font-semibold text-[#1F5446] hover:bg-[#F1F4F3]" onClick={() => setAddOpen((current) => !current)}>
                  {isBm ? "Tambah kod" : "Add code"}
                </button>
                {addOpen && (
                  <div className="absolute right-0 top-11 z-20 w-[340px] rounded border border-[#C9D1CF] bg-white p-3">
                    <input
                      autoFocus
                      className="h-9 w-full rounded border border-[#9FB0AD] px-3 text-sm"
                      onChange={(event) => setCodeQuery(event.target.value)}
                      placeholder={isBm ? "Cari kod atau penerangan" : "Search code or description"}
                      type="search"
                      value={codeQuery}
                    />
                    <div className="mt-2 max-h-56 overflow-y-auto">
                      {filteredCatalog.map((item) => (
                        <button className="flex w-full gap-3 border-b border-[#DCE3E1] px-2 py-2 text-left text-sm hover:bg-[#F1F4F3]" key={item.code} onClick={() => addCode(item)}>
                          <span className="w-14 shrink-0 font-mono font-semibold text-[#1F5446]">{item.code}</span>
                          <span>{isBm ? item.labelMs : item.labelEn}</span>
                        </button>
                      ))}
                      {filteredCatalog.length === 0 && <p className="px-2 py-3 text-sm text-[#52635F]">{isBm ? "Tiada kod ditemui." : "No codes found."}</p>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-[#F4F7F6] text-xs"><tr>
                <th className="border border-[#C9D1CF] px-3 py-2">{isBm ? "Kod" : "Code"}</th>
                <th className="border border-[#C9D1CF] px-3 py-2">{isBm ? "Penerangan" : "Description"}</th>
                <th className="border border-[#C9D1CF] px-3 py-2">{isBm ? "Teks sepadan" : "Matched text"}</th>
              </tr></thead>
              <tbody>{displayedCodes.map((code) => (
                <tr className={code.removed ? "bg-[#F4F5F5] text-[#6B7774] line-through" : ""} key={code.id}>
                  <td className="border border-[#C9D1CF] px-3 py-2 font-mono font-semibold text-[#1F5446]">{code.code}</td>
                  <td className="border border-[#C9D1CF] px-3 py-2">{isBm ? code.labelMs : code.labelEn}</td>
                  <td className="border border-[#C9D1CF] px-3 py-2 text-xs">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono">“{code.evidence === "Ditambah secara manual" && !isBm ? "Added manually" : code.evidence}”</span>
                      <span className="flex shrink-0 items-center gap-2 no-underline">
                        {code.removed && (
                          <span className="rounded border border-[#C9D1CF] bg-[#E8ECEB] px-2 py-1 text-xs font-semibold text-[#52635F]">
                            {isBm ? "Dibuang" : "Removed"}
                          </span>
                        )}
                        {!code.removed && code.origin === "added" && (
                          <span className="rounded border border-[#A8C4BC] bg-[#EEF5F3] px-2 py-1 text-xs font-semibold text-[#1F5446]">
                            {isBm ? "Ditambah" : "Added"}
                          </span>
                        )}
                        {editing && (
                      <button className="text-xs font-semibold text-[#1F5446] hover:underline" onClick={() => toggleRemoved(code.id)}>
                        {code.removed ? (isBm ? "Pulihkan" : "Restore") : (isBm ? "Buang" : "Remove")}
                      </button>
                        )}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>

          {editing && (
            <form
              className="mt-5 rounded border border-[#C9D1CF] bg-[#F7F8F8]"
              onSubmit={(event) => {
                event.preventDefault();
                if (!hasChange || !reason.trim() || !password) return;
                amendRecord(record.id, reason.trim(), editableCodes, added, removed);
                cancelEditing();
              }}
            >
              <div className="grid gap-4 p-4 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className="mb-2 block text-sm font-semibold">{isBm ? "Sebab pindaan" : "Reason for amendment"}</span>
                  <textarea className="min-h-24 w-full resize-none rounded border border-[#9FB0AD] p-3 text-sm" onChange={(event) => setReason(event.target.value)} required value={reason} />
                </label>
                <label>
                  <span className="mb-2 block text-sm font-semibold">{isBm ? "Kata laluan" : "Password"}</span>
                  <input autoComplete="current-password" className="h-10 w-full rounded border border-[#9FB0AD] px-3 text-sm" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
                </label>
              </div>
              <div className="flex flex-col gap-3 border-t border-[#DCE3E1] px-4 py-3 sm:flex-row sm:items-center sm:justify-end">
                {amendmentMissing && <p className="text-xs text-[#52635F] sm:mr-auto">{amendmentMissing}</p>}
                <button className="h-10 rounded border border-[#9FB0AD] bg-white px-4 text-sm font-semibold text-[#1F5446] hover:bg-[#F1F4F3]" onClick={cancelEditing} type="button">{isBm ? "Batal" : "Cancel"}</button>
                <button className="h-10 rounded bg-[#1F5446] px-4 text-sm font-semibold text-white hover:bg-[#173F35] disabled:bg-[#7E9891]" disabled={Boolean(amendmentMissing)} type="submit">
                  {isBm ? "Simpan pindaan" : "Save amendment"}
                </button>
              </div>
            </form>
          )}

          <section className="mt-6 border-t border-[#DCE3E1] pt-5" id="record-history">
              <h2 className="mb-4 font-semibold">{isBm ? "Sejarah rekod" : "Record history"}</h2>
              <div className="ml-2 border-l border-[#C9D1CF] pl-5">
                {amendments.map(({ amendment, number }) => (
                  <div className="relative border-b border-[#DCE3E1] pb-5 pt-1 last:border-b-0" key={amendment.id}>
                    <span className="absolute -left-[27px] top-2 h-3 w-3 rounded-full border-2 border-[#1F5446] bg-white" />
                    <p className="text-sm font-semibold">{isBm ? `Pindaan ${number}` : `Amendment ${number}`}</p>
                    <p className="mt-1 text-xs text-[#52635F]">
                      {formatAuditDate(amendment.date, language)} · {amendment.user} · {isBm ? amendment.roleMs ?? "Jururawat" : amendment.roleEn ?? "Nurse"}
                    </p>
                    <p className="mt-2 text-sm">{amendment.reason}</p>
                    <div className="mt-2 space-y-1 text-sm">
                      {amendment.removed.map((code) => (
                        <p key={`removed-${amendment.id}-${code.code}`}>{isBm ? "Dibuang" : "Removed"} {code.code} {isBm ? code.labelMs : code.labelEn}</p>
                      ))}
                      {amendment.added.map((code) => (
                        <p key={`added-${amendment.id}-${code.code}`}>{isBm ? "Ditambah" : "Added"} {code.code} {isBm ? code.labelMs : code.labelEn}</p>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="relative pt-1">
                  <span className="absolute -left-[27px] top-2 h-3 w-3 rounded-full border-2 border-[#1F5446] bg-white" />
                  <p className="text-sm font-semibold">{isBm ? "Pengesahan asal" : "Original confirmation"}</p>
                  <p className="mt-1 text-xs text-[#52635F]">
                    {formatAuditDate(record.confirmedAt ?? record.date, language)} · {record.confirmedBy ?? "—"} · {isBm ? record.confirmedRoleMs ?? "Jururawat" : record.confirmedRoleEn ?? "Nurse"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(record.originalCodes ?? record.codes).filter((code) => !code.removed).map((code) => (
                      <span className="rounded border border-[#C9D1CF] bg-[#F4F7F6] px-2 py-1 font-mono text-xs font-semibold text-[#1F5446]" key={`original-${code.id}`}>
                        {code.code}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </section>
        </div>
      </section>
    </main>
  );
}
