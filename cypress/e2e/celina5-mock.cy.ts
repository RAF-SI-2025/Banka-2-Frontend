/**
 * CELINA 5 (Nova) — Mock E2E Tests (DEDICATED, SEQUENCED)
 *
 * Pokriva dve glavne inter-bank distribuirane transakcije iz Celine 5:
 *
 *   1. 2PC medjubankarsko PLACANJE (NewPaymentPage)
 *        - routing po prve 3 cifre racuna primaoca (!= "222" => druga banka)
 *        - 2PC stepper modal: INITIATED -> PREPARED -> COMMITTING -> COMMITTED
 *        - success + abort (sa razlogom) + funds-released poruka
 *
 *   2. OTC inter-bank SAGA EXERCISE (OtcInterBankContractsTab)
 *        - "Iskoristi" -> POST /interbank/otc/contracts/{id}/exercise (handle)
 *        - POLL GET /interbank/payments/{txId}: currentPhase napreduje kroz
 *          5 SAGA faza (FUND -> SECUR -> TRANSFER -> OWNERSHIP -> FINAL) do COMMITTED
 *        - abort varijanta (faza pukne -> ABORTED + kompenzacija/razlog)
 *
 * ==========================================================================
 *  RAZLIKA OD celina4-mock.cy.ts
 * --------------------------------------------------------------------------
 *  celina4-mock ima "shape-only" leakage za inter-bank (FEATURE 9 SAGA S46-S50,
 *  FEATURE 12 2PC routing S62-S68) gde se uglavnom proverava PRISUSTVO elemenata.
 *  Ovaj spec je DETERMINISTICKI / SEKVENCIRAN: koristi counter-based cy.intercept
 *  da na uzastopnim poll-ovima vraca NAPREDUJUCE statuse i tvrdi:
 *    - tacan REDOSLED status tranzicija (badge se menja PREPARING -> COMMITTING -> COMMITTED)
 *    - tacne SAGA faze (label-i + token mapiranje currentPhase -> step index)
 *    - terminalni toast/notifikaciju (success vs error sa razlogom)
 *
 *  Sve preko cy.intercept (mock) — ne zahteva backend.
 *
 * ==========================================================================
 *  KAKO FE STVARNO RADI (cross-check sa source-om; vidi report napomene)
 * --------------------------------------------------------------------------
 *  2PC PLACANJE (src/pages/Payments/NewPaymentPage.tsx +
 *  src/services/interbankPaymentService.ts):
 *    - NewPaymentPage NE poziva odvojen "/interbank-tx" endpoint. Inicira preko
 *      POST /payments i polluje GET /payments/{id} svake 3s (INTERBANK_POLL_MS).
 *    - interbankPaymentService.mapPaymentStatus MAPIRA grubi PaymentStatus
 *      (PENDING/PROCESSING/COMPLETED/REJECTED/CANCELLED) u InterbankPaymentStatus:
 *        PENDING->INITIATED, PROCESSING->COMMITTING, COMPLETED->COMMITTED,
 *        REJECTED/CANCELLED->ABORTED. Ako BE posalje opciono polje `sagaPhase`
 *        (live InterbankTransactionStatus), ono ima PREDNOST i mapira se direktno:
 *        PREPARING->PREPARING, PREPARED->PREPARED, COMMITTED->COMMITTED,
 *        ROLLED_BACK->ABORTED, STUCK->STUCK.
 *    - Modal badge (data-testid="interbank-status-badge") prikazuje MAPIRANI status
 *      string (npr. "PREPARING", "COMMITTED", "ABORTED").
 *    - polling koristi pravi setTimeout => testovi koriste cy.clock()+cy.tick(3000).
 *
 *  OTC SAGA (src/pages/Otc/OtcInterBankContractsTab.tsx +
 *  src/services/interbankOtcService.ts):
 *    - "Iskoristi" se prikazuje SAMO za ACTIVE ugovor gde sam ja kupac I settlement
 *      datum je u buducnosti (isFutureSettlementDate). Zato pre visit-a postavljamo
 *      cy.clock() na datum PRE settlement-a (isti pattern kao celina4-mock).
 *    - handleExercise: POST /interbank/otc/contracts/{id}/exercise?buyerAccountId=N
 *      -> vraca InterbankTransaction handle.
 *    - Polling: raw api.get GET /interbank/payments/{transactionId} svake 3s
 *      (SAGA_POLL_INTERVAL_MS), max 60. currentPhase token -> step index:
 *        FUND/SREDST -> 1, SECUR/HARTIJ/STOCK -> 2, TRANSFER -> 3,
 *        OWNERSHIP/VLASNIST -> 4, FINAL/COMMIT -> 5. status COMMITTED => index 5.
 *      Faze (labels): Rezervacija sredstava / Rezervacija hartija / Transfer /
 *      Prenos vlasnistva / Finalizacija.
 *    - terminal COMMITTED -> toast.success; ABORTED/STUCK -> toast.error(pickFailureReason).
 * ==========================================================================
 */

