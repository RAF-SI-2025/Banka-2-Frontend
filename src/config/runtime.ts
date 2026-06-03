/**
 * Runtime konfiguracija — citamo env vrednosti iz `window._env_` koji se
 * popunjava prilikom container startup-a kroz `/config.js` (envsubst iz
 * `public/config.template.js`). Lazy-eval u getter funkcijama dozvoljava
 * Vite-u da resolve-uje `import.meta.env.*` fallback za local `npm run dev`.
 *
 * Kontekst: K8s deploy zahteva da ista Docker image moze biti deploy-ovana
 * u dev/staging/prod bez rebuild-a — env vars se injektuju u ConfigMap +
 * mount-uju kao process env preko `envsubst` u entrypoint-u.
 */

declare global {
  interface Window {
    _env_?: {
      API_URL?: string;
      OUR_BANK_CODE?: string;
      ENV?: string;
    };
  }
}

export function getApiUrl(): string {
  return (
    window._env_?.API_URL ||
    (import.meta.env.VITE_API_URL as string | undefined) ||
    '/api'
  );
}

export function getOurBankCode(): string {
  return (
    window._env_?.OUR_BANK_CODE ||
    (import.meta.env.VITE_OUR_BANK_CODE as string | undefined) ||
    'RN-222'
  );
}

/**
 * Numericki prefiks racuna nase banke (prve 3 cifre broja racuna). Izvodi se iz
 * `getOurBankCode()` (npr. `RN-222` -> `222`) tako da postoji JEDAN izvor istine
 * i deploy sa drugim bank code-om automatski uskladi intra/inter detekciju.
 * Ranije je NewPaymentPage hardkodirao `'222'`, pa bi se na drugom kodu svako
 * intra placanje detektovalo kao inter (pogresan 2PC flow).
 */
export function getOurAccountPrefix(): string {
  const digits = getOurBankCode().replace(/\D/g, '');
  // Bank code je oblika RN-222 (3-cifreni sufiks). Uzimamo poslednje 3 cifre kao
  // prefiks racuna; fallback na cele cifre ako ih je manje od 3.
  return digits.length >= 3 ? digits.slice(-3) : digits;
}

export function getEnv(): string {
  return (
    window._env_?.ENV ||
    (import.meta.env.VITE_ENV as string | undefined) ||
    'unknown'
  );
}

export {};
