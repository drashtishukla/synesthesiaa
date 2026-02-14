import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: {
        "2xl": "1200px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Oxanium", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "Oxanium", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "3xl": "1.5rem",
        "2xl": "1rem",
        xl: "0.75rem",
        lg: "0.5rem",
        md: "0.375rem",
        sm: "0.25rem",
        DEFAULT: "0.5rem",
      },
      boxShadow: {
        glow: "0 0 40px rgba(255, 140, 0, 0.15)",
        "glow-lg": "0 0 60px rgba(255, 140, 0, 0.2)",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "float-up": {
          "0%": { transform: "translateY(0)", opacity: "1" },
          "80%": { opacity: "1" },
          "100%": { transform: "translateY(-320px)", opacity: "0" },
        },
        "eq-bar": {
          "0%, 100%": { height: "30%" },
          "50%": { height: "100%" },
        },
        "viz-bar": {
          "0%, 100%": { height: "var(--viz-min, 10%)", opacity: "0.5" },
          "50%": { height: "var(--viz-max, 90%)", opacity: "1" },
        },
      },
      animation: {
        float: "float 9s ease-in-out infinite",
        "float-up": "float-up 3s ease-out forwards",
        "eq-bar": "eq-bar 0.8s ease-in-out infinite",
        "viz-bar": "viz-bar 0.8s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
