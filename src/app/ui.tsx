import type { ReactNode } from "react";
import { Link } from "react-router";
import type { AnalysisResult, AnalyzedCode, NegatedPhrase } from "../lib/analyze";
import type { Language, NoteRecord, Patient } from "./data";
import { useStore } from "./store";

export type IconName =
  | "clipboard"
  | "history"
  | "users"
  | "help"
  | "settings"
  | "menu"
  | "close"
  | "search"
  | "chevron"
  | "home";

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    clipboard: (
      <>
        <rect x="5" y="4" width="14" height="17" rx="2" />
        <path d="M9 4.5V3h6v1.5M8.5 10h7M8.5 14h7M8.5 18h4" />
      </>
    ),
    history: (
      <>
        <path d="M3.5 12a8.5 8.5 0 1 0 2.2-5.7L3.5 8.5" />
        <path d="M3.5 4v4.5H8M12 7.5V12l3 2" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19c.4-3.4 2.2-5 5.5-5s5.1 1.6 5.5 5M15.5 5.4a3 3 0 0 1 0 5.2M16.5 14c2.3.5 3.6 2.1 3.8 4.5" />
      </>
    ),
    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.8 9a2.3 2.3 0 1 1 3 2.2c-.8.3-.8 1-.8 1.8M12 17h.01" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a8 8 0 0 0-1.8-1L14.4 3h-4.8l-.4 3.1a8 8 0 0 0-1.8 1l-2.4-1-2 3.4L5.1 11a7 7 0 0 0 0 2L3 14.5l2 3.4 2.4-1a8 8 0 0 0 1.8 1l.4 3.1h4.8l.4-3.1a8 8 0 0 0 1.8-1l2.4 1 2-3.4-2.1-1.5a7 7 0 0 0 .1-1Z" />
      </>
    ),
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m15.5 15.5 4 4" />
      </>
    ),
    chevron: <path d="m9 18 6-6-6-6" />,
    home: (
      <>
        <path d="m3.5 10 8.5-7 8.5 7" />
        <path d="M5.5 9v11h13V9M9.5 20v-6h5v6" />
      </>
    ),
  };

  return (
    <svg aria-hidden="true" fill="none" height={size} viewBox="0 0 24 24" width={size}>
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
        {paths[name]}
      </g>
    </svg>
  );
}

export function LanguageToggle() {
  const { language, setLanguage } = useStore();
  const isBm = language === "bm";
  return (
    <button
      aria-label={isBm ? "Tukar bahasa ke English" : "Change language to Bahasa Melayu"}
      className="flex items-center overflow-hidden rounded border border-[#9FB0AD] bg-white text-[10px] font-bold"
      onClick={() => setLanguage(isBm ? "en" : "bm")}
    >
      <span className={`px-2 py-1 ${isBm ? "bg-[#1F5446] text-white" : "text-[#3F504D]"}`}>
        BM
      </span>
      <span className={`px-2 py-1 ${!isBm ? "bg-[#1F5446] text-white" : "text-[#3F504D]"}`}>
        EN
      </span>
    </button>
  );
}

