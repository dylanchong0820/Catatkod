import type { AnalyzedCode, NegatedPhrase } from "../lib/analyze";

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
  birthDate?: string; // YYYY-MM-DD, from the IC number when registered in the app
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

// Prototype sign-in accounts (demo only: these live in the app's code, so never reuse the passwords anywhere real).
export type StaffAccount = { id: string; password: string; name: string; roleMs: string; roleEn: string };

export const staffAccounts: StaffAccount[] = [
  { id: "0001", password: "1234", name: "Dylan Chong", roleMs: "Jururawat", roleEn: "Nurse" },
  { id: "0002", password: "1234", name: "Hansen Lee Ming Haw", roleMs: "Jururawat", roleEn: "Nurse" },
  { id: "0003", password: "1234", name: "Ivan Liew Chun Fui", roleMs: "Jururawat", roleEn: "Nurse" },
  { id: "0004", password: "1234", name: "Jordan Voo Yee Fung", roleMs: "Jururawat", roleEn: "Nurse" },
];
