/**
 * Color themes. Each value is a space-separated RGB triple so Tailwind's
 * `rgb(var(--brand) / <alpha>)` color setup can apply opacity. Themes after the
 * first are unlocked via streak rewards.
 */
export interface Theme {
  id: string;
  label: string;
  brand: string;
  brandLight: string;
  brandDark: string;
}

export const THEMES: Theme[] = [
  { id: "violet", label: "Violet", brand: "109 40 217", brandLight: "139 92 246", brandDark: "91 33 182" },
  { id: "emerald", label: "Emerald", brand: "5 150 105", brandLight: "52 211 153", brandDark: "4 120 87" },
  { id: "rose", label: "Rose", brand: "225 29 72", brandLight: "251 113 133", brandDark: "190 18 60" },
  { id: "amber", label: "Amber", brand: "217 119 6", brandLight: "251 191 36", brandDark: "180 83 9" },
  { id: "sky", label: "Sky", brand: "2 132 199", brandLight: "56 189 248", brandDark: "3 105 161" }
];

export function getTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

/** Apply a theme by setting CSS variables on :root. */
export function applyTheme(id: string): void {
  const t = getTheme(id);
  const root = document.documentElement;
  root.style.setProperty("--brand", t.brand);
  root.style.setProperty("--brand-light", t.brandLight);
  root.style.setProperty("--brand-dark", t.brandDark);
}
