/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Spec UX polish (Runda LOW polish 2): bundle splittovanje da
    // initial JS bundle ne bude > 500 kB. Vendor chunk-ove razdvajamo
    // tako da se npm libs cache-iraju izmedju deploymenta — promena
    // jedne stranice ne invalidira ceo bundle. GlobeView (three.js +
    // globe.gl ~1.8MB) i ArbitroOverlay (~250KB Liquid Glass CSS) su
    // vec lazy-loaded preko React.lazy.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined
          // React + react-dom + react-router u "react-vendor"
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router') ||
            id.includes('node_modules/scheduler/')
          ) {
            return 'react-vendor'
          }
          // Radix-ui komponente
          if (id.includes('node_modules/@radix-ui/')) {
            return 'radix-vendor'
          }
          // Lucide ikone
          if (id.includes('node_modules/lucide-react/')) {
            return 'icons-vendor'
          }
          // react-hook-form + zod
          if (
            id.includes('node_modules/react-hook-form/') ||
            id.includes('node_modules/@hookform/') ||
            id.includes('node_modules/zod/')
          ) {
            return 'forms-vendor'
          }
          // axios + odgovor
          if (id.includes('node_modules/axios/')) {
            return 'http-vendor'
          }
          // Recharts + d3-* + tranzitivne deps idu u glavni `vendor` chunk
          // (NE u zaseban charts-vendor) jer Recharts 3.x ima ugnjezdjene
          // imports u victory-vendor/internmap/eventemitter3/decimal.js-light/
          // react-smooth — ako su ti distribuirani u razlicite chunk-ove,
          // Rollup pravi circular chunk dependency koji u minified bundle-u
          // puca sa "E is not a function" runtime greskom (Vite 7 + Rollup 4
          // poznata kombinacija). Code split benefit je ~400KB ali stabilnost
          // > optimizacija. Vidi commit history za circular chunk warnings.
          // Three.js + globe.gl + three-globe takodje idu u glavni `vendor`
          // chunk (NE u zaseban three-vendor) iz istog razloga kao recharts:
          // three-globe.gl koristi d3-* iste kao recharts, pa split chunk
          // pravi circular dependency (`three-vendor -> vendor -> three-vendor`)
          // koja u runtime-u puca sa "nee is not a constructor" jer minified
          // klasa nije inicijalizovana iz drugog chunk-a u trenutku importa.
          // Vendor chunk je sad ~2.5MB ali GlobeView je vec lazy-loaded preko
          // dynamic import() pa user na login page-u ne uci three.js uopste.
          // Sve ostalo iz node_modules ide u "vendor"
          return 'vendor'
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      // Coverage scope = sav app source koji ima i logiku i smisao da se
      // testira. Iskljucujemo:
      //   - assistant/* — Arbitro (Celina 6 internal, NIJE Celina 1-5 KT3 cilj)
      //   - GlobeView/three-globe — lazy-loaded WebGL canvas, JSDOM ne moze
      //   - main.tsx + index.tsx + vite-env — bootstrap, samo deklarativno
      //   - *.test.* + test/ + types/ + setupTest fajlovi
      include: [
        'src/utils/**',
        'src/lib/**',
        'src/services/**',
        'src/pages/**',
        'src/hooks/**',
        'src/context/**',
        'src/components/**',
      ],
      exclude: [
        // Arbitro AI asistent (Celina 6 internal, NIJE Celina 1-5 KT3 cilj)
        'src/components/assistant/**',
        'src/services/assistantService.ts',
        'src/context/ArbitroContext.tsx',
        'src/context/useArbitro.ts',
        'src/hooks/useArbitro*',
        'src/hooks/useSpeechRecognition.ts',
        // GlobeView i three.js — lazy-loaded WebGL canvas, JSDOM ne render-uje
        'src/components/GlobeView*',
        'src/pages/Exchanges/GlobeView*',
        '**/GlobeView*',
        // Bootstrap fajlovi
        'src/main.tsx',
        'src/vite-env.d.ts',
        // Test infrastruktura
        'src/test/**',
        '**/*.test.*',
        '**/types/**',
        '**/__mocks__/**',
      ],
      thresholds: {
        // KT3 zahtev za FE: 80% statements minimalno. Trenutna realnost (nakon
        // Arbitro/GlobeView/UI-wrapper exclude-ova): statements 88.7%, lines 88.7%,
        // branches 74.7%, functions 69.9%. Funkcije su nize jer shadcn/ui wrapper
        // komponente (forwardRef export-i koji se koriste kroz JSX) JaCoCo broji
        // kao function bez covered. Threshold-ove postavljamo iznad KT3 minimum-a
        // ali ispod trenutnog stanja sa zaglavljem za rast — svaki PR moze samo
        // da podigne (ne da spusti) coverage. Cilj sledecih sprintova: functions
        // ka 75%+ kroz testove za OtcOffersAndContractsPage / OtcTrgovinaPage /
        // ProfitBankPage / SecuritiesListPage.
        statements: 85,
        branches: 70,
        functions: 65,
        lines: 85,
      },
    },
  },
})
