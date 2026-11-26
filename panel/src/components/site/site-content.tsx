"use client";

// Panel › Web sitesi › Fotoğraflar ve Blog sekmeleri.
// Fotoğraflar tarayıcıda küçültülüp WEBP'ye çevrilerek yüklenir; dosyadaki varsayılanın yerine geçer.

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ExternalLink, FileText, ImageOff, Plus, RotateCcw, Trash2 } from "lucide-react";
import { deleteSitePostAction, resetSlotImageAction, saveSitePostAction } from "@/app/(panel)/[cafe]/site/actions";
import { Button, Spinner } from "@/components/ui/button";
import { Field, Input, TextArea, Toggle } from "@/components/ui/field";
import { ConfirmSheet, Sheet } from "@/components/ui/sheet";
import { Badge, Card } from "@/components/ui/surface";
import { useToast } from "@/components/ui/toast";
import { blogSlug, blogToHtml } from "@/lib/blog-format";
import { ImagePicker, uploadImage } from "./site-view";

export interface PanelSlot {
  slot: string;
  label: string;
  ratio: string;
  /** Panelden yüklenen sürüm (0: yüklenmedi, dosyadaki kullanılıyor) */
  ver: number;
  /** Dosyadaki varsayılan fotoğraf ("" yoksa) */
  fallback: string;
}

export interface PanelPost {
  slug: string;
  title: string;
  description: string;
  lead: string;
  body: string;
  published: boolean;
  hidden: boolean;
  date: string;
  builtIn: boolean;
  /** builtin: hazır yazı, hiç değiştirilmedi · edited: hazır yazı, panelde değiştirildi · panel: panelde yazıldı */
  source: "builtin" | "edited" | "panel";
  cover: PanelSlot;
}

const slotSrc = (s: PanelSlot) => (s.ver ? `/gorsel/alan/${s.slot}?v=${s.ver}` : s.fallback);

// ---------------------------------------------------------------------
// Fotoğraflar
// ---------------------------------------------------------------------

export function PhotosTab({ cafeId, slug, slots }: { cafeId: string; slug: string; slots: PanelSlot[] }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[14px] text-stone-600">
        Sitedeki fotoğraf yerleri. Fotoğrafı değiştirince sitede hemen yenisi görünür; boyutunu düşünme, otomatik küçültülür ve çerçeveye ortalanarak yerleşir (sağdaki oran: önerilen biçim). Blog kapakları Blog sekmesinde.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {slots.map((s) => (
          <SlotCard key={s.slot} cafeId={cafeId} slug={slug} s={s} />
        ))}
      </div>
    </div>
  );
}

