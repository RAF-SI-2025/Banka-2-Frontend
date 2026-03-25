/// <reference types="cypress" />
describe('Transfer Page', () => {
  const userEmail = 'marko.petrovic@banka.rs';
  const userPassword = 'Admin12345';

  const accountRsd1 = {
    id: 1,
    accountNumber: '160123456789012345',
    ownerName: 'Marko Petrovic',
    accountType: 'TEKUCI',
    currency: 'RSD',
    balance: 150000,
    availableBalance: 120000,
    reservedBalance: 30000,
    dailyLimit: 300000,
    monthlyLimit: 1000000,
    dailySpending: 0,
    monthlySpending: 0,
    maintenanceFee: 0,
    status: 'ACTIVE',
    createdAt: '2025-01-01T10:00:00Z',
    name: 'Glavni tekući',
  };

  const accountRsd2 = {
    id: 2,
    accountNumber: '205987654321000011',
    ownerName: 'Marko Petrovic',
    accountType: 'TEKUCI',
    currency: 'RSD',
    balance: 50000,
    availableBalance: 50000,
    reservedBalance: 0,
    dailyLimit: 300000,
    monthlyLimit: 1000000,
    dailySpending: 0,
    monthlySpending: 0,
    maintenanceFee: 0,
    status: 'ACTIVE',
    createdAt: '2025-01-01T10:00:00Z',
    name: 'Štedni RSD',
  };

  const accountEur = {
    id: 3,
    accountNumber: '340555666777888900',
    ownerName: 'Marko Petrovic',
    accountType: 'DEVIZNI',
    currency: 'EUR',
    balance: 1000,
    availableBalance: 1000,
    reservedBalance: 0,
    dailyLimit: 5000,
    monthlyLimit: 20000,
    dailySpending: 0,
    monthlySpending: 0,
    maintenanceFee: 0,
    status: 'ACTIVE',
    createdAt: '2025-01-01T10:00:00Z',
    name: 'Devizni EUR',
  };

  const allAccounts = [accountRsd1, accountRsd2, accountEur];

  const loginViaUi = () => {
    cy.session([userEmail, userPassword], () => {
      cy.visit('/login');

      cy.get('#email').should('be.visible').clear().type(userEmail);
      cy.get('#password')
        .should('be.visible')
        .clear()
        .type(userPassword, { log: false });

      cy.contains('button', 'Prijavi se').click();
      cy.url().should('include', '/home');
    });
  };

  const mockMyAccounts = (body = allAccounts) => {
    cy.intercept(
      {
        method: 'GET',
        pathname: '/api/accounts/my',
      },
      {
        statusCode: 200,
        body,
      }
    ).as('getMyAccounts');
  };

  const mockExchangeRate = (middleRate = 117.25) => {
    cy.intercept(
      {
        method: 'GET',
        pathname: '/exchange-rates/RSD/EUR',
      },
      {
        statusCode: 200,
        body: {
          currency: 'EUR',
          buyRate: middleRate - 0.5,
          sellRate: middleRate + 0.5,
          middleRate,
          date: '2026-03-14',
        },
      }
    ).as('getRateRsdEur');
  };

  const mockCreateTransfer = () => {
    cy.intercept(
      {
        method: 'POST',
        pathname: '/api/payments/transfer',
      },
      (req) => {
        req.reply({
          statusCode: 200,
          body: {
            id: 987,
            fromAccountNumber: req.body.fromAccountNumber,
            toAccountNumber: req.body.toAccountNumber,
            amount: req.body.amount,
            fromCurrency: 'RSD',
            toCurrency: 'RSD',
            status: 'PENDING',
            createdAt: '2026-03-14T12:00:00Z',
          },
        });
      }
    ).as('createTransfer');
  };

  const mockVerifySuccess = () => {
    cy.intercept(
      {
        method: 'POST',
        pathname: '/api/payments/payment/verify',
      },
      {
        statusCode: 200,
        body: {
          success: true,
        },
      }
    ).as('verifyPayment');
  };

  const mockVerifyError = () => {
    cy.intercept(
      {
        method: 'POST',
        pathname: '/api/payments/payment/verify',
      },
      {
        statusCode: 400,
        body: {
          message: 'Kod nije validan. Pokušajte ponovo.',
        },
      }
    ).as('verifyPaymentError');
  };

  const visitTransferPage = (query = '') => {
    cy.visit('/home');

    cy.window().then((win) => {
      win.history.pushState({}, '', `/transfers${query}`);
      win.dispatchEvent(new win.PopStateEvent('popstate'));
    });
  };

  const fillValidSameCurrencyTransfer = () => {
    cy.get('#fromAccount').select(accountRsd1.accountNumber);
    cy.get('#toAccount').select(accountRsd2.accountNumber);
    cy.get('#amount').clear().type('500');
  };

  const assertVerificationModalVisible = () => {
    cy.contains('Verifikacija transakcije').should('be.visible');
    cy.contains('Unesite kod sa mobilne potvrde.').should('be.visible');
    cy.get('#otp').should('be.visible');
    cy.contains('Kod važi još:').should('be.visible');
    cy.contains('Preostalo pokušaja:').should('be.visible');
    cy.contains('button', 'Otkaži').should('be.visible');
    cy.contains('button', 'Potvrdi').should('be.visible');
  };

  beforeEach(() => {
    mockMyAccounts();
    mockCreateTransfer();
    loginViaUi();
  });

  it('renders page and loads available accounts', () => {
    visitTransferPage();

    cy.wait('@getMyAccounts');

    cy.contains('h1', 'Prenos između računa').should('be.visible');
    cy.contains('Novi prenos').should('be.visible');

    cy.get('#fromAccount').should('exist');
    cy.get('#toAccount').should('exist');
    cy.get('#amount').should('exist');
    cy.contains('button', 'Nastavi na verifikaciju').should('be.visible');

    cy.get('#fromAccount').should('have.value', accountRsd1.accountNumber);

    cy.contains(
      `Raspoloživo stanje: ${Number(accountRsd1.availableBalance).toFixed(2)} ${accountRsd1.currency}`
    ).should('be.visible');
  });

  it('shows loading state while accounts are loading', () => {
    cy.intercept(
      {
        method: 'GET',
        pathname: '/api/accounts/my',
      },
      {
        delay: 1200,
        statusCode: 200,
        body: allAccounts,
      }
    ).as('getMyAccountsDelayed');

    visitTransferPage();

    cy.contains('Učitavanje računa...', { timeout: 3000 }).should('be.visible');
    cy.wait('@getMyAccountsDelayed');
    cy.contains('Učitavanje računa...').should('not.exist');
  });

  it('shows empty state when there are no available accounts', () => {
    cy.intercept(
      {
        method: 'GET',
        pathname: '/api/accounts/my',
      },
      {
        statusCode: 200,
        body: [],
      }
    ).as('getMyAccountsEmpty');

    visitTransferPage();

    cy.wait('@getMyAccountsEmpty');
    cy.contains('Nemate dostupnih računa za prenos.').should('be.visible');
    cy.get('form').should('not.exist');
  });

  it('handles account loading error gracefully', () => {
    cy.intercept(
      {
        method: 'GET',
        pathname: '/api/accounts/my',
      },
      {
        statusCode: 500,
        body: { message: 'Neuspešno učitavanje računa.' },
      }
    ).as('getMyAccountsError');

    visitTransferPage();

    cy.wait('@getMyAccountsError');
    cy.contains('Nemate dostupnih računa za prenos.').should('be.visible');
  });

  it('uses preselected sender account from query parameter when valid', () => {
    visitTransferPage(`?from=${accountRsd2.accountNumber}`);

    cy.wait('@getMyAccounts');

    cy.get('#fromAccount').should('have.value', accountRsd2.accountNumber);
    cy.contains(
      `Raspoloživo stanje: ${Number(accountRsd2.availableBalance).toFixed(2)} ${accountRsd2.currency}`
    ).should('be.visible');
  });

  it('falls back to first account when query preselected sender is invalid', () => {
    visitTransferPage('?from=999999999999999999');

    cy.wait('@getMyAccounts');

    cy.get('#fromAccount').should('have.value', accountRsd1.accountNumber);
  });

  it('shows only other accounts as recipient options', () => {
    visitTransferPage();

    cy.wait('@getMyAccounts');

    cy.get('#fromAccount').should('have.value', accountRsd1.accountNumber);

    cy.get('#toAccount')
      .find('option')
      .then(($options) => {
        const values = [...$options].map((opt) => (opt as HTMLOptionElement).value);

        expect(values).to.not.include(accountRsd1.accountNumber);
        expect(values).to.include(accountRsd2.accountNumber);
        expect(values).to.include(accountEur.accountNumber);
      });
  });

  it('updates sender balance info when sender account changes', () => {
    visitTransferPage();

    cy.wait('@getMyAccounts');

    cy.get('#fromAccount').select(accountEur.accountNumber);

    cy.contains(
      `Raspoloživo stanje: ${Number(accountEur.availableBalance).toFixed(2)} ${accountEur.currency}`
    ).should('be.visible');
  });

  it('resets recipient account when it becomes equal to sender account', () => {
    visitTransferPage();

    cy.wait('@getMyAccounts');

    cy.get('#toAccount').select(accountRsd2.accountNumber);
    cy.get('#toAccount').should('have.value', accountRsd2.accountNumber);

    cy.get('#fromAccount').select(accountRsd2.accountNumber);

    cy.get('#toAccount').should('have.value', '');
  });

  it('shows validation errors when submitting with incomplete form', () => {
    visitTransferPage();

    cy.wait('@getMyAccounts');

    cy.get('#amount').clear();
    cy.contains('button', 'Nastavi na verifikaciju').click();

    cy.get('.text-destructive').should('have.length.at.least', 1);
    cy.get('@createTransfer.all').should('have.length', 0);
  });

  it('shows insufficient funds warning when amount exceeds available balance', () => {
    visitTransferPage();

    cy.wait('@getMyAccounts');

    cy.get('#toAccount').select(accountRsd2.accountNumber);
    cy.get('#amount').clear().type('200000');

    cy.contains('Nemate dovoljno raspoloživih sredstava na računu pošiljaoca.').should(
      'be.visible'
    );
  });

  it('does not submit transfer when funds are insufficient', () => {
    visitTransferPage();

    cy.wait('@getMyAccounts');

    cy.get('#toAccount').select(accountRsd2.accountNumber);
    cy.get('#amount').clear().type('200000');

    cy.contains('button', 'Nastavi na verifikaciju').click();

    cy.get('@createTransfer.all').should('have.length', 0);
  });

  it('shows preview without conversion for same-currency transfer', () => {
    visitTransferPage();

    cy.wait('@getMyAccounts');

    cy.get('#toAccount').select(accountRsd2.accountNumber);
    cy.get('#amount').clear().type('1500');

    cy.contains('Prenos bez konverzije: 1500.00 RSD').should('be.visible');
  });

  it('shows exchange preview for transfer between different currencies', () => {
    mockExchangeRate(117.25);

    visitTransferPage();

    cy.wait('@getMyAccounts');

    cy.get('#toAccount').select(accountEur.accountNumber);
    cy.get('#amount').clear().type('100');

    cy.wait('@getRateRsdEur');

    cy.contains('Kurs: 1 RSD = 117.2500 EUR').should('be.visible');
    cy.contains('Konvertovani iznos: 11725.00 EUR').should('be.visible');
  });

  it('hides exchange preview when exchange rate request fails', () => {
    cy.intercept(
      {
        method: 'GET',
        pathname: '/exchange-rates/RSD/EUR',
      },
      {
        statusCode: 500,
        body: { message: 'Rate failed' },
      }
    ).as('getRateError');

    visitTransferPage();

    cy.wait('@getMyAccounts');

    cy.get('#toAccount').select(accountEur.accountNumber);
    cy.get('#amount').clear().type('100');

    cy.wait('@getRateError');

    cy.contains('Kurs:').should('not.exist');
    cy.contains('Konvertovani iznos:').should('not.exist');
  });

  it('does not request exchange rate when currencies are the same', () => {
    mockExchangeRate(117.25);

    visitTransferPage();

    cy.wait('@getMyAccounts');

    cy.get('#toAccount').select(accountRsd2.accountNumber);
    cy.get('#amount').clear().type('1000');

    cy.get('@getRateRsdEur.all').should('have.length', 0);
    cy.contains('Prenos bez konverzije: 1000.00 RSD').should('be.visible');
  });

  it('does not request exchange rate when amount is zero', () => {
    mockExchangeRate(117.25);

    visitTransferPage();

    cy.wait('@getMyAccounts');

    cy.get('#toAccount').select(accountEur.accountNumber);
    cy.get('#amount').clear().type('0');

    cy.get('@getRateRsdEur.all').should('have.length', 0);
    cy.contains('Kurs:').should('not.exist');
    cy.contains('Konvertovani iznos:').should('not.exist');
  });

  it('creates transfer successfully with integer amount', () => {
    visitTransferPage();

    cy.wait('@getMyAccounts');

    cy.get('#fromAccount').select(accountRsd1.accountNumber);
    cy.get('#toAccount').select(accountRsd2.accountNumber);
    cy.get('#amount').clear().type('2500');

    cy.contains('button', 'Nastavi na verifikaciju').click();

    cy.wait('@createTransfer')
      .its('request.body')
      .should('deep.equal', {
        fromAccountNumber: accountRsd1.accountNumber,
        toAccountNumber: accountRsd2.accountNumber,
        amount: 2500,
      });
  });

  it('creates transfer successfully with decimal amount', () => {
    visitTransferPage();

    cy.wait('@getMyAccounts');

    cy.get('#fromAccount').select(accountRsd1.accountNumber);
    cy.get('#toAccount').select(accountRsd2.accountNumber);
    cy.get('#amount').clear().type('1234.56');

    cy.contains('button', 'Nastavi na verifikaciju').click();

    cy.wait('@createTransfer')
      .its('request.body')
      .should('deep.equal', {
        fromAccountNumber: accountRsd1.accountNumber,
        toAccountNumber: accountRsd2.accountNumber,
        amount: 1234.56,
      });
  });

  it('opens verification modal after successful transfer creation', () => {
    visitTransferPage();

    cy.wait('@getMyAccounts');

    fillValidSameCurrencyTransfer();

    cy.contains('button', 'Nastavi na verifikaciju').click();

    cy.wait('@createTransfer');
    assertVerificationModalVisible();
  });

  it('closes verification modal when user cancels it', () => {
    visitTransferPage();

    cy.wait('@getMyAccounts');

    fillValidSameCurrencyTransfer();

    cy.contains('button', 'Nastavi na verifikaciju').click();

    cy.wait('@createTransfer');
    assertVerificationModalVisible();

    cy.contains('button', 'Otkaži').click();

    cy.contains('Verifikacija transakcije').should('not.exist');
    cy.get('#otp').should('not.exist');
  });

  it('verifies transfer successfully through verification modal', () => {
    mockVerifySuccess();

    visitTransferPage();

    cy.wait('@getMyAccounts');

    fillValidSameCurrencyTransfer();

    cy.contains('button', 'Nastavi na verifikaciju').click();

    cy.wait('@createTransfer');
    assertVerificationModalVisible();

    cy.get('#otp').clear().type('123456');
    cy.contains('button', 'Potvrdi').click();

    cy.wait('@verifyPayment')
      .its('request.body')
      .should('deep.equal', {
        transactionId: 987,
        code: '123456',
      });
  });

  it('shows verification error when OTP code is invalid', () => {
    mockVerifyError();

    visitTransferPage();

    cy.wait('@getMyAccounts');

    fillValidSameCurrencyTransfer();

    cy.contains('button', 'Nastavi na verifikaciju').click();

    cy.wait('@createTransfer');
    assertVerificationModalVisible();

    cy.get('#otp').clear().type('111111');
    cy.contains('button', 'Potvrdi').click();

    cy.wait('@verifyPaymentError');
    cy.contains('Kod nije validan. Pokušajte ponovo.').should('be.visible');
    cy.contains('Preostalo pokušaja:').should('be.visible');
  });

  it('disables form controls while transfer request is in progress', () => {
    cy.intercept(
      {
        method: 'POST',
        pathname: '/api/payments/transfer',
      },
      {
        delay: 1200,
        statusCode: 200,
        body: {
          id: 987,
          fromAccountNumber: accountRsd1.accountNumber,
          toAccountNumber: accountRsd2.accountNumber,
          amount: 500,
          fromCurrency: 'RSD',
          toCurrency: 'RSD',
          status: 'PENDING',
          createdAt: '2026-03-14T12:00:00Z',
        },
      }
    ).as('createTransferDelayed');

    visitTransferPage();

    cy.wait('@getMyAccounts');

    cy.get('#toAccount').select(accountRsd2.accountNumber);
    cy.get('#amount').clear().type('500');

    cy.contains('button', 'Nastavi na verifikaciju').click();

    cy.contains('button', 'Kreiranje...').should('be.visible');
    cy.get('#fromAccount').should('be.disabled');
    cy.get('#toAccount').should('be.disabled');
    cy.get('#amount').should('be.disabled');

    cy.wait('@createTransferDelayed');
  });

  it('handles transfer creation error gracefully with backend message', () => {
    cy.intercept(
      {
        method: 'POST',
        pathname: '/api/payments/transfer',
      },
      {
        statusCode: 400,
        body: { message: 'Prenos nije dozvoljen za izabrane račune' },
      }
    ).as('createTransferError');

    visitTransferPage();

    cy.wait('@getMyAccounts');

    cy.get('#toAccount').select(accountRsd2.accountNumber);
    cy.get('#amount').clear().type('500');

    cy.contains('button', 'Nastavi na verifikaciju').click();

    cy.wait('@createTransferError');
  });

  it('keeps submit button enabled in normal ready state', () => {
    visitTransferPage();

    cy.wait('@getMyAccounts');

    cy.contains('button', 'Nastavi na verifikaciju').should('not.be.disabled');
  });
});