export function PageHeader({
  title,
  crumbs,
  prominent = false,
}: {
  title: string;
  crumbs: { label: string; to?: string }[];
  prominent?: boolean;
}) {
  return (
    <div className="mb-5">
      {crumbs.length > 0 && (
        <nav className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-[#52635F]">
          {crumbs.map((item, index) => (
            <span className="flex items-center gap-1.5" key={`${item.label}-${index}`}>
              {index > 0 && <span aria-hidden="true">›</span>}
              {item.to ? (
                <Link className="hover:text-[#1F5446] hover:underline" to={item.to}>
                  {item.label}
                </Link>
              ) : (
                <span className="font-semibold text-[#1F5446]">{item.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <h1 className={`${prominent ? "text-3xl sm:text-4xl" : "text-2xl"} font-bold tracking-[-0.02em] text-[#1A1A1A]`}>{title}</h1>
    </div>
  );
}

export function PatientBanner({ patient, isBm }: { patient: Patient; isBm: boolean }) {
  const hasAllergy = patient.allergiesMs !== "Tiada diketahui";
  return (
    <section className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-2 rounded border border-[#C9D1CF] bg-white px-4 py-3 text-sm">
      <strong className="font-semibold">{patient.name}</strong>
      <span>{patient.age} {isBm ? "tahun" : "years"}</span>
      <span>{isBm ? patient.sexMs : patient.sexEn}</span>
      <span className="font-mono text-xs text-[#52635F]">{patient.ic}</span>
      <span className={hasAllergy ? "rounded border border-[#DED39A] bg-[#FFFBE8] px-2 py-1 font-semibold text-[#655A29]" : "text-[#405955]"}>
        {isBm ? "Alergi" : "Allergy"}: {isBm ? patient.allergiesMs : patient.allergiesEn}
      </span>
    </section>
  );
}

export function formatAuditDate(value: string, language: Language) {
  return new Intl.DateTimeFormat(language === "bm" ? "ms-MY" : "en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function ConfirmationLine({
  record,
  language,
}: {
  record: NoteRecord;
  language: Language;
}) {
  if (record.status !== "Disahkan" || !record.confirmedAt) return null;
  return (
    <p className="mt-1 text-xs text-[#52635F]">
      {language === "bm" ? "Disahkan oleh" : "Confirmed by"}{" "}
      {record.confirmedBy ?? "—"}, {formatAuditDate(record.confirmedAt, language)}
    </p>
  );
}

export function RecordDateTime({
  value,
  language,
}: {
  value: string;
  language: Language;
}) {
  const date = new Date(value);
  const locale = language === "bm" ? "ms-MY" : "en-MY";
  return (
    <div className="whitespace-nowrap">
      <span className="block font-normal">
        {new Intl.DateTimeFormat(locale, {
          day: "numeric",
          month: "short",
          year: "numeric",
        }).format(date)}
      </span>
      <span className="mt-0.5 block text-xs text-[#52635F]">
        {new Intl.DateTimeFormat(locale, {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(date)}
      </span>
    </div>
  );
}

export function RecordCodeChips({ record }: { record: NoteRecord }) {
  const codes = record.codes.filter((code) => !code.removed);
  const visible = codes.slice(0, 3);
  return (
    <div className="flex flex-nowrap items-center gap-1 whitespace-nowrap">
      {visible.map((code) => (
        <span className="rounded border border-[#C9D1CF] bg-[#F4F7F6] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#1F5446]" key={code.id}>
          {code.code}
        </span>
      ))}
      {codes.length > 3 && (
        <span className="rounded border border-[#C9D1CF] bg-[#F4F7F6] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#52635F]">
          +{codes.length - 3}
        </span>
      )}
      {codes.length === 0 && <span className="text-[#52635F]">—</span>}
    </div>
  );
}

export function RecordBy({
  record,
  language,
  currentUser,
}: {
  record: NoteRecord;
  language: Language;
  currentUser: string;
}) {
  const name = record.status === "Draf" ? record.lastEditedBy : record.confirmedBy;
  const role = record.status === "Draf"
    ? language === "bm" ? record.lastEditedRoleMs : record.lastEditedRoleEn
    : language === "bm" ? record.confirmedRoleMs : record.confirmedRoleEn;
  if (name === currentUser) {
    return <span className="font-medium">{language === "bm" ? "Anda" : "You"}</span>;
  }
  return (
    <div className="min-w-0">
      <span className="block truncate font-medium">{name ?? "—"}</span>
      {role && <span className="mt-0.5 block truncate text-xs text-[#52635F]">{role}</span>}
    </div>
  );
}

export function RecordStatusBadge({
  record,
  language,
}: {
  record: NoteRecord;
  language: Language;
}) {
  const isDraft = record.status === "Draf";
  return (
    <span className={`inline-flex whitespace-nowrap rounded border px-2 py-1 text-xs font-semibold ${
      isDraft
        ? "border-[#C9D1CF] bg-[#F1F3F2] text-[#52635F]"
        : "border-[#A8C4BC] bg-[#EEF5F3] text-[#1F5446]"
    }`}>
      {isDraft
        ? language === "bm" ? "Draf" : "Draft"
        : record.amendments?.length
          ? language === "bm" ? "Disahkan (dipinda)" : "Confirmed (amended)"
          : language === "bm" ? "Disahkan" : "Confirmed"}
    </span>
  );
}

export const highlightStyles = [
  { border: "border-l-[#4F9B8B]", mark: "bg-[#DDF1EC] decoration-[#317D6D]" },
  { border: "border-l-[#C18A2F]", mark: "bg-[#FAEBCB] decoration-[#A26D18]" },
  { border: "border-l-[#557FA8]", mark: "bg-[#DEEAF5] decoration-[#3F6F9D]" },
  { border: "border-l-[#AF6873]", mark: "bg-[#F5E1E4] decoration-[#96515D]" },
  { border: "border-l-[#6E8197]", mark: "bg-[#E4EAF0] decoration-[#536980]" },
  { border: "border-l-[#8A729E]", mark: "bg-[#ECE5F1] decoration-[#705A84]" },
  { border: "border-l-[#657D55]", mark: "bg-[#E5ECDD] decoration-[#536A44]" },
  { border: "border-l-[#9A6751]", mark: "bg-[#F1E5DF] decoration-[#80523F]" },
];

type Segment = {
  key: string;
  start: number;
  end: number;
  text: string;
  code?: AnalyzedCode;
  removedCode?: AnalyzedCode;
  negated?: NegatedPhrase;
  styleIndex: number;
};

export function HighlightedNote({
  text,
  result,
  hoveredCode,
  setHoveredCode,
  removedCodes = [],
}: {
  text: string;
  result: Pick<AnalysisResult, "codes" | "negated">;
  hoveredCode: string | null;
  setHoveredCode: (code: string | null) => void;
  removedCodes?: AnalyzedCode[];
}) {
  const segments: Segment[] = [
    // Keep styleIndex aligned with the code table; codes without an evidence span (start = -1) are not highlighted.
    ...result.codes.map((code, index) => ({
      key: code.id,
      start: code.start,
      end: code.end,
      text: text.slice(code.start, code.end),
      code,
      styleIndex: index,
    })).filter((segment) => segment.start >= 0),
    ...result.negated.map((negated, index) => ({
      key: `negated-${index}-${negated.start}`,
      start: negated.start,
      end: negated.end,
      text: text.slice(negated.start, negated.end),
      negated,
      styleIndex: 0,
    })),
    ...removedCodes.filter((code) => code.start >= 0).map((code) => ({
      key: `removed-${code.id}`,
      start: code.start,
      end: code.end,
      text: text.slice(code.start, code.end),
      removedCode: code,
      styleIndex: 0,
    })),
  ].sort((a, b) => a.start - b.start);

  let cursor = 0;
  const content: ReactNode[] = [];
  for (const segment of segments) {
    if (segment.start > cursor) content.push(text.slice(cursor, segment.start));
    if (segment.code) {
      const style = highlightStyles[segment.styleIndex % highlightStyles.length];
      content.push(
        <mark
          className={`cursor-default text-inherit underline decoration-2 underline-offset-4 ${style.mark} ${
            hoveredCode === segment.code.code ? "outline outline-2 outline-[#1F5446]" : ""
          }`}
          key={segment.key}
          onMouseEnter={() => setHoveredCode(segment.code?.code ?? null)}
          onMouseLeave={() => setHoveredCode(null)}
        >
          {segment.text}
        </mark>
      );
    } else if (segment.removedCode) {
      content.push(
        <span
          className="cursor-default underline decoration-[#7A8784] decoration-dotted decoration-2 underline-offset-4"
          key={segment.key}
          title={segment.removedCode.code}
        >
          {segment.text}
        </span>
      );
    } else {
      content.push(
        <mark
          className="bg-[#E4E8E7] text-inherit line-through decoration-[#687572] decoration-2"
          key={segment.key}
        >
          {segment.text}
        </mark>
      );
    }
    cursor = Math.max(cursor, segment.end);
  }
  if (cursor < text.length) content.push(text.slice(cursor));

  return <>{content}</>;
}
