import { analyzeNote, type AnalyzedCode, type NegatedPhrase } from "../lib/analyze";

export type Language = "bm" | "en";
export type NoteStatus = "Disahkan" | "Draf";

export type Amendment = {
  id: string;
  date: string;
  user: string;
  roleMs?: string;
  roleEn?: string;
  reason: string;
  added: { code: string; labelMs: string; labelEn: string }[];
  removed: { code: string; labelMs: string; labelEn: string }[];
};

export type RecordCode = AnalyzedCode & {
  origin?: "original" | "added";
  removed?: boolean;
};

export type Patient = {
  id: string;
  name: string;
  age: number;
  sexMs: string;
  sexEn: string;
  ic: string;
  lastVisit: string;
  allergiesMs: string;
  allergiesEn: string;
};

export type NoteRecord = {
  id: string;
  date: string;
  patient: Patient;
  note: string;
  codes: RecordCode[];
  originalCodes?: RecordCode[];
  negated: NegatedPhrase[];
  status: NoteStatus;
  confirmedBy?: string;
  confirmedRoleMs?: string;
  confirmedRoleEn?: string;
  confirmedAt?: string;
  lastEditedBy?: string;
  lastEditedRoleMs?: string;
  lastEditedRoleEn?: string;
  amendments?: Amendment[];
};

export const patients: Patient[] = [
  { id: "p1", name: "Ahmad Firdaus bin Ali", age: 37, sexMs: "Lelaki", sexEn: "Male", ic: "890512-10-5678", lastVisit: "2026-10-11", allergiesMs: "Tiada diketahui", allergiesEn: "None known" },
  { id: "p2", name: "Nurul Huda binti Rahman", age: 43, sexMs: "Perempuan", sexEn: "Female", ic: "830224-08-3146", lastVisit: "2026-10-12", allergiesMs: "Penisilin", allergiesEn: "Penicillin" },
  { id: "p3", name: "S. Mogan Raj", age: 59, sexMs: "Lelaki", sexEn: "Male", ic: "670901-14-2291", lastVisit: "2026-10-11", allergiesMs: "Tiada diketahui", allergiesEn: "None known" },
  { id: "p4", name: "Lee Mei Ling", age: 30, sexMs: "Perempuan", sexEn: "Female", ic: "960318-10-4824", lastVisit: "2026-10-10", allergiesMs: "Tiada diketahui", allergiesEn: "None known" },
  { id: "p5", name: "Mohd Hafiz bin Yusof", age: 65, sexMs: "Lelaki", sexEn: "Male", ic: "610707-06-1753", lastVisit: "2026-10-12", allergiesMs: "Tiada diketahui", allergiesEn: "None known" },
  { id: "p6", name: "Siti Aminah binti Omar", age: 52, sexMs: "Perempuan", sexEn: "Female", ic: "740411-03-6482", lastVisit: "2026-10-10", allergiesMs: "Tiada diketahui", allergiesEn: "None known" },
];

const seedRecords = [
  { date: "2026-10-14T10:41:00", patientIndex: 4, note: "pt darah tinggi, bacaan hari ini stabil. no SOB.", status: "Disahkan", user: "Dr. Farid Hakimi", roleMs: "Doktor", roleEn: "Doctor" },
  { date: "2026-10-14T09:18:00", patientIndex: 1, note: "pt batuk dan sakit kepala sejak 2 hari.", status: "Draf", user: "Nur Aisyah", roleMs: "Jururawat", roleEn: "Nurse" },
  { date: "2026-10-13T16:05:00", patientIndex: 3, note: "pt kencing manis untuk susulan. makan ubat seperti diarahkan.", status: "Disahkan", user: "Siti Rohana", roleMs: "Jururawat", roleEn: "Nurse" },
  { date: "2026-10-13T14:32:00", patientIndex: 2, note: "pt demam dan tekak merah sejak semalam.", status: "Disahkan", user: "Dr. Farid Hakimi", roleMs: "Doktor", roleEn: "Doctor" },
  { date: "2026-10-12T11:05:00", patientIndex: 5, note: "pt selesema, batuk 3 hari. tiada sesak nafas.", status: "Disahkan", user: "Nur Aisyah", roleMs: "Jururawat", roleEn: "Nurse" },
  { date: "2026-10-12T10:30:00", patientIndex: 0, note: "pt darah tinggi terkawal. no SOB.", status: "Disahkan", user: "Nur Aisyah", roleMs: "Jururawat", roleEn: "Nurse" },
  { date: "2026-10-11T09:10:00", patientIndex: 4, note: "pt sakit kepala sejak 1 hari.", status: "Draf", user: "Siti Rohana", roleMs: "Jururawat", roleEn: "Nurse" },
  { date: "2026-10-10T08:50:00", patientIndex: 3, note: "pt demam, selesema dan batuk 2 hari.", status: "Draf", user: "Nur Aisyah", roleMs: "Jururawat", roleEn: "Nurse" },
] as const;

export const initialHistory: NoteRecord[] = seedRecords.map((seed, index) => {
  const result = analyzeNote(seed.note);
  return {
    id: `seed-${index + 1}`,
    date: seed.date,
    patient: patients[seed.patientIndex],
    note: seed.note,
    codes: result.codes.map((code) => ({ ...code, origin: "original" as const, removed: false })),
    originalCodes: seed.status === "Disahkan"
      ? result.codes.map((code) => ({ ...code, origin: "original" as const, removed: false }))
      : undefined,
    negated: result.negated,
    status: seed.status,
    confirmedBy: seed.status === "Disahkan" ? seed.user : undefined,
    confirmedRoleMs: seed.status === "Disahkan" ? seed.roleMs : undefined,
    confirmedRoleEn: seed.status === "Disahkan" ? seed.roleEn : undefined,
    confirmedAt: seed.status === "Disahkan" ? seed.date : undefined,
    lastEditedBy: seed.user,
    lastEditedRoleMs: seed.roleMs,
    lastEditedRoleEn: seed.roleEn,
    amendments: [],
  };
});
