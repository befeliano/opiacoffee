// Bir hesabın şifresini sıfırlar (girişi olmayan sahip için).
//
// 1) Sunucuda (SSH, uygulamanın klasöründe):
//      DATABASE_URL='mysql://...' node scripts/sifre-sifirla.mjs eposta@ornek.com YeniSifre12
//    Şifreyi doğrudan veritabanında değiştirir.
// 2) Veritabanına bağlanmadan (phpMyAdmin için):
//      node scripts/sifre-sifirla.mjs eposta@ornek.com YeniSifre12 --sql
//    phpMyAdmin'de çalıştırılacak UPDATE komutunu yazar.
// Şifre verilmezse rastgele bir şifre üretilir ve ekrana yazılır.

import { randomBytes, randomInt, scryptSync } from "node:crypto";

const [email, given, flag] = process.argv.slice(2);
if (!email || !email.includes("@")) {
  console.error("Kullanım: node scripts/sifre-sifirla.mjs eposta@ornek.com [YeniSifre12] [--sql]");
  process.exit(1);
}
const letters = "abcdefghjkmnpqrstuvwxyz";
const password = given && given !== "--sql" ? given : `Opia${Array.from({ length: 4 }, () => letters[randomInt(letters.length)]).join("")}${randomInt(10, 99)}`;
if (password.length < 6 || !/[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(password) || !/\d/.test(password)) {
  console.error("Şifre en az 6 karakter olmalı, harf ve rakam içermeli.");
  process.exit(1);
}

// src/lib/data/password.ts ile aynı biçim
const salt = randomBytes(16);
const hash = scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
const stored = ["scrypt", salt.toString("hex"), hash.toString("hex")].join("$");
const normalized = email.trim().toLowerCase();

if (flag === "--sql" || given === "--sql") {
  console.log(`Yeni şifre: ${password}\n`);
  console.log(`UPDATE app_users SET encrypted_password = '${stored}' WHERE LOWER(email) = '${normalized.replace(/'/g, "")}';`);
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL tanımlı değil. Veritabanına bağlanmadan SQL komutu için sona --sql ekle.");
  process.exit(1);
}
const mysql = await import("mysql2/promise");
const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [result] = await conn.execute("UPDATE app_users SET encrypted_password = ? WHERE LOWER(email) = ?", [stored, normalized]);
await conn.end();
if (!result.affectedRows) {
  console.error(`${normalized} adlı hesap bulunamadı.`);
  process.exit(1);
}
console.log(`${normalized} için yeni şifre: ${password}`);
