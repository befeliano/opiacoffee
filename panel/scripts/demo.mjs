// İnternetsiz demo: yerleşik veritabanı (PGlite) + test verisi + demo girişi.
// Çalıştırma: npm run demo  (ek argümanlar next dev'e geçer, ör. -- -p 3005)
// Veriyi sıfırlamak için .data klasörünü sil.
import { spawn } from "node:child_process";

const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, DATA_BACKEND: "local", NEXT_PUBLIC_DEMO_MODE: "1" },
});
child.on("exit", (code) => process.exit(code ?? 0));