import { setupClientSession } from '../support/commands';

// ============================================================
//  ZAJEDNICKI HELPERI
// ============================================================

// VerificationModal (TOTP) flow: "Popuni" auto-popunjava aktivni OTP, pa "Potvrdi".
// Pre OTP-a NewPaymentPage prikazuje confirm dialog ("Potvrdi i nastavi").
function fillPaymentAndVerify(receiverAccount: string) {
  cy.get('select#fromAccount').select(1);
  cy.get('input#toAccount').clear().type(receiverAccount);
  cy.get('input#recipientName').clear().type('Marko Primaoc');
  cy.get('input#amount').clear().type('5000');
  cy.get('textarea#purpose').clear().type('Celina5 2PC test');
  cy.contains('button', /Nastavi na verifikaciju/i).click();
  // Bug T2-005 confirm dialog pre OTP-a
  cy.contains('button', 'Potvrdi i nastavi').click();
  cy.contains(/^Verifikacija/).should('be.visible');
  cy.contains('button', 'Popuni').click({ force: true });
  cy.contains('button', 'Potvrdi').last().click({ force: true });
}

// PaymentResponseDto shaper (BE shape koji interbankPaymentService konzumira).
function payment(
  id: number,
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'REJECTED' | 'CANCELLED',
  extra: Record<string, unknown> = {},
) {
  return {
    id,
    fromAccount: '222000100000000110',
    toAccount: '111000000000000777',
    amount: 5000,
    currency: 'RSD',
    status,
    createdAt: '2026-05-29T10:00:00',
    ...extra,
  };
}

// InterbankTransaction shaper za OTC SAGA poll (GET /interbank/payments/{id}).
function otcTx(
  transactionId: string,
  status: string,
  currentPhase: string | null,
  extra: Record<string, unknown> = {},
) {
  return {
    id: 900,
    transactionId,
    type: 'OTC',
    status,
    currentPhase,
    senderBankCode: 'BANKA1',
    receiverBankCode: 'BANKA2',
    amount: 800,
    currency: 'USD',
    createdAt: '2026-04-25T10:00:00Z',
    retryCount: 0,
    ...extra,
  };
}

