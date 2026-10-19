export type AnalyzedCode = {
  id: string;
  code: string;
  labelMs: string;
  labelEn: string;
  evidence: string;
  /** Character span in the note; -1 when the code has no evidence span (model-only or added manually). */
  start: number;
  end: number;
  source?: "rules" | "model" | "rules+model" | "gemini" | "catalogue" | "manual";
  modelScore?: number | null;
};

/** A browseable ICD-11 code from the full WHO MMS catalogue (not a trained suggestion). */
export type CatalogueSuggestion = {
  code: string;
  labelEn: string;
  labelMs?: string | null;
  score: number;
  tier1: boolean;
};

export type NegatedPhrase = {
  text: string;
  start: number;
  end: number;
  meaningMs: string;
};

export type AnalysisResult = {
  codes: AnalyzedCode[];
  negated: NegatedPhrase[];
  duration: { value: number; unit: string } | null;
  expandedNote: string;
  catalogueSuggestions?: CatalogueSuggestion[];
  codeSystem?: string;
};

export function analyzeNote(text: string): AnalysisResult {
  const lower = text.toLocaleLowerCase();
  const negated: NegatedPhrase[] = [];
  const negationRules = [
    { phrase: "no sob", meaningMs: "Dinafikan: tiada sesak nafas" },
    { phrase: "tiada sesak nafas", meaningMs: "Dinafikan: tiada sesak nafas" },
  ];

  for (const rule of negationRules) {
    let start = lower.indexOf(rule.phrase);
    while (start >= 0) {
      negated.push({
        text: text.slice(start, start + rule.phrase.length),
        start,
        end: start + rule.phrase.length,
        meaningMs: rule.meaningMs,
      });
      start = lower.indexOf(rule.phrase, start + rule.phrase.length);
    }
  }

  const rules = [
    { term: "demam", code: "R50.9", labelMs: "Demam, tidak dinyatakan", labelEn: "Fever, unspecified" },
    { term: "batuk", code: "R05", labelMs: "Batuk", labelEn: "Cough" },
    { term: "selesema", code: "J00", labelMs: "Nasofaringitis akut (selesema)", labelEn: "Acute nasopharyngitis (common cold)" },
    { term: "tekak merah", code: "J02.9", labelMs: "Faringitis akut, tidak dinyatakan", labelEn: "Acute pharyngitis, unspecified" },
    { term: "sakit kepala", code: "R51", labelMs: "Sakit kepala", labelEn: "Headache" },
    { term: "kencing manis", code: "E11", labelMs: "Diabetes mellitus jenis 2", labelEn: "Type 2 diabetes mellitus" },
    { term: "darah tinggi", code: "I10", labelMs: "Hipertensi primer", labelEn: "Essential hypertension" },
    { term: "sesak nafas", code: "R06.0", labelMs: "Dispnea", labelEn: "Dyspnoea" },
  ];

  const codes: AnalyzedCode[] = [];
  for (const rule of rules) {
    const start = lower.indexOf(rule.term);
    if (start < 0) continue;

    const end = start + rule.term.length;
    const isNegated = negated.some((item) => start >= item.start && end <= item.end);
    if (isNegated) continue;

    codes.push({
      id: `${rule.code}-${start}`,
      code: rule.code,
      labelMs: rule.labelMs,
      labelEn: rule.labelEn,
      evidence: text.slice(start, end),
      start,
      end,
    });
  }

  const durationMatch = lower.match(/(\d+)\s*(hari|ari|day|days|minggu|week|weeks|bulan|month|months)/);
  const duration = durationMatch
    ? { value: Number(durationMatch[1]), unit: durationMatch[2] }
    : null;

  const expandedNote = text
    .replace(/\bpt\b/gi, "pesakit")
    .replace(/\bdtg\b/gi, "datang")
    .replace(/\bhx\b/gi, "sejarah")
    .replace(/\bari\b/gi, "hari")
    .replace(/\bc\/o\b/gi, "mengadu")
    .replace(/\bSOB\b/gi, "sesak nafas");

  return { codes, negated, duration, expandedNote };
}
