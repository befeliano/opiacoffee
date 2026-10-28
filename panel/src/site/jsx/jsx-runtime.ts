// Sitenin JSX çalışma zamanı: TSX bileşenlerini doğrudan HTML metnine çevirir (React yok, tarayıcıya JS gitmez).
// Site dosyalarının başındaki /** @jsxImportSource @/site/jsx */ satırı bu dosyayı seçer.
// Sayfadaki betikler (public/assets/js) sunucunun ürettiği HTML'le çalışır; eski PHP sitesiyle aynı yapı.

export class Html {
  constructor(readonly html: string) {}
  toString() {
    return this.html;
  }
}

export type Child = Html | string | number | boolean | null | undefined | Child[];
type Props = Record<string, unknown> & { children?: Child };
type Component = (props: never) => Html;

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

const ATTR: Record<string, string> = {
  className: "class", htmlFor: "for", tabIndex: "tabindex", hrefLang: "hreflang", dateTime: "datetime",
  fetchPriority: "fetchpriority", autoComplete: "autocomplete", enterKeyHint: "enterkeyhint", crossOrigin: "crossorigin",
  srcSet: "srcset", readOnly: "readonly", colSpan: "colspan", rowSpan: "rowspan", maxLength: "maxlength",
  inputMode: "inputmode", strokeWidth: "stroke-width", strokeLinecap: "stroke-linecap", strokeLinejoin: "stroke-linejoin",
  fillRule: "fill-rule", clipRule: "clip-rule", defaultChecked: "checked", defaultValue: "value", httpEquiv: "http-equiv",
  charSet: "charset", acceptCharset: "accept-charset",
};

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function style(value: Record<string, unknown>) {
  return Object.entries(value)
    .filter(([, v]) => v !== null && v !== undefined && v !== false)
    .map(([k, v]) => `${k.startsWith("--") ? k : k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}:${v}`)
    .join(";");
}

export function renderChild(c: Child): string {
  if (c === null || c === undefined || c === false || c === true) return "";
  if (c instanceof Html) return c.html;
  if (Array.isArray(c)) return c.map(renderChild).join("");
  return esc(String(c));
}

function element(type: string | Component, props: Props): Html {
  if (typeof type === "function") return (type as (p: Props) => Html)(props);
  const { children, dangerouslySetInnerHTML, ...rest } = props as Props & { dangerouslySetInnerHTML?: { __html: string } };
  let attrs = "";
  for (const [key, value] of Object.entries(rest)) {
    if (key === "key" || value === null || value === undefined || value === false) continue;
    const name = ATTR[key] ?? key;
    if (value === true) attrs += ` ${name}`;
    else if (key === "style" && typeof value === "object") attrs += ` style="${esc(style(value as Record<string, unknown>))}"`;
    else attrs += ` ${name}="${esc(String(value))}"`;
  }
  if (VOID.has(type)) return new Html(`<${type}${attrs}>`);
  const inner = dangerouslySetInnerHTML ? dangerouslySetInnerHTML.__html : renderChild(children);
  return new Html(`<${type}${attrs}>${inner}</${type}>`);
}

export function Fragment(props: { children?: Child }): Html {
  return new Html(renderChild(props.children));
}

export const jsx = (type: string | Component, props: Props) => element(type, props);
export const jsxs = jsx;

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace JSX {
  export type Element = Html;
  export interface IntrinsicAttributes {
    key?: unknown;
  }
  export interface ElementChildrenAttribute {
    children: unknown;
  }
  export interface IntrinsicElements {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [tag: string]: Record<string, any>;
  }
}
