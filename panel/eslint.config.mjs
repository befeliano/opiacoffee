import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Tanıtım sitesi React değil, kendi JSX çalışma zamanıyla düz HTML üretir (src/site/jsx):
  // <Link>, key ve <img> kuralları orada anlamsız.
  {
    files: ["src/site/**/*.{ts,tsx}", "src/app/(site)/**/*.{ts,tsx}"],
    rules: {
      "@next/next/no-html-link-for-pages": "off",
      "@next/next/no-img-element": "off",
      "react/jsx-key": "off",
      "@next/next/no-head-element": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
