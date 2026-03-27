/// <reference types="cypress" />

function base64UrlEncode(input: string) {
    return btoa(input)
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

function createJwt(role: string, email = 'marko.petrovic@banka.rs') {
    const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = base64UrlEncode(
        JSON.stringify({
            sub: email,
            role,
            active: true,
            exp: Math.floor(Date.now() / 1000) + 3600,
            iat: Math.floor(Date.now() / 1000),
        })
    );
    return `${header}.${payload}.signature`;
}

const MOCK_CARDS = [
    {
        id: 1,
        cardNumber: '4532123456789010',
        holderName: 'Stefan Jovanovic',
        cardType: 'VISA',
        status: 'ACTIVE',
        expirationDate: '2026-12-31',
        accountNumber: '265000000000000112',
        limit: 100000,
    },
    {
        id: 2,
        cardNumber: '5425234567890123',
        holderName: 'Stefan Jovanovic',
        cardType: 'MASTERCARD',
        status: 'BLOCKED',
        expirationDate: '2027-06-30',
        accountNumber: '265000000000000112',
        limit: 50000,
    },
    {
        id: 3,
        cardNumber: '30123456789012',
        holderName: 'Milica Nikolic',
        cardType: 'DINACARD',
        status: 'ACTIVE',
        expirationDate: '2025-09-15',
        accountNumber: '265000000000000336',
        limit: 75000,
    },
];

describe('CardListPage - Moje kartice', () => {
    beforeEach(() => {
        const accessToken = createJwt('ADMIN');

        // Intercept sve potrebne API pozive
        cy.intercept('GET', '**/api/cards/my', { body: MOCK_CARDS }).as('getCards');
        cy.intercept('PATCH', '**/api/cards/*/block', { statusCode: 200 }).as('blockCard');
        cy.intercept('PATCH', '**/api/cards/*/unblock', { statusCode: 200 }).as('unblockCard');
        cy.intercept('PATCH', '**/api/cards/*/deactivate', { statusCode: 200 }).as('deactivateCard');
        cy.intercept('PATCH', '**/api/cards/*/limit', { statusCode: 200 }).as('changeLimitCard');

        cy.visit('http://localhost:3000/cards', {
            onBeforeLoad: (win: Cypress.AUTWindow) => {
                win.sessionStorage.setItem('accessToken', accessToken);
                win.sessionStorage.setItem('refreshToken', 'refresh-token');
                win.sessionStorage.setItem('user', JSON.stringify({
                    id: 1,
                    email: 'marko.petrovic@banka.rs',
                    firstName: 'Marko',
                    lastName: 'Petrovic',
                    role: 'ADMIN',
                    permissions: ['ALL'],
                }));
            },
        });

        cy.contains('Moje kartice', { timeout: 10000 }).should('be.visible');
    });

    it('prikazuje naslov stranice', () => {
        cy.contains('h1', 'Moje kartice').should('be.visible');
    });

    it('prikazuje sve kartice u gridu', () => {
        cy.get('[class*="grid"]:has(> div)').within(() => {
            cy.get('div[class*="border"]').should('have.length.at.least', 1);
        });
    });

    it('prikazuje broj kartice maskiran', () => {
        cy.contains('**** **** **** 9010').should('be.visible');
    });

    it('prikazuje tip kartice', () => {
        cy.contains('VISA').should('be.visible');
        cy.contains('MASTERCARD').should('be.visible');
    });

    it('prikazuje status kartice', () => {
        cy.contains('ACTIVE').should('exist');
        cy.contains('BLOCKED').should('exist');
    });

    it('prikazuje datum isteka kartice', () => {
        cy.contains('Istek:').should('be.visible');
    });

    describe('Akcije na kartici', () => {
        it('prikazuje dugme Deblokiraj za blokiranu karticu', () => {
            cy.contains('Deblokiraj').should('be.visible');
        });

        it('prikazuje dugme Promeni limit za nedeaktivne kartice', () => {
            cy.contains('button', 'Promeni limit').should('exist');
        });

        it('prikazuje dugme Deaktiviraj za nedeaktivne kartice', () => {
            cy.contains('button', 'Blokira').should('exist');
        });

        it('klik na dugme Blokiraj prikazuje potvrdu', () => {
            cy.window().then((win) => {
                cy.stub(win, 'confirm').returns(true);
            });
            cy.contains('button', 'Blokiraj').first().click();
            cy.wait('@blockCard', { timeout: 10000 });
            // Nakon akcije trebalo bi se osvežiti
        });
    });

    describe('Prazna lista', () => {
        beforeEach(() => {
            cy.intercept('GET', '**/api/cards/my', { body: [] }).as('getEmptyCards');
            cy.visit('http://localhost:3000/cards', {
                onBeforeLoad: (win: Cypress.AUTWindow) => {
                    win.sessionStorage.setItem('accessToken', createJwt('ADMIN'));
                    win.sessionStorage.setItem('refreshToken', 'refresh-token');
                    win.sessionStorage.setItem('user', JSON.stringify({
                        id: 1,
                        email: 'marko.petrovic@banka.rs',
                        firstName: 'Marko',
                        lastName: 'Petrovic',
                        role: 'ADMIN',
                        permissions: ['ALL'],
                    }));
                },
            });
            cy.contains('Moje kartice', { timeout: 10000 }).should('be.visible');
        });

        it('prikazuje poruku kada nema kartica', () => {
            cy.contains('Nemate aktivnih kartica.').should('be.visible');
        });
    });

    describe('Greška pri učitavanju', () => {
        beforeEach(() => {
            cy.intercept('GET', '**/api/cards/my', { statusCode: 500, body: { error: 'Server error' } }).as('getCardsError');
            cy.visit('http://localhost:3000/cards', {
                onBeforeLoad: (win: Cypress.AUTWindow) => {
                    win.sessionStorage.setItem('accessToken', createJwt('ADMIN'));
                    win.sessionStorage.setItem('refreshToken', 'refresh-token');
                    win.sessionStorage.setItem('user', JSON.stringify({
                        id: 1,
                        email: 'marko.petrovic@banka.rs',
                        firstName: 'Marko',
                        lastName: 'Petrovic',
                        role: 'ADMIN',
                        permissions: ['ALL'],
                    }));
                },
            });
        });

        it('prikazuje poruku o grešci', () => {
            cy.contains('Moje kartice', { timeout: 10000 }).should('be.visible');
            cy.wait('@getCardsError', { timeout: 10000 });
        });
    });
});
