import { useState } from "react";
import type { Patient } from "./data";
import {
  ageFrom,
  birthDateFromIc,
  formatDateInput,
  formatDayMonthYear,
  formatIc,
  icDigits,
  parseDayMonthYear,
  sexFromIc,
  todayIso,
} from "./identity";
import { Icon } from "./ui";

type FormErrors = Partial<Record<"name" | "ic" | "birthDate" | "sex", string>>;

// birthDate is typed as DD/MM/YYYY. For a new patient, it and sex are filled in from the IC number until the nurse
// edits them; when editing, they only change if the nurse changes them.
function initialForm(patient?: Patient) {
  if (!patient) {
    return { name: "", ic: "", birthDate: "", birthDateFromIc: true, sex: "", sexFromIc: true, allergy: "" };
  }
  const birthDate = patient.birthDate ?? birthDateFromIc(patient.ic);
  return {
    name: patient.name,
    ic: formatIc(patient.ic),
    birthDate: birthDate ? formatDayMonthYear(birthDate) : "",
    birthDateFromIc: false,
    sex: patient.sexEn === "Male" ? "male" : "female",
    sexFromIc: false,
    allergy: patient.allergiesMs === "Tiada diketahui" ? "" : patient.allergiesMs,
  };
}

/** Register a new patient, or edit an existing one when `patient` is given. */
export function PatientFormModal({
  isBm,
  onClose,
  onSave,
  patient,
  patients,
}: {
  isBm: boolean;
  onClose: () => void;
  onSave: (patient: Patient) => void;
  patient?: Patient;
  patients: Patient[];
}) {
  const [form, setForm] = useState(() => initialForm(patient));
  const [errors, setErrors] = useState<FormErrors>({});
  const birthIso = parseDayMonthYear(form.birthDate);
  const title = patient
    ? isBm ? "Kemas kini butiran pesakit" : "Edit patient details"
    : isBm ? "Daftar pesakit baharu" : "Register new patient";

  function changeIc(value: string) {
    const ic = formatIc(value);
    const fromIc = birthDateFromIc(ic);
    const sex = sexFromIc(ic);
    setForm((current) => ({
      ...current,
      ic,
      birthDate: current.birthDateFromIc ? (fromIc ? formatDayMonthYear(fromIc) : "") : current.birthDate,
      sex: current.sexFromIc ? sex ?? "" : current.sex,
    }));
    setErrors((current) => ({ ...current, ic: undefined, birthDate: undefined, sex: undefined }));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = form.name.trim().replace(/\s+/g, " ");
    const digits = icDigits(form.ic);
    const next: FormErrors = {};
    if (!name) next.name = isBm ? "Masukkan nama penuh." : "Enter the full name.";
    if (digits.length !== 12) {
      next.ic = isBm ? "No. kad pengenalan mesti 12 digit." : "The identity card no. must be 12 digits.";
    } else if (!birthDateFromIc(digits)) {
      next.ic = isBm ? "6 digit pertama bukan tarikh lahir yang sah." : "The first 6 digits aren't a valid birth date.";
    } else if (patients.some((item) => item.id !== patient?.id && icDigits(item.ic) === digits)) {
      next.ic = isBm ? "Pesakit dengan no. kad pengenalan ini sudah didaftarkan." : "A patient with this identity card no. is already registered.";
    }
    if (!birthIso) next.birthDate = isBm ? "Masukkan tarikh lahir yang sah (HH/BB/TTTT)." : "Enter a valid date of birth (DD/MM/YYYY).";
    if (!form.sex) next.sex = isBm ? "Pilih jantina." : "Choose the sex.";
    setErrors(next);
    if (Object.keys(next).length > 0 || !birthIso) return;
    onSave({
      ...patient,
      id: patient?.id ?? `patient-${Date.now()}`,
      name,
      age: ageFrom(birthIso),
      birthDate: birthIso,
      sexMs: form.sex === "male" ? "Lelaki" : "Perempuan",
      sexEn: form.sex === "male" ? "Male" : "Female",
      ic: formatIc(digits),
      lastVisit: patient?.lastVisit ?? todayIso(),
      allergiesMs: form.allergy.trim() || "Tiada diketahui",
      allergiesEn: form.allergy.trim() || "None known",
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-8" role="presentation" onMouseDown={onClose}>
      <section
        aria-labelledby="patient-form-title"
        aria-modal="true"
        className="max-h-full w-full max-w-[700px] overflow-y-auto rounded border border-[#C9D1CF] bg-white"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#DCE3E1] px-5 py-4">
          <h2 className="font-semibold" id="patient-form-title">{title}</h2>
          <button aria-label={isBm ? "Tutup" : "Close"} className="rounded p-2 text-[#405955] hover:bg-[#EDF2F1]" onClick={onClose}>
            <Icon name="close" size={18} />
          </button>
        </div>
        <form noValidate onSubmit={submit}>
          <div className="grid gap-5 p-5 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="mb-2 block text-sm font-semibold">{isBm ? "Nama penuh" : "Full name"}</span>
              <input aria-invalid={Boolean(errors.name)} autoFocus className={fieldClass(errors.name)} value={form.name} onChange={(event) => { setForm({ ...form, name: event.target.value }); setErrors({ ...errors, name: undefined }); }} />
              <FieldError message={errors.name} />
            </label>
            <label>
              <span className="mb-2 block text-sm font-semibold">{isBm ? "No. kad pengenalan" : "Identity card no."}</span>
              <input aria-invalid={Boolean(errors.ic)} className={`${fieldClass(errors.ic)} font-mono`} inputMode="numeric" placeholder="890512-10-5678" value={form.ic} onChange={(event) => changeIc(event.target.value)} />
              <FieldError message={errors.ic} />
            </label>
            <label>
              <span className="mb-2 block text-sm font-semibold">{isBm ? "Tarikh lahir" : "Date of birth"}</span>
              <input
                aria-invalid={Boolean(errors.birthDate)}
                className={fieldClass(errors.birthDate)}
                inputMode="numeric"
                placeholder={isBm ? "HH/BB/TTTT" : "DD/MM/YYYY"}
                value={form.birthDate}
                onChange={(event) => {
                  setForm({ ...form, birthDate: formatDateInput(event.target.value), birthDateFromIc: false });
                  setErrors({ ...errors, birthDate: undefined });
                }}
              />
              {errors.birthDate ? <FieldError message={errors.birthDate} /> : (
                <span className="mt-1 block text-xs text-[#52635F]">
                  {birthIso
                    ? `${ageFrom(birthIso)} ${isBm ? "tahun" : "years old"}${form.birthDateFromIc ? (isBm ? " · daripada no. kad pengenalan" : " · from the identity card no.") : ""}`
                    : isBm ? "Diisi daripada no. kad pengenalan." : "Filled in from the identity card no."}
                </span>
              )}
            </label>
            <label>
              <span className="mb-2 block text-sm font-semibold">{isBm ? "Jantina" : "Sex"}</span>
              <select aria-invalid={Boolean(errors.sex)} className={`${fieldClass(errors.sex)} bg-white`} value={form.sex} onChange={(event) => { setForm({ ...form, sex: event.target.value, sexFromIc: false }); setErrors({ ...errors, sex: undefined }); }}>
                <option disabled value="">{isBm ? "Pilih" : "Choose"}</option>
                <option value="female">{isBm ? "Perempuan" : "Female"}</option>
                <option value="male">{isBm ? "Lelaki" : "Male"}</option>
              </select>
              <FieldError message={errors.sex} />
            </label>
            <label>
              <span className="mb-2 block text-sm font-semibold">{isBm ? "Alergi (pilihan)" : "Allergy (optional)"}</span>
              <input className={fieldClass()} placeholder={isBm ? "cth. Penisilin" : "e.g. Penicillin"} value={form.allergy} onChange={(event) => setForm({ ...form, allergy: event.target.value })} />
            </label>
          </div>
          <div className="flex justify-end gap-3 border-t border-[#DCE3E1] px-5 py-4">
            <button className="h-10 rounded border border-[#9FB0AD] bg-white px-4 text-sm font-semibold text-[#1F5446] hover:bg-[#F1F4F3]" onClick={onClose} type="button">
              {isBm ? "Batal" : "Cancel"}
            </button>
            <button className="h-10 rounded bg-[#1F5446] px-5 text-sm font-semibold text-white hover:bg-[#173F35]" type="submit">{isBm ? "Simpan" : "Save"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function fieldClass(error?: string) {
  return `h-10 w-full rounded border px-3 text-sm outline-none focus:ring-2 ${
    error ? "border-[#B42318] focus:ring-[#B42318]/20" : "border-[#9FB0AD] focus:border-[#1F5446] focus:ring-[#1F5446]/20"
  }`;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <span className="mt-1 block text-xs font-medium text-[#B42318]">{message}</span>;
}
