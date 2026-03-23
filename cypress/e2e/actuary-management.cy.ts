/// <reference types="cypress" />

describe('Actuary management page', () => {
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

    it('prikazuje link u sidebar-u i otvara stranicu aktuarima', () => {
        cy.intercept('GET', '**/actuaries/agents*', {
            statusCode: 200,
            body: [],
        }).as('agents');

        cy.visit('/home', {
            onBeforeLoad(win) {
                setAdminSession(win);
            },
        });

        cy.get('aside a[href="/employee/actuaries"]').should('be.visible').click();
        cy.location('pathname').should('eq', '/employee/actuaries');
        cy.wait('@agents');
        cy.contains('h1', 'Upravljanje aktuarima').should('be.visible');
    });

    it('prikazuje filter dugme Očisti filtere', () => {
        cy.intercept('GET', '**/actuaries/agents*', {
            statusCode: 200,
            body: [],
        }).as('agents');

        cy.visit('/employee/actuaries', {
            onBeforeLoad(win) {
                setAdminSession(win);
            },
        });

        cy.wait('@agents');
        cy.get('button[title="Filteri"]').click();
        cy.contains('button', /O?č?isti filtere/i).should('be.visible');
    });

    it('prikazuje ucitane agente kada backend vrati podatke', () => {
        cy.intercept('GET', '**/actuaries/agents*', {
            statusCode: 200,
            body: [
                {
                    id: 10,
                    employeeId: 10,
                    employeeName: 'Pera Peric',
                    employeeEmail: 'pera.peric@banka.rs',
                    actuaryType: 'AGENT',
                    dailyLimit: 100000,
                    usedLimit: 35000,
                    needApproval: true,
                },
            ],
        }).as('agents');

        cy.visit('/employee/actuaries', {
            onBeforeLoad(win) {
                setAdminSession(win);
            },
        });

        cy.wait('@agents');
        cy.contains('td', 'Pera').should('be.visible');
        cy.contains('td', 'Peric').should('be.visible');
        cy.contains('td', 'pera.peric@banka.rs').should('be.visible');
    });

    it('prikazuje poruku o gresci kada ucitavanje agenata padne', () => {
        cy.intercept('GET', '**/actuaries/agents*', {
            statusCode: 500,
            body: { message: 'Internal error' },
        }).as('agentsFail');

        cy.visit('/employee/actuaries', {
            onBeforeLoad(win) {
                setAdminSession(win);
            },
        });

        cy.wait('@agentsFail');
        cy.contains('Greska pri ucitavanju aktuarnih podataka. Pokusajte ponovo.').should('be.visible');
    });
});

describe('Landing backend status', () => {
    it('prikazuje Server aktivan kada je backend dostupan', () => {
        cy.intercept('GET', '**/v3/api-docs', {
            statusCode: 200,
            body: {},
        }).as('apiDocs');

        cy.visit('/');
        cy.wait('@apiDocs');
        cy.contains('Server aktivan').should('be.visible');
    });
});