// ============================================================
//  DESCRIBE 1: Celina 5: 2PC inter-bank placanje
// ============================================================
describe('Celina 5: 2PC inter-bank placanje', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/accounts/my', {
      statusCode: 200,
      body: [
        {
          id: 1,
          accountNumber: '222000100000000110',
          name: 'Klijent RSD',
          ownerName: 'Stefan Jovanovic',
          availableBalance: 150000,
          balance: 150000,
          reservedBalance: 0,
          currency: 'RSD',
          accountType: 'CHECKING',
          accountSubtype: 'STANDARD',
          status: 'ACTIVE',
        },
      ],
    }).as('myAccounts');
    cy.intercept('GET', '**/api/payment-recipients*', { statusCode: 200, body: [] }).as('recipients');
    cy.intercept('POST', '**/api/payments/request-otp', { statusCode: 200, body: { sent: true, message: 'OTP sent' } });
    cy.intercept('GET', '**/api/payments/my-otp', {
      statusCode: 200,
      body: { active: true, code: '123456', attempts: 0, maxAttempts: 3 },
    });
  });

  // (c) ROUTING — strani prefiks pokrece inter-bank banner; domaci (222) NE.
  it('C5-PAY-routing-foreign: strani prefiks (111...) prikazuje 2PC banner pre submit-a', () => {
    cy.visit('/payments/new', { onBeforeLoad: setupClientSession });
    cy.wait('@myAccounts');
    cy.get('#toAccount').type('111000000000000777');
    cy.get('[data-testid="interbank-warning-banner"]').should('be.visible');
    cy.contains('Medjubankarsko placanje').should('be.visible');
    cy.contains('2-Phase Commit').should('be.visible');
  });

  it('C5-PAY-routing-local: domaci prefiks (222...) NE prikazuje 2PC banner', () => {
    cy.visit('/payments/new', { onBeforeLoad: setupClientSession });
    cy.wait('@myAccounts');
    cy.get('#toAccount').type('222000100000000999');
    cy.get('[data-testid="interbank-warning-banner"]').should('not.exist');
  });

  // (a) SUCCESS — sekvencirano: PREPARING -> COMMITTING -> COMMITTED (sagaPhase prednost).
  it('C5-PAY-success: poll napreduje PREPARING -> COMMITTING -> COMMITTED + success toast', () => {
    cy.intercept('POST', '**/api/payments', { statusCode: 200, body: payment(701, 'PENDING') }).as('initPay');

    // Counter-based poll: svaki GET vraca SLEDECI status u nizu. `sagaPhase`
    // ima prednost nad grubim PaymentStatus mapiranjem (vidi interbankPaymentService).
    let pollCall = 0;
    cy.intercept('GET', '**/api/payments/701', (req) => {
      pollCall += 1;
      if (pollCall === 1) {
        req.reply({ statusCode: 200, body: payment(701, 'PROCESSING', { sagaPhase: 'PREPARING' }) });
      } else if (pollCall === 2) {
        req.reply({ statusCode: 200, body: payment(701, 'PROCESSING', { sagaPhase: 'COMMITTING' }) });
      } else {
        req.reply({ statusCode: 200, body: payment(701, 'COMPLETED', { sagaPhase: 'COMMITTED' }) });
      }
    }).as('poll');

    cy.visit('/payments/new', { onBeforeLoad: setupClientSession });
    cy.wait('@myAccounts');
    cy.wait('@recipients');
    cy.clock();

    fillPaymentAndVerify('111000000000000777');
    cy.wait('@initPay');

    // "u obradi" info toast cim transakcija krene
    cy.get('body', { timeout: 10000 }).invoke('text').should('include', 'u obradi');

    // Poll 1 -> PREPARING
    cy.tick(3000);
    cy.wait('@poll');
    cy.get('[data-testid="interbank-status-badge"]').should('have.text', 'PREPARING');

    // Poll 2 -> COMMITTING (sredstva se prebacuju)
    cy.tick(3000);
    cy.wait('@poll');
    cy.get('[data-testid="interbank-status-badge"]').should('have.text', 'COMMITTING');

    // Poll 3 -> COMMITTED (terminal)
    cy.tick(3000);
    cy.wait('@poll');
    cy.get('[data-testid="interbank-status-badge"]').should('have.text', 'COMMITTED');

    // Terminal success: COMMITTED step done + success toast.
    cy.get('[data-testid="interbank-step-COMMITTED"]').should('have.attr', 'data-state', 'done');
    cy.get('body', { timeout: 10000 })
      .invoke('text')
      .should('include', 'Inter-bank placanje je uspesno izvrseno');
    // Terminal => "Zatvori" dugme dostupno.
    cy.contains('button', 'Zatvori').should('be.visible');
  });

  // (b) NOT-READY / ABORT — PREPARING -> ABORTED sa BE razlogom; sredstva se oslobadjaju.
  it('C5-PAY-abort: poll PREPARING -> ABORTED (razlog) + failure poruka', () => {
    cy.intercept('POST', '**/api/payments', { statusCode: 200, body: payment(702, 'PENDING') }).as('initPay');

    let pollCall = 0;
    cy.intercept('GET', '**/api/payments/702', (req) => {
      pollCall += 1;
      if (pollCall === 1) {
        req.reply({ statusCode: 200, body: payment(702, 'PROCESSING', { sagaPhase: 'PREPARING' }) });
      } else {
        // ROLLED_BACK (BE InterbankTransactionStatus) -> ABORTED (FE) + razlog.
        // Spec Celina 5: "ABORTED prikazi razlog (npr. 'Racun primaoca neaktivan')".
        req.reply({
          statusCode: 200,
          body: payment(702, 'REJECTED', {
            sagaPhase: 'ROLLED_BACK',
            failureReason: 'Racun primaoca je neaktivan — sredstva su vracena na vas racun.',
          }),
        });
      }
    }).as('poll');

    cy.visit('/payments/new', { onBeforeLoad: setupClientSession });
    cy.wait('@myAccounts');
    cy.wait('@recipients');
    cy.clock();

    fillPaymentAndVerify('111000000000000777');
    cy.wait('@initPay');

    // Faza 1: PREPARING
    cy.tick(3000);
    cy.wait('@poll');
    cy.get('[data-testid="interbank-status-badge"]').should('have.text', 'PREPARING');

    // Faza 2: ABORTED (terminal) + prikaz razloga (sredstva oslobodjena).
    cy.tick(3000);
    cy.wait('@poll');
    cy.get('[data-testid="interbank-status-badge"]').should('have.text', 'ABORTED');
    cy.get('body', { timeout: 10000 })
      .invoke('text')
      .should('include', 'Racun primaoca je neaktivan');
    // FE eksplicitno javlja da su sredstva vracena (funds released).
    cy.get('body').invoke('text').should('include', 'sredstva su vracena');
    cy.contains('button', 'Zatvori').should('be.visible');
  });
});

