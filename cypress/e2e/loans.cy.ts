/// <reference types="cypress" />
// Celina 7: Krediti — Scenariji 33-36 iz Celina2Testovi.pdf
// Testira: podnošenje zahteva, pregled kredita, odobravanje, odbijanje

describe('Krediti - Celina 7', () => {
  const API = 'http://localhost:8080';

  // Helper: login via API and set token
  const loginAs = (email: string, password: string) => {
    return cy.request('POST', `${API}/auth/login`, { email, password }).then((res) => {
      expect(res.status).to.eq(200);
      return res.body.accessToken;
    });
  };

  describe('Scenario 33: Podnošenje zahteva za kredit', () => {
    it('klijent uspešno podnosi zahtev za kredit', () => {
      loginAs('stefan.jovanovic@gmail.com', 'Klijent12345').then((token) => {
        // Get first account
        cy.request({
          method: 'GET',
          url: `${API}/accounts/my`,
          headers: { Authorization: `Bearer ${token}` },
        }).then((accountsRes) => {
          const firstAccount = accountsRes.body[0];
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          expect(firstAccount).to.exist;

          // Submit loan request
          cy.request({
            method: 'POST',
            url: `${API}/loans`,
            headers: { Authorization: `Bearer ${token}` },
            body: {
              loanType: 'CASH',
              interestType: 'FIXED',
              amount: 100000,
              currency: firstAccount.currency || firstAccount.currencyCode,
              loanPurpose: 'Renoviranje stana',
              repaymentPeriod: 24,
              accountNumber: firstAccount.accountNumber,
              phoneNumber: '+381601234567',
              employmentStatus: 'stalno',
              monthlyIncome: 80000,
            },
          }).then((loanRes) => {
            expect(loanRes.status).to.eq(201);
            expect(loanRes.body.status).to.eq('PENDING');
            expect(loanRes.body.loanType).to.eq('CASH');
            expect(loanRes.body.amount).to.eq(100000);
          });
        });
      });
    });

    it('odbija zahtev za nepostojećeg klijenta', () => {
      loginAs('marko.petrovic@banka.rs', 'Admin12345').then((token) => {
        cy.request({
          method: 'POST',
          url: `${API}/loans`,
          headers: { Authorization: `Bearer ${token}` },
          body: {
            loanType: 'CASH',
            interestType: 'FIXED',
            amount: 50000,
            currency: 'RSD',
            repaymentPeriod: 12,
            accountNumber: '222000112345678911',
          },
          failOnStatusCode: false,
        }).then((res) => {
          expect(res.status).to.be.oneOf([400, 403]);
        });
      });
    });
  });

  describe('Scenario 34: Pregled kredita klijenta', () => {
    it('klijent vidi listu svojih kredita', () => {
      loginAs('stefan.jovanovic@gmail.com', 'Klijent12345').then((token) => {
        cy.request({
          method: 'GET',
          url: `${API}/loans/my`,
          headers: { Authorization: `Bearer ${token}` },
        }).then((res) => {
          expect(res.status).to.eq(200);
          // May be empty if no loans approved yet, but should not error
          expect(res.body).to.have.property('content');
        });
      });
    });
  });

  describe('Scenario 35: Odobravanje kredita od strane zaposlenog', () => {
    it('admin odobrava zahtev za kredit i novac se uplaćuje na račun', () => {
      // First create a loan request as client
      loginAs('stefan.jovanovic@gmail.com', 'Klijent12345').then((clientToken) => {
        cy.request({
          method: 'GET',
          url: `${API}/accounts/my`,
          headers: { Authorization: `Bearer ${clientToken}` },
        }).then((accountsRes) => {
          const account = accountsRes.body[0];
          const balanceBefore = account.balance;

          cy.request({
            method: 'POST',
            url: `${API}/loans`,
            headers: { Authorization: `Bearer ${clientToken}` },
            body: {
              loanType: 'STUDENT',
              interestType: 'FIXED',
              amount: 50000,
              currency: account.currency || account.currencyCode,
              loanPurpose: 'Studije',
              repaymentPeriod: 12,
              accountNumber: account.accountNumber,
              phoneNumber: '+381601234567',
            },
          }).then((loanReqRes) => {
            expect(loanReqRes.status).to.eq(201);
            const requestId = loanReqRes.body.id;

            // Now approve as admin
            loginAs('marko.petrovic@banka.rs', 'Admin12345').then((adminToken) => {
              cy.request({
                method: 'PATCH',
                url: `${API}/loans/requests/${requestId}/approve`,
                headers: { Authorization: `Bearer ${adminToken}` },
              }).then((approveRes) => {
                expect(approveRes.status).to.eq(200);
                expect(approveRes.body.status).to.eq('ACTIVE');
                expect(approveRes.body.loanNumber).to.match(/^LN-/);
                expect(approveRes.body.monthlyPayment).to.be.greaterThan(0);

                // Verify installments created
                cy.request({
                  method: 'GET',
                  url: `${API}/loans/${approveRes.body.id}/installments`,
                  headers: { Authorization: `Bearer ${clientToken}` },
                }).then((installRes) => {
                  expect(installRes.status).to.eq(200);
                  expect(installRes.body).to.have.length(12);
                });

                // Verify account balance increased
                cy.request({
                  method: 'GET',
                  url: `${API}/accounts/my`,
                  headers: { Authorization: `Bearer ${clientToken}` },
                }).then((newAccountsRes) => {
                  const updatedAccount = newAccountsRes.body.find(
                    (a: { accountNumber: string }) => a.accountNumber === account.accountNumber
                  );
                  expect(updatedAccount.balance).to.be.greaterThan(balanceBefore);
                });
              });
            });
          });
        });
      });
    });
  });

  describe('Scenario 36: Odbijanje zahteva za kredit', () => {
    it('admin odbija zahtev za kredit', () => {
      loginAs('stefan.jovanovic@gmail.com', 'Klijent12345').then((clientToken) => {
        cy.request({
          method: 'GET',
          url: `${API}/accounts/my`,
          headers: { Authorization: `Bearer ${clientToken}` },
        }).then((accountsRes) => {
          const account = accountsRes.body[0];

          cy.request({
            method: 'POST',
            url: `${API}/loans`,
            headers: { Authorization: `Bearer ${clientToken}` },
            body: {
              loanType: 'AUTO',
              interestType: 'VARIABLE',
              amount: 200000,
              currency: account.currency || account.currencyCode,
              loanPurpose: 'Kupovina auta',
              repaymentPeriod: 48,
              accountNumber: account.accountNumber,
              phoneNumber: '+381601234567',
            },
          }).then((loanReqRes) => {
            expect(loanReqRes.status).to.eq(201);
            const requestId = loanReqRes.body.id;

            loginAs('marko.petrovic@banka.rs', 'Admin12345').then((adminToken) => {
              cy.request({
                method: 'PATCH',
                url: `${API}/loans/requests/${requestId}/reject`,
                headers: { Authorization: `Bearer ${adminToken}` },
              }).then((rejectRes) => {
                expect(rejectRes.status).to.eq(200);
                expect(rejectRes.body.status).to.eq('REJECTED');
              });
            });
          });
        });
      });
    });
  });

  describe('Scenario 39-40: Portal za klijente (zaposleni)', () => {
    it('admin pretražuje i menja podatke klijenta', () => {
      loginAs('marko.petrovic@banka.rs', 'Admin12345').then((adminToken) => {
        // List clients
        cy.request({
          method: 'GET',
          url: `${API}/clients?page=0&limit=10`,
          headers: { Authorization: `Bearer ${adminToken}` },
        }).then((listRes) => {
          expect(listRes.status).to.eq(200);
          const clients = listRes.body.content || listRes.body;
          expect(clients.length).to.be.greaterThan(0);

          const clientId = clients[0].id;

          // Update client
          cy.request({
            method: 'PUT',
            url: `${API}/clients/${clientId}`,
            headers: { Authorization: `Bearer ${adminToken}` },
            body: {
              phone: '+381649998877',
              address: 'Nova adresa za test',
            },
          }).then((updateRes) => {
            expect(updateRes.status).to.eq(200);
          });
        });
      });
    });

    it('klijent ne može pristupiti portalu za klijente', () => {
      loginAs('stefan.jovanovic@gmail.com', 'Klijent12345').then((clientToken) => {
        cy.request({
          method: 'GET',
          url: `${API}/clients`,
          headers: { Authorization: `Bearer ${clientToken}` },
          failOnStatusCode: false,
        }).then((res) => {
          expect(res.status).to.eq(403);
        });
      });
    });
  });
});
