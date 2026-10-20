// Malaysian identity card (MyKad) helpers: YYMMDD-PB-###G, where the last digit is odd for male, even for female.

export function icDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 12);
}

/** Formats as the user types: "8905121" -> "890512-1", "890512105678" -> "890512-10-5678". */
export function formatIc(value: string): string {
  const digits = icDigits(value);
  if (digits.length <= 6) return digits;
  if (digits.length <= 8) return `${digits.slice(0, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`;
}

/** Birth date (YYYY-MM-DD) from the first six digits, or null if they aren't a real date or are in the future. */
export function birthDateFromIc(value: string, today = new Date()): string | null {
  const digits = icDigits(value);
  if (digits.length < 6) return null;
  const yy = Number(digits.slice(0, 2));
  const mm = Number(digits.slice(2, 4));
  const dd = Number(digits.slice(4, 6));
  const year = yy > today.getFullYear() % 100 ? 1900 + yy : 2000 + yy;
  const date = new Date(year, mm - 1, dd);
  if (date.getFullYear() !== year || date.getMonth() !== mm - 1 || date.getDate() !== dd || date > today) return null;
  return `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

/** "female" or "male" from the last digit of a complete IC number. */
export function sexFromIc(value: string): "female" | "male" | null {
  const digits = icDigits(value);
  if (digits.length !== 12) return null;
  return Number(digits[11]) % 2 === 1 ? "male" : "female";
}

/** Whole years between a YYYY-MM-DD birth date and today. */
export function ageFrom(birthDate: string, today = new Date()): number {
  const [year, month, day] = birthDate.split("-").map(Number);
  let age = today.getFullYear() - year;
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age -= 1;
  return Math.max(0, age);
}

/** A patient's current age: from the birth date when known, else the age recorded at registration. */
export function currentAge(patient: { age: number; birthDate?: string }, today = new Date()): number {
  return patient.birthDate ? ageFrom(patient.birthDate, today) : patient.age;
}

/** YYYY-MM-DD -> DD/MM/YYYY. */
export function formatDayMonthYear(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

/** Today's date as YYYY-MM-DD in local time. */
export function todayIso(today = new Date()): string {
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

/** Formats a typed date as DD/MM/YYYY: "120519" -> "12/05/19", "12051989" -> "12/05/1989". */
export function formatDateInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** DD/MM/YYYY -> YYYY-MM-DD, or null if it isn't a real date, is in the future, or is over 130 years ago. */
export function parseDayMonthYear(value: string, today = new Date()): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  if (date > today || year < today.getFullYear() - 130) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}