function SlotCard({ cafeId, slug, s }: { cafeId: string; slug: string; s: PanelSlot }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(slotSrc(s));
  const pick = async (file: File) => {
    setBusy(true);
    const err = await uploadImage(slug, "alan", s.slot, file, 1600);
    setBusy(false);
    if (err) return toast.show(err, "error");
    setPreview(URL.createObjectURL(file));
    toast.show("Fotoğraf değişti");
    router.refresh();
  };
  const reset = async () => {
    setBusy(true);
    const r = await resetSlotImageAction(cafeId, s.slot).catch(() => null);
    setBusy(false);
    if (!r?.ok) return toast.show(r?.ok === false ? r.error : "Bağlantı sorunu.", "error");
    setPreview(s.fallback);
    toast.show("İlk fotoğrafa dönüldü");
    router.refresh();
  };
  return (
    <Card className="flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-[14px] font-semibold text-stone-800" title={s.label}>
          {s.label}
        </p>
        <span className="shrink-0 text-[12px] text-stone-400">{s.ratio}</span>
      </div>
      <ImagePicker src={preview} onPick={pick} busy={busy} />
      {s.ver > 0 && (
        <Button variant="ghost" size="sm" className="self-start" onClick={reset} disabled={busy}>
          <RotateCcw className="size-4" /> İlk fotoğrafa dön
        </Button>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------
// Blog
// ---------------------------------------------------------------------

const SOURCE_LABEL: Record<PanelPost["source"], string> = { builtin: "Hazır yazı", edited: "Düzenlendi", panel: "Panelde yazıldı" };

export function BlogTab({ cafeId, slug, siteUrl, posts }: { cafeId: string; slug: string; siteUrl: string; posts: PanelPost[] }) {
  const [editing, setEditing] = useState<PanelPost | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const blank: PanelPost = {
    slug: "",
    title: "",
    description: "",
    lead: "",
    body: "",
    published: false,
    hidden: false,
    date: today,
    builtIn: false,
    source: "panel",
    cover: { slot: "", label: "", ratio: "16:10", ver: 0, fallback: "" },
  };
  return (
    <div className="flex flex-col gap-4">
      <Card className="p-0">
        <div className="flex items-center justify-between gap-3 border-b border-stone-100 px-4 py-3">
          <p className="text-[15px] font-bold text-stone-900">Yazılar</p>
          <Button size="sm" onClick={() => setEditing(blank)}>
            <Plus className="size-4" /> Yeni yazı
          </Button>
        </div>
        <ul className="divide-y divide-stone-100">
          {posts.map((p) => (
            <li key={p.slug}>
              <button type="button" onClick={() => setEditing(p)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-stone-50">
                <span className="grid h-12 w-[76px] shrink-0 place-items-center overflow-hidden rounded-lg border border-stone-200 bg-stone-50">
                  {slotSrc(p.cover) ? <img src={slotSrc(p.cover)} alt="" className="size-full object-cover" loading="lazy" /> : <ImageOff className="size-4 text-stone-400" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-stone-900">{p.title}</span>
                  <span className="block truncate text-[13px] text-stone-500">
                    {p.date} · {SOURCE_LABEL[p.source]}
                  </span>
                </span>
                {p.published ? <Badge tone="brand">Yayında</Badge> : <Badge tone="neutral">Taslak</Badge>}
              </button>
            </li>
          ))}
        </ul>
      </Card>
      <p className="text-[13px] text-stone-500">
        Yazılar <a className="underline" href={`${siteUrl}/blog`} target="_blank" rel="noopener">{siteUrl.replace(/^https?:\/\//, "")}/blog</a> adresinde. Yeni yazı “Taslak” olarak kaydedilir; hazır olunca “Yayında”yı aç.
      </p>
      {editing && <PostEditor cafeId={cafeId} slug={slug} siteUrl={siteUrl} post={editing} taken={posts.map((p) => p.slug)} onClose={() => setEditing(null)} />}
    </div>
  );
}

function PostEditor({ cafeId, slug, siteUrl, post, taken, onClose }: { cafeId: string; slug: string; siteUrl: string; post: PanelPost; taken: string[]; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const isNew = !post.slug;
  const [v, setV] = useState(post);
  const [file, setFile] = useState<File | null>(null);
  const [cover, setCover] = useState(slotSrc(post.cover));
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const set = <K extends keyof PanelPost>(k: K, val: PanelPost[K]) => setV((x) => ({ ...x, [k]: val }));
  const postSlug = useMemo(() => {
    if (!isNew) return post.slug;
    const base = blogSlug(v.title) || "yazi";
    let s = base;
    for (let i = 2; taken.includes(s); i++) s = `${base}-${i}`;
    return s;
  }, [isNew, post.slug, v.title, taken]);

  const save = async () => {
    if (!v.title.trim()) return toast.show("Başlığı yaz.", "error");
    if (!v.body.trim()) return toast.show("Yazının metnini yaz.", "error");
    setSaving(true);
    const r = await saveSitePostAction(cafeId, {
      slug: postSlug,
      title: v.title,
      description: v.description,
      lead: v.lead,
      body: v.body,
      published: v.published,
      date: v.date,
    }).catch(() => null);
    if (!r || !r.ok) {
      setSaving(false);
      return toast.show(r ? r.error : "Bağlantı sorunu.", "error");
    }
    if (file) {
      const err = await uploadImage(slug, "alan", `blog-${postSlug}`, file, 1600);
      if (err) toast.show(`Yazı kaydedildi; ${err}`, "error");
    }
    setSaving(false);
    toast.show(v.published ? "Yazı kaydedildi ve yayında" : "Taslak kaydedildi");
    router.refresh();
    onClose();
  };
  const remove = async () => {
    setSaving(true);
    const r = await deleteSitePostAction(cafeId, post.slug).catch(() => null);
    setSaving(false);
    setConfirm(false);
    if (!r?.ok) return toast.show(r?.ok === false ? r.error : "Bağlantı sorunu.", "error");
    toast.show(post.builtIn ? "Yazı ilk hâline döndü" : "Yazı silindi");
    router.refresh();
    onClose();
  };

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title={isNew ? "Yeni yazı" : "Yazıyı düzenle"}
        description={`Adres: /blog/${postSlug}`}
        size="lg"
        footer={
          <div className="flex gap-2">
            {!isNew && post.source !== "builtin" && (
              <Button variant="secondary" size="lg" className="text-red-600" onClick={() => setConfirm(true)} aria-label={post.builtIn ? "İlk hâline döndür" : "Yazıyı sil"}>
                {post.builtIn ? <RotateCcw className="size-5" /> : <Trash2 className="size-5" />}
              </Button>
            )}
            <Button variant="secondary" size="lg" onClick={() => setPreview((x) => !x)}>
              <FileText className="size-5" /> {preview ? "Düzenle" : "Önizle"}
            </Button>
            <Button size="lg" className="flex-1" onClick={save} disabled={saving}>
              {saving && <Spinner />} Kaydet
            </Button>
          </div>
        }
      >
        {preview ? (
          <article className="flex flex-col gap-3">
            {cover && <img src={cover} alt="" className="aspect-[16/10] w-full rounded-xl object-cover" />}
            <h1 className="text-2xl font-extrabold">{v.title}</h1>
            {v.lead && <p className="text-[16px] text-stone-600">{v.lead}</p>}
            <div
              className="flex flex-col gap-3 text-[15px] leading-relaxed [&_a]:underline [&_h2]:mt-2 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:font-bold [&_ul]:list-disc [&_ul]:pl-5"
              dangerouslySetInnerHTML={{ __html: blogToHtml(v.body) }}
            />
          </article>
        ) : (
          <div className="flex flex-col gap-4">
            <Field label="Kapak fotoğrafı" hint="Yatay fotoğraf en iyi görünür (16:10).">
              <ImagePicker
                src={cover}
                busy={false}
                onPick={(f) => {
                  setFile(f);
                  setCover(URL.createObjectURL(f));
                }}
              />
            </Field>
            <Field label="Başlık">
              <Input value={v.title} maxLength={120} onChange={(e) => set("title", e.target.value)} placeholder="örn. Soğuk demleme nedir?" autoFocus={isNew} />
            </Field>
            <Field label="Kısa açıklama" hint="Google'da ve blog listesinde başlığın altında görünür (160 karakter civarı).">
              <TextArea rows={2} value={v.description} maxLength={200} onChange={(e) => set("description", e.target.value)} />
            </Field>
            <Field label="Giriş" hint="Başlığın altındaki kalın ilk paragraf.">
              <TextArea rows={2} value={v.lead} maxLength={600} onChange={(e) => set("lead", e.target.value)} />
            </Field>
            <Field
              label="Metin"
              hint={
                <>
                  Paragrafları boş satırla ayır. <b>## Ara başlık</b> · <b>- madde</b> · <b>**kalın**</b> · <b>[bağlantı yazısı](/menu)</b>
                </>
              }
            >
              <TextArea rows={14} value={v.body} onChange={(e) => set("body", e.target.value)} className="font-mono text-[14px]" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tarih">
                <Input type="date" value={v.date} onChange={(e) => set("date", e.target.value)} />
              </Field>
            </div>
            <Toggle checked={v.published} onChange={(b) => set("published", b)} label="Yayında" description={v.published ? "Sitede görünür." : "Taslak: sitede görünmez."} />
            {!isNew && v.published && (
              <a href={`${siteUrl}/blog/${postSlug}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 self-start text-[14px] font-semibold text-stone-700 underline">
                Sitede aç <ExternalLink className="size-4" />
              </a>
            )}
          </div>
        )}
      </Sheet>
      <ConfirmSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={remove}
        title={post.builtIn ? "Yazı ilk hâline dönsün mü?" : "Yazı silinsin mi?"}
        description={post.builtIn ? "Panelde yaptığın değişiklikler silinir, hazır yazı yeniden görünür." : `“${post.title}” siteden kaldırılır.`}
        confirmLabel={post.builtIn ? "İlk hâline döndür" : "Sil"}
        danger
        pending={saving}
      />
    </>
  );
}
