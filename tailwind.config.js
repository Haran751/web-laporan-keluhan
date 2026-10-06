/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        kemenkes: {
          50: "#f0fdf9",
          100: "#ccfbee",
          200: "#9cf6de",
          300: "#5eead4",
          400: "#40ff8c", // Neon mint
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
          800: "#006a63",
          900: "#005c55", // Deep Kemenkes Teal
          950: "#003833",
          lime: "#ccff00", // Vibrant highlight
        },
        surface: {
          DEFAULT: "#ffffff",
          soft: "#f8fafc",
          muted: "#f1f5f9",
          tint: "#f0fdfa",
        },
      },
    },
  },
  plugins: [],
};
