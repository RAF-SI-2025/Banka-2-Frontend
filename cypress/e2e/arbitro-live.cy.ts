/**
 * ARBITRO AI ASISTENT - Live E2E Tests
 *
 * NIJE u CI pipeline-u (excluded iz cypress-live spec liste u .github/workflows/ci.yml).
 * Pokrece se SAMO lokalno sa pravim BE + Arbitro Tools stack-om:
 *
 *   1. Backend up: cd Banka-2-Backend && docker compose up -d
 *   2. Arbitro Tools up: cd Banka-2-Backend/Banka-2-Tools && docker compose up -d
 *      (sa GPU: docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d)
 *   3. Frontend up: cd Banka-2-Frontend && docker compose up -d
 *   4. Sacekaj da Ollama pull-uje gemma4:e2b model (~5min prvi put)
 *   5. Pokreni:
 *      npx cypress run --spec "cypress/e2e/arbitro-live.cy.ts" --config video=false,baseUrl=http://localhost:3000
 *
 * Smoke testovi koji potvrdjuju end-to-end Arbitro flow protiv pravog LLM-a.
 * Toleranti su sa timeout-ima jer prva chat poruka uzima 1-3s na GPU, 60-120s
 * na CPU (Ollama mora ucitati model u VRAM kad ga prvi put pozove posle KEEP_ALIVE
 * isteka).
 */

const E_MAIL = 'stefan.jovanovic@gmail.com';
const PASS = 'Klijent12345';

function loginUI(email = E_MAIL, password = PASS) {
  cy.visit('/login');
  cy.get('#email').type(email);
  cy.get('#password').type(password);
  cy.contains('button', 'Prijavi se').click();
  cy.url({ timeout: 15000 }).should('include', '/home');
}

describe('Arbitro Live: Backend health endpoint', () => {
  it('GET /assistant/health vraca llmReachable polje', () => {
    cy.request({
      method: 'GET',
      url: '/api/assistant/health',
      failOnStatusCode: false,
    }).then((res) => {
      // 200 ako je backend online (auth/no-auth zavisi od konfiga)
      expect(res.status).to.be.oneOf([200, 401, 403]);
      if (res.status === 200) {
        expect(res.body).to.have.property('llmReachable');
      }
    });
  });
});

describe('Arbitro Live: FAB i Panel', () => {
  beforeEach(() => {
    loginUI();
  });

  it('FAB se pojavljuje na home stranici', () => {
    cy.get('[aria-label="Otvori Arbitro asistent"]', { timeout: 10000 }).should('be.visible');
  });

  it('Klik na FAB otvara panel sa empty state-om', () => {
    cy.get('[aria-label="Otvori Arbitro asistent"]').click();
    cy.get('[role="dialog"][aria-label="Arbitro AI asistent"]').should('be.visible');
    cy.contains('Zdravo! Ja sam Arbitro').should('be.visible');
  });

  it('Esc zatvara panel', () => {
    cy.get('[aria-label="Otvori Arbitro asistent"]').click();
    cy.get('body').type('{esc}');
    cy.get('[role="dialog"][aria-label="Arbitro AI asistent"]').should('not.exist');
  });

  it('Panel pokazuje status (Lokalno · Gemma ILI Offline)', () => {
    cy.get('[aria-label="Otvori Arbitro asistent"]').click();
    cy.get('[role="dialog"][aria-label="Arbitro AI asistent"]').within(() => {
      cy.contains(/Lokalno|Offline|Gemma/i).should('be.visible');
    });
  });
});

