import { ChevronDown } from "lucide-react";

// Giriş ekranındaki kısa kullanım rehberi (baristalar için). JavaScript gerektirmez.
const STEPS: { title: string; items: string[] }[] = [
  {
    title: "Sipariş almak",
    items: [
      "Masaya dokun → menüden ürüne dokun; her dokunuş 1 adet ekler. En çok satanlar “Favoriler” sekmesinde.",
      "Sıcak/buzlu, yulaf sütü, ekstra shot gibi seçenekler için ürünün köşesindeki ayar simgesine bas.",
      "Adisyondaki − / + ile adet azalt, artır. Satıra dokunursan not, ikram, indirim ve silme açılır.",
      "Menüde olmayan bir şey satarsan “Diğer › Joker”: fiyatı ve ne olduğunu yaz.",
      "Paket/ayakta siparişler için “Gel-Al” masasını kullan.",
    ],
  },
  {
    title: "Ödeme almak",
    items: [
      "“Ödeme al” → ödenmemiş tüm ürünler seçili gelir → “Nakit” ya da “Kart”. Masa kapanır.",
      "Yemek kartıyla (Edenred, Multinet vb.) ödeyen olursa altındaki “Ticket ile öde”.",
      "Herkes kendi ürününü ödeyecekse: ürünleri seç, öde; kalanları seç, öde (biri kart, biri nakit olabilir).",
      "Hesabı eşit bölmek için “Tutar girerek” → 1/2, 1/3, 1/4 düğmeleri.",
      "Tek ürüne indirim: ödeme ekranında ürünün yanındaki etiket simgesi → %10, %20, %50 ya da tutar.",
      "Yanlış ödeme mi? Ödeme listesindeki geri al simgesiyle silinir.",
    ],
  },
  {
    title: "Masa işlemleri",
    items: [
      "Masa ekranında sağ üstteki ⋮ menüsü: masa değiştir / iki masayı birleştir, not ve indirim, adisyonu iptal et.",
      "Kapanan adisyonlar “Geçmiş” sekmesinde; yanlış seçilen ödeme yöntemi 1 saat içinde düzeltilebilir.",
      "Yanlış alınan bir adisyonu gün içinde “Geçmiş”ten açıp “Adisyonu sil” ile silebilirsin.",
    ],
  },
  {
    title: "Açılış ve kapanış",
    items: [
      "Kasa sayımı kapalıysa kafe çalışma saatlerinde kendiliğinden açık sayılır; açıp kapatmak gerekmez.",
      "Kasa sayımı açıksa sabah Masalar ekranında “Kafeyi aç” → açılış nakdini yaz (yoksa “Pas geç”).",
      "Gece tüm hesapları kapat; sayım açıksa “Kafeyi kapat” → kasadaki nakdi ve POS gün sonu toplamını yaz. Sistem “tuttu”, “eksik” ya da “fazla” der.",
    ],
  },
];

export function LoginGuide() {
  return (
    <details className="group mt-4 rounded-3xl border border-stone-200/70 bg-white/80 shadow-card backdrop-blur">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-[15px] font-bold text-stone-900">Nasıl kullanılır?</span>
          <span className="block text-[13px] text-stone-500">Baristalar için 1 dakikalık rehber</span>
        </span>
        <ChevronDown className="size-5 shrink-0 text-stone-400 transition group-open:rotate-180" />
      </summary>
      <ol className="flex flex-col gap-4 border-t border-stone-100 px-5 pb-5 pt-4">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-600 text-[13px] font-bold text-white">{i + 1}</span>
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-stone-900">{step.title}</p>
              <ul className="mt-1 flex list-disc flex-col gap-1 pl-4 text-[13px] leading-relaxed text-stone-600">
                {step.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}