// ============================================================
//  DESCRIBE 2: Celina 5: OTC inter-bank SAGA exercise
// ============================================================
describe('Celina 5: OTC inter-bank SAGA exercise', () => {
  // Inter-bank ugovor gde je trenutni klijent (Stefan, setupClientSession) kupac.
  // matchesCurrentUser matchuje buyerName "Stefan Jovanovic" ILI buyerUserId.
  // settlementDate je u buducnosti relativno na cy.clock() (2026-04-25).
  const interBankContract = {
    id: 'ib-contract-1',
    listingId: 401,
    listingTicker: 'AAPL',
    listingName: 'Apple Inc.',
    listingCurrency: 'USD',
    buyerUserId: 'stefan.jovanovic',
    buyerBankCode: 'BANKA1',
    buyerName: 'Stefan Jovanovic',
    sellerUserId: 'remote-seller-1',
    sellerBankCode: 'BANKA2',
    sellerName: 'Remote Seller',
    quantity: 8,
    strikePrice: 100,
    premium: 25,
    currentPrice: 126,
    settlementDate: '2026-05-20',
    status: 'ACTIVE',
    createdAt: '2026-04-20T10:00:00Z',
  };

  const accounts = [
    {
      id: 1,
      accountNumber: '222000000000000001',
      ownerName: 'Stefan Jovanovic',
      accountType: 'CHECKING',
      currency: 'USD',
      balance: 10000,
      availableBalance: 10000,
      reservedBalance: 0,
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    // Intra-bank (lokalni) OTC fetch-evi koje OtcContractsPage pravi pri mount-u.
    cy.intercept('GET', '**/api/otc/offers/active*', { statusCode: 200, body: [] }).as('localOffers');
    cy.intercept('GET', '**/api/otc/contracts*', { statusCode: 200, body: [] }).as('localContracts');
    cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: accounts }).as('myAccounts');
    cy.intercept('GET', '**/api/interbank/otc/contracts/my*', { statusCode: 200, body: [interBankContract] }).as('remoteContracts');
  });

  // SUCCESS: faze napreduju FUND -> SECUR -> TRANSFER -> OWNERSHIP -> FINAL/COMMITTED.
  it('C5-OTC-success: SAGA progres napreduje kroz 5 faza do COMMITTED', () => {
    const TX = 'saga-success';

    // Counter-based poll: svaki GET vraca SLEDECU fazu. Tokeni su EGZAKTNI string-ovi
    // koje FE getCurrentPhaseIndex matchuje (FUND/SECUR/TRANSFER/OWNERSHIP/FINAL).
    let pollCall = 0;
    cy.intercept('GET', `**/api/interbank/payments/${TX}`, (req) => {
      pollCall += 1;
      switch (pollCall) {
        case 1:
          // SECUR -> step 2
          req.reply({ statusCode: 200, body: otcTx(TX, 'PREPARING', 'RESERVE_SECURITIES') });
          break;
        case 2:
          // TRANSFER -> step 3
          req.reply({ statusCode: 200, body: otcTx(TX, 'PREPARED', 'TRANSFER') });
          break;
        case 3:
          // OWNERSHIP -> step 4
          req.reply({ statusCode: 200, body: otcTx(TX, 'COMMITTING', 'OWNERSHIP_TRANSFER') });
          break;
        default:
          // FINAL + COMMITTED -> step 5 + terminal
          req.reply({
            statusCode: 200,
            body: otcTx(TX, 'COMMITTED', 'FINALIZING', { committedAt: '2026-04-25T10:00:12Z' }),
          });
      }
    }).as('saga');

    cy.clock(new Date('2026-04-25T09:00:00Z').getTime());
    cy.visit('/otc/ugovori', { onBeforeLoad: setupClientSession });
    cy.wait('@localContracts');
    cy.wait('@myAccounts');
    cy.contains('button', 'Iz drugih banaka').click();
    cy.wait('@remoteContracts');

    cy.intercept('POST', '**/api/interbank/otc/contracts/*/exercise*', {
      statusCode: 200,
      body: otcTx(TX, 'INITIATED', 'RESERVE_FUNDS'),
    }).as('exercise');

    cy.contains('tr', 'AAPL').within(() => {
      cy.contains('button', 'Iskoristi').click();
    });
    cy.get('#interbank-exercise-account').select('1');
    cy.contains('button', 'Potvrdi exercise').click();
    cy.wait('@exercise');

    // SAGA modal sa 5 faza
    cy.contains('SAGA exercise u toku').should('be.visible');
    cy.contains('Rezervacija sredstava').should('be.visible');
    cy.contains('Rezervacija hartija').should('be.visible');
    cy.contains('Transfer').should('be.visible');
    cy.contains('Prenos vlasnistva').should('be.visible');
    cy.contains('Finalizacija').should('be.visible');

    // Inicijalno (RESERVE_FUNDS, status INITIATED) -> faza 1 "Rezervacija sredstava" aktivna
    cy.contains('div', 'Rezervacija sredstava').parent().should('contain', 'U toku');

    // Poll 1 -> RESERVE_SECURITIES (step2): faza 1 zavrsena, faza 2 aktivna
    cy.tick(3000);
    cy.wait('@saga');
    cy.contains('div', 'Rezervacija sredstava').parent().should('contain', 'Zavrseno');
    cy.contains('div', 'Rezervacija hartija').parent().should('contain', 'U toku');

    // Poll 2 -> TRANSFER (step3)
    cy.tick(3000);
    cy.wait('@saga');
    cy.contains('div', 'Transfer').parent().should('contain', 'U toku');

    // Poll 3 -> OWNERSHIP_TRANSFER (step4)
    cy.tick(3000);
    cy.wait('@saga');
    cy.contains('div', 'Prenos vlasnistva').parent().should('contain', 'U toku');

    // Poll 4 -> COMMITTED (terminal, step5)
    cy.tick(3000);
    cy.wait('@saga');
    cy.get('body', { timeout: 10000 }).invoke('text').should('include', 'COMMITTED');
    // Sve faze zavrsene na COMMITTED
    cy.contains('div', 'Finalizacija').parent().should('contain', 'Zavrseno');
    // Terminalni success toast
    cy.get('.Toastify__toast', { timeout: 10000 })
      .should('exist')
      .invoke('text')
      .should('include', 'Inter-bank exercise je uspesno finalizovan');
  });

  // ABORT: faza pukne usred SAGA -> ABORTED + kompenzacija/razlog.
  it('C5-OTC-abort: faza TRANSFER puca -> ABORTED + kompenzacioni razlog', () => {
    const TX = 'saga-abort';

    let pollCall = 0;
    cy.intercept('GET', `**/api/interbank/payments/${TX}`, (req) => {
      pollCall += 1;
      if (pollCall === 1) {
        // Napredovala do TRANSFER faze (step 3)
        req.reply({ statusCode: 200, body: otcTx(TX, 'PREPARED', 'TRANSFER') });
      } else {
        // Faza puca -> ABORTED. failureReason = kompenzaciona poruka (rollback rezervacija).
        req.reply({
          statusCode: 200,
          body: otcTx(TX, 'ABORTED', 'TRANSFER', {
            abortedAt: '2026-04-25T10:00:06Z',
            failureReason: 'Partner banka odbila prenos hartija — rezervacija sredstava je ponistena (kompenzacija).',
          }),
        });
      }
    }).as('saga');

    cy.clock(new Date('2026-04-25T09:00:00Z').getTime());
    cy.visit('/otc/ugovori', { onBeforeLoad: setupClientSession });
    cy.wait('@localContracts');
    cy.wait('@myAccounts');
    cy.contains('button', 'Iz drugih banaka').click();
    cy.wait('@remoteContracts');

    cy.intercept('POST', '**/api/interbank/otc/contracts/*/exercise*', {
      statusCode: 200,
      body: otcTx(TX, 'INITIATED', 'RESERVE_FUNDS'),
    }).as('exercise');

    cy.contains('tr', 'AAPL').within(() => {
      cy.contains('button', 'Iskoristi').click();
    });
    cy.get('#interbank-exercise-account').select('1');
    cy.contains('button', 'Potvrdi exercise').click();
    cy.wait('@exercise');

    cy.contains('SAGA exercise u toku').should('be.visible');

    // Poll 1 -> TRANSFER aktivna
    cy.tick(3000);
    cy.wait('@saga');
    cy.contains('div', 'Transfer').parent().should('contain', 'U toku');

    // Poll 2 -> ABORTED (terminal): TRANSFER faza markirana "Prekinuto" + razlog.
    cy.tick(3000);
    cy.wait('@saga');
    cy.get('body', { timeout: 10000 }).invoke('text').should('include', 'ABORTED');
    cy.contains('div', 'Transfer').parent().should('contain', 'Prekinuto');
    // Dedikovani aborted alert (data-testid="saga-aborted-alert") + kompenzacioni razlog.
    cy.get('[data-testid="saga-aborted-alert"]').should('exist');
    cy.get('body')
      .invoke('text')
      .should('include', 'Partner banka odbila prenos hartija');
    cy.get('body').invoke('text').should('include', 'kompenzacija');
  });
});
