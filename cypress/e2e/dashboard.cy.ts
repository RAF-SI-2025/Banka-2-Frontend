/// <reference types="cypress" />

describe('Dashboard - Prikaz kartice i statistike', () => {
    describe('Admin korisnik', () => {
        beforeEach(() => {
            cy.visit('/dashboard', {
                onBeforeLoad(win) {
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
                            permissions: ['ADMIN'],
                        })
                    );
                },
            });

            // Čekaj da se stranica učita
            cy.contains('Dobrodošli, Admin!', { timeout: 10000 }).should('be.visible');
        });

        it('prikazuje welcome sekciju sa imenom korisnika', () => {
            cy.contains('h1', 'Dobrodošli, Admin!').should('be.visible');
            cy.contains('p', 'Banka 2025 — Interni portal').should('be.visible');
        });

        it('prikazuje statistiku zaposlenih', () => {
            // Proveravam da sve tri statisticke kartice postoje
            cy.contains('Ukupno zaposlenih').should('be.visible');
            cy.contains('Aktivnih zaposlenih').should('be.visible');
            cy.contains('Neaktivnih zaposlenih').should('be.visible');
        });

        it('prikazuje admin akcije kartice', () => {
            cy.get('[data-testid="dashboard-card-lista-zaposlenih"]').should('be.visible');
            cy.get('[data-testid="dashboard-card-novi-zaposleni"]').should('be.visible');
        });

        it('prikazuje brze akcije naslov', () => {
            cy.contains('Brze akcije').should('be.visible');
        });

        it('preusmera na stranicu zaposlenih pri kliku', () => {
            cy.get('[data-testid="dashboard-card-lista-zaposlenih"]').click();
            cy.url().should('include', '/admin/employees');
        });

        it('preusmera na stranicu kreiranja pri kliku', () => {
            cy.get('[data-testid="dashboard-card-novi-zaposleni"]').click();
            cy.url().should('include', '/admin/employees/new');
        });
    });

    describe('Obični korisnik', () => {
        beforeEach(() => {
            cy.visit('/dashboard', {
                onBeforeLoad(win) {
                    win.sessionStorage.setItem('accessToken', 'fake-access-token');
                    win.sessionStorage.setItem('refreshToken', 'fake-refresh-token');
                    win.sessionStorage.setItem(
                        'user',
                        JSON.stringify({
                            id: 2,
                            email: 'user@test.com',
                            username: 'user',
                            firstName: 'John',
                            lastName: 'Doe',
                            permissions: ['USER'],
                        })
                    );
                },
            });

            cy.contains('Dobrodošli, John!', { timeout: 10000 }).should('be.visible');
        });

        it('prikazuje welcome sekciju sa imenima korisnika', () => {
            cy.contains('h1', 'Dobrodošli, John!').should('be.visible');
        });

        it('prikazuje statistiku zaposlenih', () => {
            cy.contains('Ukupno zaposlenih').should('be.visible');
            cy.contains('Aktivnih zaposlenih').should('be.visible');
            cy.contains('Neaktivnih zaposlenih').should('be.visible');
        });

        it('ne prikazuje admin kartice', () => {
            cy.get('[data-testid="dashboard-card-lista-zaposlenih"]').should('not.exist');
            cy.get('[data-testid="dashboard-card-novi-zaposleni"]').should('not.exist');
        });
    });
});