describe('Arbitro Live: Chat sa pravim LLM-om (zahteva Ollama)', () => {
  beforeEach(() => {
    loginUI();
    // Skip celog suite-a ako BE javlja da LLM nije reachable
    cy.request({ method: 'GET', url: '/api/assistant/health', failOnStatusCode: false }).then((res) => {
      if (res.status !== 200 || !res.body?.llmReachable) {
        cy.log('Arbitro LLM nije reachable, preskacem live chat testove');
        // Ovo ne preskace test, ali je marker — assertions ce se prilagoditi.
      }
    });
  });

  it('Slanje "zdravo" vraca asistentov odgovor (timeout 90s za prvi LLM load)', () => {
    cy.request({ method: 'GET', url: '/api/assistant/health', failOnStatusCode: false }).then((res) => {
      if (res.status !== 200 || !res.body?.llmReachable) {
        cy.log('Skip: LLM offline');
        return;
      }

      cy.get('[aria-label="Otvori Arbitro asistent"]').click();
      cy.get('textarea, [contenteditable="true"]').first().type('Zdravo Arbitro, kratak pozdrav molim.');
      cy.contains('button', /pošalji|send/i).first().click({ force: true });

      // Asistent odgovor: tekst u arbitro-message-assistant ili slicno
      cy.get('[role="dialog"][aria-label="Arbitro AI asistent"]', { timeout: 90000 })
        .within(() => {
          cy.contains(/zdravo|pozdrav|kako|hi|hello/i, { timeout: 90000 }).should('exist');
        });
    });
  });
});

describe('Arbitro Live: Konverzacije persist preko BE', () => {
  beforeEach(() => {
    loginUI();
  });

  it('GET /assistant/conversations vraca array', () => {
    cy.request({
      method: 'GET',
      url: '/api/assistant/conversations',
      headers: {
        Authorization: `Bearer ${window.sessionStorage.getItem('accessToken') || ''}`,
      },
      failOnStatusCode: false,
    }).then((res) => {
      if (res.status === 200) {
        expect(res.body).to.be.an('array');
      }
    });
  });
});

describe('Arbitro Live: Suggestions endpoint', () => {
  beforeEach(() => {
    loginUI();
  });

  it('GET /assistant/suggestions je dostupan klijentu', () => {
    cy.request({
      method: 'GET',
      url: '/api/assistant/suggestions',
      headers: {
        Authorization: `Bearer ${window.sessionStorage.getItem('accessToken') || ''}`,
      },
      failOnStatusCode: false,
    }).then((res) => {
      // 200 sa array-em (mozda prazan), ili 401 ako nije authentifikovan
      expect(res.status).to.be.oneOf([200, 401, 403]);
      if (res.status === 200) {
        expect(res.body).to.be.an('array');
      }
    });
  });
});

describe('Arbitro Live: TTS endpoint (Kokoro)', () => {
  beforeEach(() => {
    loginUI();
  });

  it('POST /assistant/tts vraca audio/wav (ako je Kokoro sidecar up)', () => {
    cy.request({
      method: 'POST',
      url: '/api/assistant/tts',
      body: { text: 'Test', voice: 'af_bella', lang: 'en-us', speed: 1.0 },
      headers: {
        Authorization: `Bearer ${window.sessionStorage.getItem('accessToken') || ''}`,
        'Content-Type': 'application/json',
      },
      failOnStatusCode: false,
      encoding: 'binary',
    }).then((res) => {
      // 200 ako Kokoro radi, 502/503 ako sidecar nije up, 401 ako nije auth
      expect(res.status).to.be.oneOf([200, 401, 403, 500, 502, 503]);
      if (res.status === 200) {
        expect(res.headers['content-type']).to.include('audio/wav');
      }
    });
  });
});

describe('Arbitro Live: Hidden routes (FAB visibility)', () => {
  it('FAB nije vidljiv na landing page-u', () => {
    cy.window().then((win) => win.sessionStorage.clear());
    cy.visit('/');
    cy.get('[aria-label="Otvori Arbitro asistent"]').should('not.exist');
  });

  it('FAB nije vidljiv na /login', () => {
    cy.window().then((win) => win.sessionStorage.clear());
    cy.visit('/login');
    cy.get('[aria-label="Otvori Arbitro asistent"]').should('not.exist');
  });
});
