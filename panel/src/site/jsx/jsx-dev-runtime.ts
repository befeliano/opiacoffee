// Geliştirme modundaki JSX çağrısı (jsxDEV) aynı çalışma zamanına yönlenir.
import { jsx } from "./jsx-runtime";

export { Fragment } from "./jsx-runtime";
export type { JSX } from "./jsx-runtime";
export const jsxDEV = (type: Parameters<typeof jsx>[0], props: Parameters<typeof jsx>[1]) => jsx(type, props);
