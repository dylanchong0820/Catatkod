import { useState } from "react";
import { useStore, type Settings } from "../store";
import { PageHeader } from "../ui";

export function SettingsPage() {
  const { language, settings, setSettings } = useStore();
  const [form, setForm] = useState<Settings>(settings);
  const [saved, setSaved] = useState(false);
  const isBm = language === "bm";

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  return (
    <main className="mx-auto max-w-[760px] px-4 py-5 sm:px-6 lg:px-8">
      <PageHeader
        crumbs={[
          { label: isBm ? "Utama" : "Home", to: "/utama" },
          { label: isBm ? "Tetapan" : "Settings" },
        ]}
        title={isBm ? "Tetapan" : "Settings"}
      />
      <form
        className="rounded border border-[#C9D1CF] bg-white"
        onSubmit={(event) => {
          event.preventDefault();
          setSettings(form);
          setSaved(true);
        }}
      >
        <div className="space-y-5 p-5">
          <div>
            <label className="mb-2 block text-sm font-semibold" htmlFor="default-language">
              {isBm ? "Bahasa lalai" : "Default language"}
            </label>
            <select
              className="h-10 w-full rounded border border-[#9FB0AD] bg-white px-3 text-sm sm:max-w-xs"
              id="default-language"
              onChange={(event) => update("defaultLanguage", event.target.value as "bm" | "en")}
              value={form.defaultLanguage}
            >
              <option value="bm">Bahasa Melayu</option>
              <option value="en">English</option>
            </select>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">{isBm ? "Saiz teks" : "Text size"}</p>
            <div className="flex gap-5">
              <label className="flex items-center gap-2 text-sm">
                <input
                  checked={form.textSize === "normal"}
                  className="accent-[#1F5446]"
                  name="text-size"
                  onChange={() => update("textSize", "normal")}
                  type="radio"
                />
                {isBm ? "Normal" : "Normal"}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  checked={form.textSize === "large"}
                  className="accent-[#1F5446]"
                  name="text-size"
                  onChange={() => update("textSize", "large")}
                  type="radio"
                />
                {isBm ? "Besar" : "Large"}
              </label>
            </div>
          </div>
          <label className="flex items-center gap-3 text-sm font-medium">
            <input
              checked={form.showEvidence}
              className="h-4 w-4 accent-[#1F5446]"
              onChange={(event) => update("showEvidence", event.target.checked)}
              type="checkbox"
            />
            {isBm ? "Tunjuk petikan rekod dalam jadual kod" : "Show record excerpts in the code table"}
          </label>
          <div>
            <label className="mb-2 block text-sm font-semibold" htmlFor="display-name">
              {isBm ? "Nama paparan" : "Display name"}
            </label>
            <input
              className="h-10 w-full rounded border border-[#9FB0AD] px-3 text-sm outline-none focus:border-[#1F5446] focus:ring-2 focus:ring-[#1F5446]/20 sm:max-w-sm"
              id="display-name"
              onChange={(event) => update("displayName", event.target.value)}
              value={form.displayName}
            />
          </div>
        </div>
        <div className="flex items-center gap-4 border-t border-[#DCE3E1] px-5 py-4">
          <button className="h-10 rounded bg-[#1F5446] px-4 text-sm font-semibold text-white hover:bg-[#173F35]" type="submit">
            {isBm ? "Simpan tetapan" : "Save settings"}
          </button>
          {saved && <span className="text-sm font-medium text-[#1F5446]">{isBm ? "Tetapan disimpan" : "Settings saved"}</span>}
        </div>
      </form>
    </main>
  );
}
