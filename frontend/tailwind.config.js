/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      // The fixed navbar's height, so pages can subtract it instead of each
      // hard-coding 4rem next to a 100vh that does not account for it.
      spacing: { nav: "var(--nav-h)" },
      height: { viewport: "calc(100dvh - var(--nav-h))" },
      minHeight: { viewport: "calc(100dvh - var(--nav-h))" },
    },
  },
  plugins: [],
};
