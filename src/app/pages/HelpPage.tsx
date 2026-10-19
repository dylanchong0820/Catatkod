import { useStore } from "../store";
import { PageHeader } from "../ui";

export function HelpPage() {
  const { language } = useStore();
  const isBm = language === "bm";
  const abbreviations = [
    ["pt", isBm ? "pesakit" : "patient"],
    ["dtg", isBm ? "datang" : "comes / attended"],
    ["hx", isBm ? "sejarah" : "history"],
    ["ari", isBm ? "hari" : "day"],
    ["c/o", isBm ? "mengadu" : "complains of"],
  ];

  return (
    <main className="mx-auto max-w-[900px] px-4 py-5 sm:px-6 lg:px-8">
      <PageHeader
        crumbs={[
          { label: isBm ? "Utama" : "Home", to: "/utama" },
          { label: isBm ? "Bantuan & panduan" : "Help & guidance" },
        ]}
        title={isBm ? "Bantuan & panduan" : "Help & guidance"}
      />
      <div className="space-y-5">
        <section className="rounded border border-[#C9D1CF] bg-white p-4">
          <h2 className="mb-3 font-semibold">{isBm ? "Cara guna" : "How to use"}</h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-6">
            <li>{isBm ? "Pilih pesakit dan masukkan butiran lawatan ringkas." : "Select a patient and enter brief visit details."}</li>
            <li>{isBm ? "Tekan Cari kod atau gunakan Ctrl+Enter." : "Select Find codes or use Ctrl+Enter."}</li>
            <li>{isBm ? "Semak kod yang dicadangkan sebelum mengesahkan dan menyimpan." : "Review suggested codes before confirming and saving."}</li>
          </ol>
        </section>
        <section className="overflow-hidden rounded border border-[#C9D1CF] bg-white">
          <h2 className="border-b border-[#DCE3E1] p-4 font-semibold">
            {isBm ? "Contoh singkatan" : "Example abbreviations"}
          </h2>
          <table className="w-full text-left text-sm">
            <tbody>
              {abbreviations.map(([short, meaning]) => (
                <tr key={short}>
                  <td className="w-28 border-b border-[#DCE3E1] px-4 py-3 font-mono font-semibold text-[#1F5446]">{short}</td>
                  <td className="border-b border-[#DCE3E1] px-4 py-3">{meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="rounded border border-[#C9D1CF] bg-white p-4">
          <h2 className="mb-3 font-semibold">{isBm ? "Pintasan papan kekunci" : "Keyboard shortcuts"}</h2>
          <div className="flex items-center gap-4 text-sm">
            <kbd className="rounded border border-[#9FB0AD] bg-[#F4F7F6] px-2 py-1 font-mono text-xs">Ctrl+Enter</kbd>
            <span>{isBm ? "Cari kod" : "Find codes"}</span>
          </div>
        </section>
      </div>
    </main>
  );
}
