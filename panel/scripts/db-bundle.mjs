// Tüm migration dosyalarını tek bir SQL dosyasında birleştirir.
// Supabase panelindeki SQL Editor'e yapıştırıp bir kez çalıştırmak için:
//   npm run db:bundle   →   supabase/_bundle.sql
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const dir = path.join(process.cwd(), "supabase", "migrations");
const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

const parts = [
  "-- Adisyon · tüm veritabanı kurulumu",
  "-- Supabase panelinde SQL Editor'e yapıştırıp bir kez çalıştır.",
  "-- Tekrar çalıştırmak gerekirse önce şemayı sıfırlaman gerekir.",
  "",
];
for (const file of files) {
  parts.push(`-- ===== ${file} =====`, await readFile(path.join(dir, file), "utf8"), "");
}

const out = path.join(process.cwd(), "supabase", "_bundle.sql");
await writeFile(out, parts.join("\n"), "utf8");
console.log(`${files.length} migration birleştirildi → supabase/_bundle.sql`);
