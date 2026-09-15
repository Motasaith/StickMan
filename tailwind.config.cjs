/** @type {import('tailwindcss').Config} */
module.exports = {
  // Colors are CSS variables set per theme in src/index.css: the projects page
  // paper palette by default, the studio palette inside the editor.
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        panel: {
          DEFAULT: "hsl(var(--panel))",
          raised: "hsl(var(--panel-raised))",
          sunken: "hsl(var(--panel-sunken))",
        },
        line: "hsl(var(--line))",
        lime: "hsl(var(--primary) / <alpha-value>)",
        clip: {
          image: "hsl(var(--clip-image) / <alpha-value>)",
          video: "hsl(var(--clip-video) / <alpha-value>)",
          title: "hsl(var(--clip-title) / <alpha-value>)",
          voice: "hsl(var(--clip-voice) / <alpha-value>)",
          music: "hsl(var(--clip-music) / <alpha-value>)",
          character: "hsl(var(--clip-character) / <alpha-value>)",
          shape: "hsl(var(--clip-shape) / <alpha-value>)",
          sticker: "hsl(var(--clip-sticker) / <alpha-value>)",
          effect: "hsl(var(--clip-effect) / <alpha-value>)",
          slide: "hsl(var(--clip-slide) / <alpha-value>)",
        },
        warn: "hsl(var(--warn) / <alpha-value>)",
        good: "hsl(var(--good) / <alpha-value>)",
      },
      // Every size follows the theme's --radius, so the paper pages come out
      // near-square like the homepage and the editor keeps the demo's softer
      // corners, without either being written into each component.
      borderRadius: {
        "3xl": "calc(var(--radius) + 10px)",
        "2xl": "calc(var(--radius) + 6px)",
        xl: "calc(var(--radius) + 3px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 1px)",
        sm: "calc(var(--radius) - 2px)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        display: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["Georgia", '"Times New Roman"', "serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "rise-in": { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "none" } },
        shimmer: { from: { backgroundPosition: "200% 0" }, to: { backgroundPosition: "-200% 0" } },
        "pulse-dot": { "0%,100%": { opacity: "0.25" }, "50%": { opacity: "1" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.2s ease-out both",
        "rise-in": "rise-in 0.28s cubic-bezier(0.22, 1, 0.36, 1) both",
        shimmer: "shimmer 2.2s linear infinite",
        "pulse-dot": "pulse-dot 1.2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
