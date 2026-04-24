# Banka 2 — Frontend

React 19 SPA koja pokriva celokupni bankarski UI: klijentski portal (racuni, kartice, placanja, transferi, berza, OTC), Employee portal (klijenti, orderi), Supervizor portal (aktuari, porez), Admin portal (zaposleni, berze). Deo projekta **Softversko inzenjerstvo** na Racunarskom fakultetu 2025/26.

## Tech Stack

- **React 19** + **TypeScript 5**
- **Vite 7.3** (dev server + build)
- **Tailwind CSS 3** + **shadcn/ui** (Radix UI) + **lucide-react** ikone
- **React Router v6**
- **React Hook Form** + **Zod** (forme + validacija)
- **Axios** sa JWT auto-refresh interceptor-ima
- **Recharts** (grafikoni cena)
- **Vitest** — unit testovi (**1254 testa** u 77 fajlova)
- **Cypress** — E2E testovi (7 fajlova: celina1-3 mock + live + kompletan scenario)

## Pokretanje

### Docker (preporuceno)

```bash
docker compose up -d --build
```

Pokrece SPA na `http://localhost:3000` (nginx:alpine servira statiku iz `dist/`).

**Obavezno pokreni backend pre** — frontend nginx proxira `/api/*` i `/auth/*` na `http://banka2_backend:8080`. Oba compose fajla koriste isti docker network.

### Lokalni dev server

```bash
npm install
npm run dev     # http://localhost:5173 (Vite HMR)
```

Za proxy ka backendu vec je podesen u `vite.config.ts` — ne treba `.env` u dev rezimu.

### Testovi

```bash
npm test               # Vitest watch mode
npm run test:run       # CI mode (1254 testa, ~15s)
npm run test:coverage  # coverage report
```

Cypress:

```bash
npm run cypress:open   # interactive
npm run cypress:run    # headless (zahteva live BE na 8080 + FE na 3000)

# celi suite:
npx cypress run --spec "cypress/e2e/celina1-mock.cy.ts,cypress/e2e/celina2-mock.cy.ts,cypress/e2e/celina3-mock.cy.ts,cypress/e2e/celina1-live.cy.ts,cypress/e2e/celina2-live.cy.ts,cypress/e2e/celina3-live.cy.ts,cypress/e2e/e2e-scenario-live.cy.ts" --config video=false,baseUrl=http://localhost:3000
```

### Build

```bash
npm run build          # vite build → dist/
npm run build:check    # tsc --noEmit + eslint + vitest + build
npm run lint           # ESLint
npm run preview        # preview dist/ lokalno
```

## Environment

Build time (Vite zamenjuje u bundle-u):

| Varijabla | Default | Opis |
|-----------|---------|------|
| `VITE_API_URL` | `http://localhost:8080` | Base URL backend-a u dev-u |

U produkciji (Docker), sve `/api/*` i `/auth/*` zahtevi se proksiraju kroz nginx u kontejneru — `VITE_API_URL` nije potreban.

## Struktura projekta

```
src/
├── components/
│   ├── layout/          # ClientSidebar, Navbar, ProtectedRoute, Dashboard layouts
│   ├── shared/          # VerificationModal (OTP), EmptyState, Skeleton loaders
│   └── ui/              # shadcn/ui reusable (Button, Card, Dialog, Input, ...)
├── context/
│   ├── AuthContext.tsx       # JWT + permisije iz /employees?email
│   └── ThemeContext.tsx      # light/dark theme, persist u localStorage
├── hooks/               # useCountUp, useDebounce, useQueryParams
├── lib/                 # notify (toast), utils (cn, classnames)
├── pages/
│   ├── Landing/         # Marketing landing + login/register CTA
│   ├── Login/           # Login + forgot password
│   ├── Home/            # Dashboard po ulozi (Client/Admin/Supervizor/Agent)
│   ├── Accounts/        # Lista + details + requests (klijent i employee)
│   ├── Cards/           # Kartice + request + block/unblock
│   ├── Payments/        # New payment + recipients + history + PDF receipt
│   ├── Transfers/       # Internal + FX + history
│   ├── Securities/      # Berza lista + details (chart + options chain)
│   ├── Orders/          # Create order + my orders + supervizor view
│   ├── Portfolio/       # Drzanje + profit + OTC public toggle
│   ├── Otc/             # OTC trgovina + ponude + ugovori
│   ├── Loans/           # Zahtev za kredit + rate + early repayment
│   ├── Admin/           # Employee CRUD + berze + actuary limits
│   ├── Actuaries/       # Agent limit management
│   ├── Tax/             # Porez na kapitalnu dobit
│   └── Clients/         # Client portal (employee-side)
├── services/            # Axios wrappers po domenu (auth, employees, listings, orders, otc, ...)
├── types/               # TypeScript tipovi (celina1, celina2, celina3, auth, ...)
└── utils/               # formatters (sr-RS locale), jwt decode, validationSchemas
```

