import type { AnalysisResult, CatalogueSuggestion } from "./analyze";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5001").replace(/\/$/, "");

type ApiError = { error?: string };

export async function analyzeNoteWithBackend(note: string): Promise<AnalysisResult> {
  const response = await fetch(`${API_BASE_URL}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note }),
  });

  const payload = (await response.json().catch(() => ({}))) as AnalysisResult & ApiError;
  if (!response.ok) {
    throw new Error(payload.error || `Analysis request failed (${response.status})`);
  }
  if (!Array.isArray(payload.codes) || !Array.isArray(payload.negated) || typeof payload.expandedNote !== "string") {
    throw new Error("The analysis service returned an unexpected response.");
  }
  return payload;
}

export async function searchIcd11(query: string, limit = 10): Promise<CatalogueSuggestion[]> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  const response = await fetch(`${API_BASE_URL}/api/icd11/search?${params}`);
  const payload = (await response.json().catch(() => ({}))) as { results?: CatalogueSuggestion[] } & ApiError;
  if (!response.ok) {
    throw new Error(payload.error || `Search request failed (${response.status})`);
  }
  if (!Array.isArray(payload.results)) {
    throw new Error("The search service returned an unexpected response.");
  }
  return payload.results;
}
