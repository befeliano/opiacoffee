// MySQL şemasını SQL olarak yazdırır (phpMyAdmin > İçe aktar için): npm run db:mysql-schema > schema.sql
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../src/lib/data/mysql/schema.ts", import.meta.url), "utf8");
process.stdout.write(source.slice(source.indexOf("`") + 1, source.lastIndexOf("`")));