## Autentifikacija i autorizacija

1. `POST /auth/login` → `{ accessToken, refreshToken }` u `sessionStorage`
2. JWT dekoder (`utils/jwt.ts`) cita `sub` (email), `role` (ADMIN/EMPLOYEE/CLIENT), `active`
3. Ako role = ADMIN ili EMPLOYEE → fetch `/employees?email=<sub>` da vidimo prave permisije
4. `AuthContext` daje: `user`, `isAdmin`, `isSupervisor`, `isAgent`, `hasPermission(code)`
5. Route guards u `App.tsx`: `adminOnly`, `employeeOnly`, authenticated
6. Axios response interceptor auto-refresh na 401

## Dizajn sistem

- **Primary gradient**: `from-indigo-500 to-violet-600`
- **Shadow akcenta**: `shadow-lg shadow-indigo-500/20`
- **Badges**: `success` (emerald), `warning` (amber), `destructive` (red), `info` (blue), `secondary` (slate)
- **Loading**: skeleton sa `animate-pulse` — nikad spinner
- **Empty state**: ikonica u krugu + naslov + podnaslov
- **Formatiranje brojeva**: `sr-RS` locale (zarez decimale, tacka hiljade)
- **Dark mode**: Tailwind `dark:` prefix svuda, prekidanje preko ThemeContext

## OTP verifikacija

Placanja, transferi i orderi zahtevaju OTP:

1. Modal se otvori → `POST /payments/request-otp` generise kod
2. Mobilna aplikacija prikaze kod (realni flow) ILI FE fetchuje `GET /payments/my-otp` i autopopuni kroz "Popuni" dugme (dev convenience)
3. Korisnik unosi 6-cifreni kod → `onVerified(code)` u parent → parent salje POST na stvarni endpoint sa `otpCode`
4. Backend verifikuje: pogresan → 403 `{verified:false, blocked:false, message:"Preostalo pokusaja: N"}`; 3. strike → `blocked:true` i modal se zatvara

## Test mode badge

Securities lista pokazuje **SIMULIRANI PODACI** badge (amber) kad bilo koji listing dolazi sa berze u test modu. Inace **LIVE** (emerald). Koristi `listing.isTestMode` polje koje backend setuje iz `Exchange.testMode`. Test mode takodje spreci Alpha Vantage pozive u dev-u.

## Cypress E2E

```
cypress/e2e/
├── celina1-mock.cy.ts       ~70 testova (Auth, Employee CRUD, Permisije)
├── celina1-live.cy.ts       ~90 testova (isti na pravom BE)
├── celina2-mock.cy.ts       ~135 testova (Accounts, Payments, Transfers, Exchange, Cards, Loans)
├── celina2-live.cy.ts       ~105 testova
├── celina3-mock.cy.ts       ~130 testova (Securities, Orders, Portfolio, Tax, Aktuari, Margin)
├── celina3-live.cy.ts       ~100 testova
└── e2e-scenario-live.cy.ts  Kompletan radni dan: setup agenta → orderi → portfolio → SELL → porez
```

`mock` varijante koriste `cy.intercept` — rade bez BE. `live` zahtevaju docker stack pokrenut.

## Deployment (Docker)

`Dockerfile` radi multi-stage build:

1. `node:20-alpine` — `npm ci` + `npm run build` → `dist/`
2. `nginx:alpine` — kopira `dist/` u `/usr/share/nginx/html` + custom `nginx.conf` sa `/api` i `/auth` proxy-em

`docker-compose.yml` mapira `3000 → 80`.

## Poznate preporuke

- **Dev bez backend-a**: `mock` cypress testovi ili pokretanje Vite dev servera i koriscenje `VITE_API_URL` ka deploy-ovanom backend-u
- **Refresh cena** (Securities): zahteva ADMIN/EMPLOYEE; klijentima je dugme skriveno
- **Mobile**: postoji `Banka-2-Mobile` (Android Kotlin + Jetpack Compose) — pokriva klijentski flow. Nije u ovom repo-u.

## Tim

Banka 2025 Tim 2, Racunarski fakultet 2025/26.
