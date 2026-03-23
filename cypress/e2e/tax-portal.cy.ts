/// <reference types="cypress" />

describe('Tax portal page', () => {
    const setAdminSession = (win: Window) => {
        win.sessionStorage.setItem('accessToken', 'fake-access-token');
        win.sessionStorage.setItem('refreshToken', 'fake-refresh-token');
        win.sessionStorage.setItem(
            'user',
            JSON.stringify({
                id: 1,
                email: 'admin@test.com',
                username: 'admin',
                firstName: 'Admin',
                lastName: 'User',
                role: 'ADMIN',
                permissions: ['ADMIN'],
            })
        );
    };

    it('prikazuje portal sa tabelom i kolonama', () => {
        cy.intercept('GET', '**/exchange-rates', {
            statusCode: 200,
            body: [
                { currency: 'RSD', buyRate: 1, sellRate: 1, middleRate: 1, date: '2026-03-23' },
            ],
        }).as('rates');

        cy.intercept('GET', '**/tax*', {
            statusCode: 200,
            body: [
                {
                    userId: 11,
                    userName: 'Marko Markovic',
                    userType: 'CLIENT',
                    totalProfit: 120000,
                    taxOwed: 18000,
                    taxPaid: 10000,
                    currency: 'RSD',
                },
            ],
        }).as('tax');

        cy.visit('/employee/tax', {
            onBeforeLoad(win) {
                setAdminSession(win);
            },
        });

        cy.wait('@rates');
        cy.wait('@tax');
        cy.contains('h1', 'Porez tracking').should('be.visible');
        cy.contains('th', 'Ime').should('be.visible');
        cy.contains('th', 'Tip').should('be.visible');
        cy.contains('th', 'Ukupan profit').should('be.visible');
        cy.contains('th', 'Porez').should('be.visible');
        cy.contains('th', 'Placeno').should('be.visible');
        cy.contains('th', 'Dugovanje (RSD)').should('be.visible');
    });

    it('racuna dugovanje u RSD kada je valuta razlicita', () => {
        cy.intercept('GET', '**/exchange-rates', {
            statusCode: 200,
            body: [
                { currency: 'RSD', buyRate: 1, sellRate: 1, middleRate: 1, date: '2026-03-23' },
                { currency: 'EUR', buyRate: 117, sellRate: 118, middleRate: 117.5, date: '2026-03-23' },
            ],
        }).as('rates');

        cy.intercept('GET', '**/tax*', {
            statusCode: 200,
            body: [
                {
                    userId: 22,
                    userName: 'Pera Peric',
                    userType: 'EMPLOYEE',
                    totalProfit: 1000,
                    taxOwed: 120,
                    taxPaid: 20,
                    currency: 'EUR',
                },
            ],
        }).as('tax');

        cy.visit('/employee/tax', {
            onBeforeLoad(win) {
                setAdminSession(win);
            },
        });

        cy.wait('@rates');
        cy.wait('@tax');

        // (120 - 20) * 117.5 = 11750.00
        cy.contains('td', '11.750,00 RSD').should('be.visible');
    });

    it('filtrira po tipu korisnika i po imenu', () => {
        cy.intercept('GET', '**/exchange-rates', {
            statusCode: 200,
            body: [
                { currency: 'RSD', buyRate: 1, sellRate: 1, middleRate: 1, date: '2026-03-23' },
            ],
        }).as('rates');

        cy.intercept('GET', '**/tax*', (req) => {
            const userType = String(req.query.userType ?? '');
            const name = String(req.query.name ?? '');

            if (userType === 'CLIENT' && name === 'ana') {
                req.reply({
                    statusCode: 200,
                    body: [
                        {
                            userId: 33,
                            userName: 'Ana Anic',
                            userType: 'CLIENT',
                            totalProfit: 50000,
                            taxOwed: 7500,
                            taxPaid: 2000,
                            currency: 'RSD',
                        },
                    ],
                });
                return;
            }

            req.reply({ statusCode: 200, body: [] });
        }).as('tax');

        cy.visit('/employee/tax', {
            onBeforeLoad(win) {
                setAdminSession(win);
            },
        });

        cy.wait('@rates');
        cy.wait('@tax');

        cy.contains('button', 'Klijenti').click();
        cy.get('input[placeholder="Pretraga po imenu"]').type('ana');

        // wait for debounce-triggered request
        cy.wait('@tax').its('request.url').should('include', 'userType=CLIENT');
        cy.wait('@tax').its('request.url').should('include', 'name=ana');
        cy.contains('td', 'Ana Anic').should('be.visible');
    });

    it('pokrece obracun nakon potvrde', () => {
        cy.intercept('GET', '**/exchange-rates', {
            statusCode: 200,
            body: [
                { currency: 'RSD', buyRate: 1, sellRate: 1, middleRate: 1, date: '2026-03-23' },
            ],
        }).as('rates');

        cy.intercept('GET', '**/tax*', {
            statusCode: 200,
            body: [],
        }).as('tax');

        cy.intercept('POST', '**/tax/calculate', {
            statusCode: 200,
            body: {},
        }).as('calculate');

        cy.visit('/employee/tax', {
            onBeforeLoad(win) {
                setAdminSession(win);
            },
        });

        cy.wait('@rates');
        cy.wait('@tax');

        cy.on('window:confirm', () => true);
        cy.contains('button', 'Pokreni obracun').click();
        cy.wait('@calculate');
        cy.contains('Obracun poreza je uspesno pokrenut.').should('be.visible');
    });

    it('prikazuje link u sidebar-u ka porez portalu', () => {
        cy.intercept('GET', '**/exchange-rates', {
            statusCode: 200,
            body: [
                { currency: 'RSD', buyRate: 1, sellRate: 1, middleRate: 1, date: '2026-03-23' },
            ],
        }).as('rates');

        cy.intercept('GET', '**/tax*', {
            statusCode: 200,
            body: [],
        }).as('tax');

        cy.visit('/home', {
            onBeforeLoad(win) {
                setAdminSession(win);
            },
        });

        cy.get('aside a[href="/employee/tax"]').should('be.visible').click();
        cy.location('pathname').should('eq', '/employee/tax');
        cy.wait('@rates');
        cy.wait('@tax');
    });
});
