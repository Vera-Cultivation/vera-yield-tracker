/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      // Every theme colour points at a CSS variable so light/dark swap at runtime.
      colors: {
        vb: "var(--vb)",
        vnav: "var(--vnav)",
        vcard: "var(--vcard)",
        vtile: "var(--vtile)",
        vbd: "var(--vbd)",
        vbd2: "var(--vbd2)",
        vsoft: "var(--vsoft)",
        vsoft2: "var(--vsoft2)",
        vt1: "var(--vt1)",
        vt2: "var(--vt2)",
        vt3: "var(--vt3)",
        vt4: "var(--vt4)",
        vaccent: "var(--vaccent)",
        vcyan: "var(--vcyan)",
        vamber: "var(--vamber)",
        vcoral: "var(--vcoral)",
        vpop: "var(--vpop)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      boxShadow: {
        v: "var(--vshadow)",
      },
      keyframes: {
        vpulse: { "0%,100%": { opacity: ".35" }, "50%": { opacity: "1" } },
      },
      animation: {
        vpulse: "vpulse 2s ease-in-out infinite",
        vpulse3: "vpulse 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
