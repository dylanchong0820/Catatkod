import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { analyzeNote, type AnalysisResult } from "../../lib/analyze";
import { analyzeNoteWithBackend } from "../../lib/api";
import { useStore } from "../store";
import { HighlightedNote, PageHeader, PatientBanner, highlightStyles } from "../ui";

const initialNote =
  "pt demam sejak semalam, batuk + selesema 3 hari. tekak merah. no SOB. makan minum ok.";

export function NotePage() {
  const { activePatient, history, language, patients, saveNote, setActivePatient, settings } = useStore();
  const navigate = useNavigate();
  const { patientId } = useParams();
  const [searchParams] = useSearchParams();
  const draft = history.find((item) => item.id === searchParams.get("draft") && item.status === "Draf");
  const isBm = language === "bm";
  const [note, setNote] = useState(draft?.note ?? initialNote);
  const [result, setResult] = useState<AnalysisResult | null>(() => {
    if (!draft) return null;
    return {
      ...analyzeNote(draft.note),
      codes: draft.codes,
      negated: draft.negated,
    };
  });
  const [selected, setSelected] = useState<string[]>(() =>
    draft?.codes.map((item) => item.id) ?? []
  );
  const [searching, setSearching] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [editingDetails, setEditingDetails] = useState(Boolean(draft));
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);
  const patient = patients.find((item) => item.id === patientId) ?? activePatient;

  useEffect(() => {
    if (patient.id !== activePatient.id) setActivePatient(patient);
  }, [activePatient.id, patient, setActivePatient]);

  async function runAnalysis() {
    if (!note.trim() || searching) return;
    setSearching(true);
    setAnalysisError("");
    setResult(null);
    try {
      const next = await analyzeNoteWithBackend(note);
      setResult(next);
      setSelected(next.codes.map((item) => item.id));
      setEditingDetails(false);
    } catch (error) {
      setAnalysisError(
        error instanceof Error
          ? error.message
          : isBm
            ? "Tidak dapat menghubungi perkhidmatan analisis. Sila cuba lagi."
            : "Could not reach the analysis service. Please try again."
      );
    } finally {
      setSearching(false);
    }
  }

  function save(status: "Disahkan" | "Draf") {
    if (!note.trim()) return;
    const analysis = result ?? analyzeNote(note);
    const filtered = {
      ...analysis,
      codes: analysis.codes.filter((item) => selected.includes(item.id)),
    };
    saveNote(note, filtered, status, draft?.id);
    if (status === "Disahkan") {
      navigate(`/pesakit/${patient.id}`, { state: { toast: isBm ? "Rekod disimpan" : "Record saved" } });
    } else {
      navigate(`/pesakit/${patient.id}`, { state: { toast: isBm ? "Draf disimpan" : "Draft saved" } });
    }
  }

  return (
    <>
      <main className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8">
        <PageHeader
          crumbs={[
            { label: isBm ? "Utama" : "Home", to: "/utama" },
            { label: patient.name, to: `/pesakit/${patient.id}` },
            { label: isBm ? "Lawatan baharu" : "New visit" },
          ]}
          title={isBm ? "Lawatan baharu" : "New visit"}
        />
        <PatientBanner isBm={isBm} patient={patient} />

        <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <section className="min-w-0 rounded border border-[#C9D1CF] bg-white">
            <div className="border-b border-[#DCE3E1] px-4 py-3">
              <h2 className="font-semibold">{isBm ? "Butiran lawatan" : "Visit details"}</h2>
            </div>
            <div className="p-4">
              {result && !editingDetails ? (
                <div className="min-h-52 whitespace-pre-wrap rounded border border-[#9FB0AD] bg-white p-3 font-mono text-sm leading-7">
                  <HighlightedNote
                    hoveredCode={hoveredCode}
                    result={result}
                    setHoveredCode={setHoveredCode}
                    text={note}
                  />
                </div>
              ) : (
                <textarea
                  className="min-h-52 w-full resize-none rounded border border-[#9FB0AD] bg-white p-3 font-mono text-sm leading-7 outline-none focus:border-[#1F5446] focus:ring-2 focus:ring-[#1F5446]/20"
                  onChange={(event) => setNote(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.ctrlKey && event.key === "Enter") {
                      event.preventDefault();
                      runAnalysis();
                    }
                  }}
                  value={note}
                />
              )}
              {result?.duration && (
                <p className="mt-2 text-xs font-medium text-[#405955]">
                  {isBm ? "Tempoh" : "Duration"}: {result.duration.value} {result.duration.unit}
                </p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <button
                  className="h-10 rounded bg-[#1F5446] px-5 text-sm font-semibold text-white hover:bg-[#173F35] disabled:bg-[#7E9891]"
                  disabled={!note.trim() || searching}
                  onClick={runAnalysis}
                >
                  {searching
                    ? isBm
                      ? "Sedang mencari kod..."
                      : "Searching for codes..."
                    : isBm
                      ? "Cari kod"
                      : "Find codes"}
                </button>
                {result && !editingDetails && (
                  <button
                    className="text-sm font-medium text-[#1F5446] hover:underline"
                    onClick={() => setEditingDetails(true)}
                  >
                    {isBm ? "Ubah butiran" : "Edit details"}
                  </button>
                )}
                <button
                  className="text-sm font-medium text-[#1F5446] hover:underline"
                  onClick={() => {
                    setNote("");
                    setResult(null);
                    setAnalysisError("");
                    setSelected([]);
                    setEditingDetails(false);
                  }}
                >
                  {isBm ? "Kosongkan" : "Clear"}
                </button>
              </div>
              {analysisError && (
                <div role="alert" className="mt-3 rounded border border-[#B42318]/30 bg-[#FFF4F2] px-3 py-2 text-sm text-[#B42318]">
                  {analysisError}
                </div>
              )}
              <div className="mt-3 flex justify-between text-xs text-[#5A6966]">
                <span>{isBm ? "Ctrl+Enter untuk cari kod" : "Ctrl+Enter to find codes"}</span>
                <span>{note.length} {isBm ? "aksara" : "characters"}</span>
              </div>
            </div>
          </section>

          <section className="min-w-0 overflow-hidden rounded border border-[#C9D1CF] bg-white">
            <div className="border-b border-[#DCE3E1] px-4 py-3">
              <h2 className="font-semibold">{isBm ? "Kod dicadangkan" : "Suggested codes"}</h2>
            </div>
            <p className="border-b border-[#DCE3E1] px-4 py-3 text-xs text-[#405955]">
              {isBm
                ? "Cadangan sistem. Sila semak setiap kod sebelum menyimpan."
                : "System suggestions. Review each code before saving."}
            </p>
            {result ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] border-collapse text-left text-sm">
                    <thead className="bg-[#F4F7F6] text-xs font-semibold text-[#354B46]">
                      <tr>
                        <th className="w-20 border-b border-[#C9D1CF] px-3 py-2.5 text-center">{isBm ? "Terima" : "Accept"}</th>
                        <th className="w-20 border-b border-[#C9D1CF] px-3 py-2.5">{isBm ? "Kod" : "Code"}</th>
                        <th className="border-b border-[#C9D1CF] px-3 py-2.5">{isBm ? "Penerangan" : "Description"}</th>
                        {settings.showEvidence && (
                          <th className="w-44 border-b border-[#C9D1CF] px-3 py-2.5">{isBm ? "Petikan rekod" : "Record excerpt"}</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {result.codes.map((item, index) => {
                        const style = highlightStyles[index % highlightStyles.length];
                        return (
                          <tr
                            className={`border-l-4 ${style.border} ${
                              hoveredCode === item.code ? "outline outline-2 outline-offset-[-2px] outline-[#1F5446]" : ""
                            }`}
                            key={item.id}
                            onMouseEnter={() => setHoveredCode(item.code)}
                            onMouseLeave={() => setHoveredCode(null)}
                          >
                            <td className="border-b border-[#DCE3E1] px-3 py-3 text-center">
                              <input
                                checked={selected.includes(item.id)}
                                className="h-4 w-4 accent-[#1F5446]"
                                onChange={() =>
                                  setSelected((current) =>
                                    current.includes(item.id)
                                      ? current.filter((id) => id !== item.id)
                                      : [...current, item.id]
                                  )
                                }
                                type="checkbox"
                              />
                            </td>
                            <td className="border-b border-[#DCE3E1] px-3 py-3 font-mono font-semibold text-[#1F5446]">{item.code}</td>
                            <td className="border-b border-[#DCE3E1] px-3 py-3">{isBm ? item.labelMs : item.labelEn}</td>
                            {settings.showEvidence && (
                              <td className="border-b border-[#DCE3E1] px-3 py-3 font-mono text-xs text-[#405955]">“{item.evidence}”</td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {result.negated.length > 0 && (
                  <div className="p-4">
                    <h3 className="mb-2 text-sm font-semibold">{isBm ? "Tidak dikodkan" : "Not coded"}</h3>
                    <div className="space-y-2">
                      {result.negated.map((item) => (
                        <div className="flex gap-4 rounded border border-[#C9D1CF] border-l-4 border-l-[#7A8784] bg-[#F7F8F8] px-3 py-2.5" key={`${item.start}-${item.text}`}>
                          <code className="text-xs font-semibold line-through">{item.text}</code>
                          <span className="text-xs text-[#52635F]">
                            {isBm ? item.meaningMs : "Negated: no shortness of breath"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="px-4 py-12 text-center text-sm text-[#52635F]">
                {searching
                  ? isBm
                    ? "Sedang menganalisis catatan..."
                    : "Analysing visit details..."
                  : isBm
                    ? "Cari kod untuk melihat cadangan."
                    : "Find codes to view suggestions."}
              </div>
            )}
          </section>
        </div>
      </main>

      <div className="sticky bottom-0 z-20 border-t border-[#C9D1CF] bg-white px-4 py-3 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[#52635F]">
            {isBm ? "Disemak oleh" : "Reviewed by"}: {settings.displayName}
          </p>
          <div className="flex gap-3">
            <button
              className="h-10 rounded border border-[#9FB0AD] bg-white px-4 text-sm font-semibold text-[#1F5446] hover:bg-[#F1F4F3]"
              onClick={() => save("Draf")}
            >
              {isBm ? "Simpan draf" : "Save draft"}
            </button>
            <button
              className="h-10 rounded bg-[#1F5446] px-4 text-sm font-semibold text-white hover:bg-[#173F35] disabled:bg-[#7E9891]"
              disabled={!result || selected.length === 0}
              onClick={() => save("Disahkan")}
            >
              {isBm ? `Sahkan ${selected.length} kod` : `Confirm ${selected.length} codes`}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
