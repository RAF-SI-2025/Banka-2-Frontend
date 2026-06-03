# Banka 2 — Frontend

React 19 SPA koja pokriva celokupni bankarski UI: klijentski portal (racuni,
kartice, placanja, transferi, berza, OTC intra+inter-bank, fondovi), Employee
portal (klijenti, orderi), Supervizor portal (aktuari, porez, Profit Banke) i
Admin portal (zaposleni, berze). Deo projekta **Softversko inzenjerstvo** na
Racunarskom fakultetu 2025/26.

## Tech Stack

- **React 19.2** + **TypeScript 6**
- **Vite 8** (Rolldown bundler)
- **Tailwind CSS 4** (CSS-first config preko `@theme` u `src/index.css`, `@tailwindcss/vite` plugin) + **shadcn/ui** (Radix UI) + **lucide-react** ikone + `tw-animate-css`
- **React Router v7**
- **React Hook Form** + **Zod 4** (forme + validacija)
- **Axios** sa JWT auto-refresh interceptor-ima
- **Recharts 3** + **Three.js** + **react-globe.gl** (lazy-loaded GlobeView), **Leaflet** (mapa filijala)
- **Vitest 4** — unit testovi (~146 test fajla)
- **Cypress 15** — E2E testovi (mock + live parovi po celinama + Arbitro lokalno)
- **ESLint 10** + **typescript-eslint** + eslint-plugin-security

Tacne verzije su u `package.json`.

## Pokretanje

### Docker (preporuceno)

```bash
docker compose up -d --build
```

Pokrece SPA na `http://localhost:3000` (nginx:alpine servira statiku iz `dist/`).

**Pokreni backend pre** — nginx u kontejneru proxira `/api/*` na api-gateway
(`http://banka2_gateway`). Oba compose fajla dele isti docker network
(`banka-2-backend_default`).

Override host port (Hyper-V/WinNAT konflikt na Windows-u):

```powershell
$env:FRONTEND_HOST_PORT="3500"; docker compose up -d
```

### Lokalni dev server

```bash
npm install
npm run dev     # http://localhost:5173 (Vite HMR)
```

API base URL se u dev-u uzima iz `VITE_API_URL` (vidi sekciju Environment). Za
lokalni dev usmeri ga na pokrenuti backend (npr. `http://localhost:8080`).

### Testovi

```bash
npm test                   # Vitest (jednom prodje, CI mode)
npm run test:watch         # watch mode
npm run test:coverage      # coverage report
```

Coverage threshold-ovi su u `vite.config.ts` (`statements 72 / branches 63 /
functions 60 / lines 74`).

Cypress (live varijante zahtevaju BE+FE+seed up):

```bash
npx cypress open           # interactive
npx cypress run            # headless

# Samo mock (brzo, ne treba BE):
npx cypress run --spec "cypress/e2e/*-mock.cy.ts" --config video=false,baseUrl=http://localhost:3000
```

### Build / lint

```bash
npm run build              # tsc -b && vite build → dist/
npm run lint               # ESLint
npm run lint:security      # eslint-plugin-security (SAST)
npm run preview            # preview dist/ lokalno
```

## Environment

API base URL se resolvuje (vidi `src/config/runtime.ts`): runtime
`window._env_.API_URL` → build-time `VITE_API_URL` → fallback `/api`.

| Varijabla | Tip | Default | Opis |
|-----------|-----|---------|------|
| `VITE_API_URL` | build-time | `/api` | base URL backend-a u `npm run dev` |
| `API_URL` | runtime (Docker) | `/api` | injektuje se u `window._env_` preko `/config.js` |
| `OUR_BANK_CODE` | runtime (Docker) | `RN-222` | rutiranje za inter-bank OTC |
| `ENV` | runtime (Docker) | `development` | environment label |

U Docker-u runtime config (`docker-entrypoint.sh` → `envsubst` iz
`public/config.template.js` → `/config.js`) dozvoljava menjanje backend URL-a
bez rebuild-a image-a. U dev/prod kroz nginx, `/api/*` se proxira na backend
gateway.

## Struktura projekta

```text
src/
├── components/
│   ├── layout/          # ClientSidebar, Navbar, ProtectedRoute, Dashboard layouts
│   ├── shared/          # VerificationModal (OTP), EmptyState, ThemeToggle, Skeleton
│   └── ui/              # shadcn/ui reusable (Button, Card, Dialog, Input, ...)
├── config/              # runtime config (window._env_ → VITE_API_URL → /api)
├── context/             # AuthContext, ThemeContext, ArbitroContext
├── hooks/               # useCountUp, useDebounce, useQueryParams, useArbitro*
├── lib/                 # notify (toast), utils (cn, classnames)
├── pages/               # Landing, Login, HomePage, Accounts, Cards, Payments,
│                        # Transfers, Securities, Orders, Portfolio, Otc, Funds,
│                        # ProfitBank, Tax, Loans, Admin, Actuaries, Margin, ...
├── services/            # Axios wrappers po domenu (auth, otc, fund, tax, ...)
├── types/               # TypeScript tipovi (celina1-5, auth, ...)
└── utils/               # formatters (sr-RS), jwt decode, validationSchemas
```

