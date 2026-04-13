/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
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
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "blob": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "25%": { transform: "translate(30px, -50px) scale(1.1)" },
          "50%": { transform: "translate(-20px, 20px) scale(0.9)" },
          "75%": { transform: "translate(20px, 40px) scale(1.05)" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-20px)" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(30px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-left": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.8" },
        },
        "shimmer": {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        },
        "float-x": {
          "0%, 100%": { transform: "translateX(0) translateY(0)" },
          "25%": { transform: "translateX(10px) translateY(-8px)" },
          "50%": { transform: "translateX(-5px) translateY(5px)" },
          "75%": { transform: "translateX(8px) translateY(-3px)" },
        },
        "count-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "aurora-1": {
          "0%, 100%": { transform: "translate(0, 0) rotate(0deg) scale(1)", opacity: "0.5" },
          "33%": { transform: "translate(30%, -20%) rotate(120deg) scale(1.2)", opacity: "0.7" },
          "66%": { transform: "translate(-20%, 20%) rotate(240deg) scale(0.9)", opacity: "0.4" },
        },
        "aurora-2": {
          "0%, 100%": { transform: "translate(0, 0) rotate(0deg) scale(1.1)", opacity: "0.4" },
          "33%": { transform: "translate(-30%, 15%) rotate(-120deg) scale(0.8)", opacity: "0.6" },
          "66%": { transform: "translate(20%, -25%) rotate(-240deg) scale(1.3)", opacity: "0.5" },
        },
        "morph": {
          "0%, 100%": { borderRadius: "60% 40% 30% 70% / 60% 30% 70% 40%" },
          "25%": { borderRadius: "30% 60% 70% 40% / 50% 60% 30% 60%" },
          "50%": { borderRadius: "50% 60% 30% 60% / 30% 60% 70% 40%" },
          "75%": { borderRadius: "60% 30% 50% 40% / 60% 40% 60% 30%" },
        },
        "gradient-shift": {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        "card-float": {
          "0%, 100%": { transform: "translateY(0) rotateX(2deg) rotateY(-2deg)" },
          "50%": { transform: "translateY(-12px) rotateX(-2deg) rotateY(2deg)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(60px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.85)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "draw-line": {
          from: { height: "0%" },
          to: { height: "100%" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(1)", opacity: "0.6" },
          "50%": { transform: "scale(1.15)", opacity: "0.2" },
          "100%": { transform: "scale(1)", opacity: "0.6" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "blob": "blob 8s ease-in-out infinite",
        "blob-slow": "blob 12s ease-in-out infinite",
        "float": "float 6s ease-in-out infinite",
        "float-slow": "float 8s ease-in-out infinite",
        "fade-up": "fade-up 0.8s ease-out forwards",
        "fade-in": "fade-in 1s ease-out forwards",
        "slide-left": "slide-left 30s linear infinite",
        "pulse-glow": "pulse-glow 3s ease-in-out infinite",
        "shimmer": "shimmer 8s ease-in-out infinite",
        "float-x": "float-x 7s ease-in-out infinite",
        "count-up": "count-up 0.6s ease-out forwards",
        "aurora-1": "aurora-1 15s ease-in-out infinite",
        "aurora-2": "aurora-2 18s ease-in-out infinite",
        "morph": "morph 8s ease-in-out infinite",
        "gradient-shift": "gradient-shift 6s ease infinite",
        "card-float": "card-float 6s ease-in-out infinite",
        "slide-up": "slide-up 0.8s ease-out forwards",
        "scale-in": "scale-in 0.6s ease-out forwards",
        "draw-line": "draw-line 1.5s ease-out forwards",
        "pulse-ring": "pulse-ring 2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
