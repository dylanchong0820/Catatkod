import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AnalysisResult } from "../lib/analyze";
import {
  initialHistory,
  patients as initialPatients,
  type Language,
  type NoteRecord,
  type NoteStatus,
  type Patient,
  type RecordCode,
} from "./data";

export type Settings = {
  defaultLanguage: Language;
  textSize: "normal" | "large";
  showEvidence: boolean;
  displayName: string;
};

type AppStore = {
  authenticated: boolean;
  language: Language;
  settings: Settings;
  activePatient: Patient;
  patients: Patient[];
  history: NoteRecord[];
  login: () => void;
  logout: () => void;
  setLanguage: (language: Language) => void;
  setSettings: (settings: Settings) => void;
  setActivePatient: (patient: Patient) => void;
  addPatient: (patient: Patient) => void;
  saveNote: (note: string, result: AnalysisResult, status: NoteStatus, draftId?: string) => NoteRecord;
  amendRecord: (
    recordId: string,
    reason: string,
    codes: RecordCode[],
    added: RecordCode[],
    removed: RecordCode[]
  ) => void;
  deleteDraft: (recordId: string) => void;
  resetDemoData: () => void;
};

const StoreContext = createContext<AppStore | null>(null);

function load<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

const defaultSettings: Settings = {
  defaultLanguage: "bm",
  textSize: "normal",
  showEvidence: true,
  displayName: "Nur Aisyah",
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [settings, setSettingsState] = useState<Settings>(() =>
    load("catatkod-settings", defaultSettings)
  );
  const [language, setLanguageState] = useState<Language>(() =>
    load("catatkod-language", load("catatkod-settings", defaultSettings).defaultLanguage)
  );
  const [activePatient, setActivePatientState] = useState<Patient>(() =>
    load("catatkod-patient", initialPatients[0])
  );
  const [patients, setPatients] = useState<Patient[]>(() =>
    load("catatkod-patients-v5", initialPatients)
  );
  const [history, setHistory] = useState<NoteRecord[]>(() =>
    load<NoteRecord[]>("catatkod-history-v5", initialHistory).map((record) => {
      const codes = record.codes.map((code) => ({
        ...code,
        origin: code.origin ?? "original" as const,
        removed: code.removed ?? false,
      }));
      return {
        ...record,
        codes,
        originalCodes: record.status === "Disahkan"
          ? record.originalCodes ?? codes.map((code) => ({ ...code, removed: false }))
          : undefined,
        confirmedBy: record.status === "Disahkan"
          ? record.confirmedBy ?? defaultSettings.displayName
          : undefined,
        confirmedAt: record.status === "Disahkan"
          ? record.confirmedAt ?? record.date
          : undefined,
        amendments: (record.amendments ?? [])
          .filter((item) => !["blabla", "asdkf", "asdf"].includes(item.reason.trim().toLowerCase()))
          .map((item) => ({ ...item, added: item.added ?? [], removed: item.removed ?? [] })),
      };
    })
  );

  useEffect(() => {
    window.localStorage.setItem("catatkod-language", JSON.stringify(language));
  }, [language]);

  useEffect(() => {
    window.localStorage.setItem("catatkod-settings", JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    window.localStorage.setItem("catatkod-patient", JSON.stringify(activePatient));
  }, [activePatient]);

  useEffect(() => {
    window.localStorage.setItem("catatkod-history-v5", JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    window.localStorage.setItem("catatkod-patients-v5", JSON.stringify(patients));
  }, [patients]);

  const value = useMemo<AppStore>(
    () => ({
      authenticated,
      language,
      settings,
      activePatient,
      patients,
      history,
      login: () => setAuthenticated(true),
      logout: () => setAuthenticated(false),
      setLanguage: setLanguageState,
      setSettings: (next) => {
        setSettingsState(next);
        setLanguageState(next.defaultLanguage);
      },
      setActivePatient: setActivePatientState,
      addPatient: (patient) => setPatients((current) => [...current, patient]),
      saveNote: (note, result, status, draftId) => {
        const now = new Date().toISOString();
        const record: NoteRecord = {
          id: draftId ?? `record-${Date.now()}`,
          date: now,
          patient: activePatient,
          note,
          codes: result.codes.map((code) => ({ ...code, origin: "original", removed: false })),
          originalCodes: status === "Disahkan"
            ? result.codes.map((code) => ({ ...code, origin: "original", removed: false }))
            : undefined,
          negated: result.negated,
          status,
          confirmedBy: status === "Disahkan" ? settings.displayName : undefined,
          confirmedRoleMs: status === "Disahkan" ? "Jururawat" : undefined,
          confirmedRoleEn: status === "Disahkan" ? "Nurse" : undefined,
          confirmedAt: status === "Disahkan" ? now : undefined,
          lastEditedBy: settings.displayName,
          lastEditedRoleMs: "Jururawat",
          lastEditedRoleEn: "Nurse",
          amendments: [],
        };
        setHistory((current) => [
          record,
          ...current.filter((item) => item.id !== draftId),
        ]);
        return record;
      },
      amendRecord: (recordId, reason, codes, added, removed) => {
        setHistory((current) => current.map((record) =>
          record.id === recordId
            ? {
                ...record,
                codes,
                originalCodes: record.originalCodes ?? record.codes.map((code) => ({
                  ...code,
                  origin: "original",
                  removed: false,
                })),
                amendments: [
                  ...(record.amendments ?? []),
                  {
                    id: `amendment-${Date.now()}`,
                    date: new Date().toISOString(),
                    user: settings.displayName,
                    roleMs: "Jururawat",
                    roleEn: "Nurse",
                    reason,
                    added: added.map(({ code, labelMs, labelEn }) => ({ code, labelMs, labelEn })),
                    removed: removed.map(({ code, labelMs, labelEn }) => ({ code, labelMs, labelEn })),
                  },
                ],
              }
            : record
        ));
      },
      deleteDraft: (recordId) => {
        setHistory((current) => current.filter((record) =>
          record.id !== recordId || record.status !== "Draf"
        ));
      },
      resetDemoData: () => {
        setPatients(initialPatients);
        setActivePatientState(initialPatients[0]);
        setHistory(initialHistory);
      },
    }),
    [activePatient, authenticated, history, language, patients, settings]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside StoreProvider");
  return value;
}