## Autentifikacija i autorizacija

1. `POST /auth/login` → `{ accessToken, refreshToken }` u `sessionStorage`
2. JWT dekoder (`utils/jwt.ts`) cita `sub` (email), `role` (ADMIN/EMPLOYEE/CLIENT), `active`
3. Za ADMIN/EMPLOYEE → fetch `/employees?email=<sub>` za prave permisije
4. `AuthContext` daje: `user`, `isAdmin`, `isSupervisor`, `isAgent`, `hasPermission(code)`
5. Route guards u `App.tsx`: `adminOnly`, `employeeOnly`, `supervisorOnly`, `noAgentOnly`
6. Axios response interceptor auto-refresh na 401
7. Logout: async `POST /auth/logout` (BE blacklist token) + `sessionStorage.clear()`
8. Lockout UX: ako BE vrati "Account temporarily locked…", FE prikazuje warning Alert sa srpskim prevodom

## Dizajn sistem

- **Primary gradient**: `from-indigo-500 to-violet-600`, akcenat shadow `shadow-indigo-500/20`
- **Badges**: `success` (emerald), `warning` (amber), `destructive` (red), `info` (blue), `secondary` (slate)
- **Loading**: skeleton sa `animate-pulse` — bez spinner-a
- **Brojevi**: `sr-RS` locale (zarez decimale, tacka hiljade)
- **Dark mode**: Tailwind `dark:` prefix + ThemeContext + `<ThemeToggle />` (System → Light → Dark)

## Vite manualChunks (vazno)

`vite.config.ts` deli vendor-e na `react-vendor`, `radix-vendor`, `icons-vendor`,
`forms-vendor`, `http-vendor` i `vendor` (sve ostalo iz node_modules).

**NE izdvajati `charts-vendor` ni `three-vendor`** — Recharts 3.x i three-globe
dele iste d3-* tranzitivne deps, pa razdvojen chunk pravi circular chunk
dependency koja u runtime-u puca (`E is not a function` / `nee is not a
constructor`). Three.js je vec lazy-loaded preko `React.lazy(() => import('./GlobeView'))`.

## nginx (Docker)

`nginx.conf` ima:

- `/api/` → proxy na `http://banka2_gateway` (api-gateway koji path-rutira na backend/trading)
- `/api/assistant/chat` i `/chat-multipart` → SSE proxy (no buffering, dug timeout) za Arbitro
- `/config.js` → `no-store` (runtime config, ne sme da se kesira)
- `/assets/` → `Cache-Control: immutable, max-age=1y` (Vite hash-uje fajlove)
- `/index.html` + SPA fallback → `no-store, no-cache`
- Security headers: `X-Content-Type-Options`, `X-Frame-Options: DENY`, HSTS, `Referrer-Policy`, `Permissions-Policy`, CSP

## OTP verifikacija

Placanja, transferi i orderi zahtevaju OTP: modal generise kod (`POST
/payments/request-otp`), korisnik unosi 6-cifreni kod → POST na stvarni endpoint
sa `otpCode`. Pogresan kod → 403; 3. strike → blok i modal se zatvara.

## Inter-bank 2PC payment UI

Kad korisnik posalje placanje na racun ciji prefix nije `222` (nasa banka),
`NewPaymentPage` prikazuje inter-bank warning banner + 4-fazni stepper modal
(Inicijalizacija → Prepare → Commit → Zavrseno) sa pollingom, STUCK banner sa
"Pokusaj ponovo", i `sessionStorage` recovery na reload.

## Cypress E2E

`cypress/e2e/` sadrzi mock+live parove po celinama (`celina1`-`celina5`), plus
`saga`, `todo-final`, `intra-otc` i `arbitro` spec-ove. `*-mock.cy.ts` koriste
`cy.intercept` i rade bez BE; `*-live.cy.ts` zahtevaju pokrenut docker stack.
`arbitro-*` spec-ovi su lokalno-only (NISU u CI — trazе Banka-2-Tools stack).

## Deployment (Docker)

`Dockerfile` radi multi-stage build: `node:20-alpine` (`npm ci` + `npm run
build` → `dist/`) → `nginx:alpine` (kopira `dist/` + custom `nginx.conf` sa
`/api` proxy-em + security headers). `docker-compose.yml` mapira
`${FRONTEND_HOST_PORT:-3000} → 80`.

## Napomene

- **Refresh cena** (Securities): zahteva ADMIN/EMPLOYEE; klijentima je dugme skriveno
- **Mobile**: postoji `Banka-2-Mobile` (Android Kotlin + Jetpack Compose) sa istim flow-om
- **Auth rate limit u Cypress live testovima**: BE `AUTH_RATE_LIMIT_CAPACITY=100000` sprecava 429

## Tim

Banka 2025 Tim 2, Racunarski fakultet 2025/26.
