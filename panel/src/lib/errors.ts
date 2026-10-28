// Veritabanı hata kodlarını kullanıcıya gösterilecek Türkçe mesajlara çevirir.
// İç ayrıntılar (SQL, kısıt adları) kullanıcıya asla gösterilmez.

const MESSAGES: Record<string, string> = {
  E_NOT_AUTHENTICATED: "Oturumun sona erdi, lütfen tekrar giriş yap.",
  E_FORBIDDEN: "Bu işlem için yetkin yok.",
  E_NOT_FOUND: "Kayıt bulunamadı. Sayfayı yenileyip tekrar dene.",
  E_TABLE_NOT_FOUND: "Masa bulunamadı.",
  E_TABLE_INACTIVE: "Bu masa kullanıma kapalı.",
  E_TABLE_OCCUPIED: "Masada zaten açık bir adisyon var.",
  E_TABLE_HAS_OPEN_ORDER: "Masada açık adisyon varken bu işlem yapılamaz.",
  E_SAME_TABLE: "Adisyon zaten bu masada.",
  E_PRODUCT_NOT_FOUND: "Ürün satışta değil ya da silinmiş.",
  E_ITEM_NOT_FOUND: "Satır bulunamadı; adisyon başka bir cihazda değişmiş olabilir.",
  E_ORDER_NOT_FOUND: "Adisyon bulunamadı.",
  E_ORDER_CLOSED: "Bu adisyon kapanmış.",
  E_ORDER_OPEN: "Adisyon zaten açık.",
  E_ORDER_EMPTY: "Adisyonda ürün yok.",
  E_ORDER_CANCELLED: "Bu adisyon zaten iptal edilmiş.",
  E_ORDER_HAS_PAYMENTS: "Ödeme alınmış adisyon iptal edilemez. Önce ödemeleri geri al.",
  E_PAYMENT_NOT_FOUND: "Ödeme bulunamadı.",
  E_ITEM_PAID: "Bu ürünün ödemesi alınmış. Değiştirmek için önce ödemeyi geri al.",
  E_DAY_CLOSED: "Kafe henüz açılmadı. Masalar ekranından “Kafeyi aç”a bas.",
  E_DAY_ALREADY_OPEN: "Kafe zaten açık.",
  E_DAY_OPEN_ORDERS: "Açık masalar var. Kafeyi kapatmadan önce tüm hesapları kapat.",
  E_INVALID_OPTIONS: "Seçenekler geçersiz.",
  E_OPTION_REQUIRED: "Bu ürün için seçim yapmalısın.",
  E_INVALID_QUANTITY: "Adet geçersiz.",
  E_INVALID_AMOUNT: "Tutar geçersiz.",
  E_AMOUNT_EXCEEDS: "Tutar kalan hesaptan fazla olamaz.",
  E_INVALID_DISCOUNT: "İndirim, ara toplamdan büyük olamaz.",
  E_DISCOUNT_BELOW_PAID: "İndirimli tutar alınan ödemelerin altına düşemez.",
  E_INVALID_PRICE: "Fiyat geçersiz.",
  E_NAME_REQUIRED: "Ad boş bırakılamaz.",
  E_INGREDIENT_IN_USE: "Bu hammadde reçetelerde kullanılıyor. Önce reçetelerden çıkar.",
  E_INVALID_RANGE: "Tarih aralığı geçersiz.",
  E_INVALID_DATE: "Tarih geçersiz.",
  E_INVALID_INPUT: "Girilen bilgiler geçersiz.",
  E_USER_NOT_FOUND: "Kullanıcı bulunamadı.",
  E_LAST_OWNER: "Kafenin en az bir sahibi kalmalı.",
  E_DUPLICATE: "Bu adla bir kayıt zaten var.",
  E_INVALID_REFERENCE: "Bağlantılı kayıt bulunamadı. Sayfayı yenileyip tekrar dene.",
  E_RATE_LIMITED: "Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.",
  E_INVALID_LOGIN: "E-posta veya şifre hatalı.",
  E_WEAK_PASSWORD: "Şifre en az 6 karakter olmalı ve harf ile rakam içermeli.",
  E_UNKNOWN: "Bir şeyler ters gitti. Tekrar dene.",
};

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? MESSAGES[code] ?? MESSAGES.E_UNKNOWN);
    this.name = "AppError";
  }
}

export function messageFor(code: string): string {
  return MESSAGES[code] ?? MESSAGES.E_UNKNOWN;
}

/** Supabase/PostgREST veya PGlite hatasını AppError'a çevirir */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const e = error as { message?: string; code?: string; name?: string };
  if (e?.name === "ZodError") return new AppError("E_INVALID_INPUT");
  const message = e?.message ?? "";
  const match = message.match(/\bE_[A-Z_]+\b/);
  if (match && MESSAGES[match[0]]) return new AppError(match[0]);

  switch (e?.code) {
    // MySQL / MariaDB
    case "ER_DUP_ENTRY":
      return new AppError("E_DUPLICATE");
    case "ER_NO_REFERENCED_ROW":
    case "ER_NO_REFERENCED_ROW_2":
    case "ER_ROW_IS_REFERENCED":
    case "ER_ROW_IS_REFERENCED_2":
      return new AppError("E_INVALID_REFERENCE");
    case "ER_CHECK_CONSTRAINT_VIOLATED":
    case "ER_CONSTRAINT_FAILED":
    case "ER_DATA_TOO_LONG":
    case "ER_WARN_DATA_OUT_OF_RANGE":
    case "ER_TRUNCATED_WRONG_VALUE":
    case "ER_TRUNCATED_WRONG_VALUE_FOR_FIELD":
    case "ER_BAD_NULL_ERROR":
    case "WARN_DATA_TRUNCATED":
      return new AppError("E_INVALID_INPUT");
    // Postgres
    case "23505":
      return new AppError("E_DUPLICATE");
    case "23503":
      return new AppError("E_INVALID_REFERENCE");
    case "22P02":
    case "23514":
    case "22003":
    case "22007":
    case "22008":
    case "23502":
      return new AppError("E_INVALID_INPUT");
    case "42501":
    case "PGRST301":
      return new AppError("E_FORBIDDEN");
  }
  if (/duplicate key/i.test(message)) return new AppError("E_DUPLICATE");
  if (/violates foreign key/i.test(message)) return new AppError("E_INVALID_REFERENCE");
  if (/violates check constraint|invalid input syntax|out of range/i.test(message)) return new AppError("E_INVALID_INPUT");
  if (/permission denied/i.test(message)) return new AppError("E_FORBIDDEN");
  if (/JWT|not authenticated/i.test(message)) return new AppError("E_NOT_AUTHENTICATED");
  return new AppError("E_UNKNOWN");
}

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string; code: string };

export function fail(error: unknown): { ok: false; error: string; code: string } {
  const appError = toAppError(error);
  if (appError.code === "E_UNKNOWN" && process.env.NODE_ENV !== "production") {
    console.error("[beklenmeyen hata]", error);
  }
  return { ok: false, error: appError.message, code: appError.code };
}
