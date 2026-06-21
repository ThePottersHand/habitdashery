/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "rgb(var(--brand) / <alpha-value>)",
          light: "rgb(var(--brand-light) / <alpha-value>)",
          dark: "rgb(var(--brand-dark) / <alpha-value>)"
        }
      }
    }
  },
  plugins: []
};
