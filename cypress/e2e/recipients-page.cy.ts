/// <reference types="cypress" />
function _b64url(s) { return btoa(s).split('=').join('').split('+').join('-').split('/').join('_'); }
function _fakeJwt(role, email) {
  return _b64url(JSON.stringify({alg:'HS256',typ:'JWT'})) + '.' +
    _b64url(JSON.stringify({sub:email,role:role,active:true,exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000)})) +
    '.fakesig';
}

describe('Recipients Page', () => {
  const _adminEmail = 'marko.petrovic@banka.rs';
  const _adminPassword = 'Admin12345';

  const recipient1 = {
    id: 1,
    name: 'Elektroprivreda Srbije',
    accountNumber: '160123456789012345',
    address: 'Bulevar umetnosti 12, Beograd',
    phoneNumber: '0111234567',
  };

  const recipient2 = {
    id: 2,
    name: 'Telekom Srbija',
    accountNumber: '205987654321000011',
    address: 'Takovska 2, Beograd',
    phoneNumber: '011222333',
  };

  const recipient3 = {
    id: 3,
    name: 'Streaming Servis',
    accountNumber: '340555666777888900',
    address: '',
    phoneNumber: '',
  };

  const recipientsInitial = [recipient1, recipient2, recipient3];

  const setAdminSession = (win: Window) => {
    win.sessionStorage.setItem('accessToken', _fakeJwt('ADMIN', 'marko.petrovic@banka.rs'));
    win.sessionStorage.setItem('refreshToken', 'fake-refresh-token');
    win.sessionStorage.setItem('user', JSON.stringify({ id: 1, email: 'marko.petrovic@banka.rs', role: 'ADMIN', firstName: 'Marko', lastName: 'Petrovic' }));
  };

  const mockRecipientsList = (body = recipientsInitial) => {
    cy.intercept(
      {
        method: 'GET',
        pathname: '/api/payment-recipients',
      },
      {
        statusCode: 200,
        body,
      }
    ).as('getRecipients');
  };

  const mockCreateRecipient = () => {
    cy.intercept(
      {
        method: /POST|PUT/,
        pathname: /\/api\/payment-recipients(\/.*)?$/,
      },
      (req) => {
        req.reply({
          statusCode: 200,
          body: {
            id: 999,
            ...req.body,
          },
        });
      }
    ).as('createRecipient');
  };

  const mockUpdateRecipient = () => {
    cy.intercept(
      {
        method: /PUT|PATCH|POST/,
        pathname: /\/recipients(\/\d+)?$/,
      },
      (req) => {
        req.reply({
          statusCode: 200,
          body: {
            id: Number(req.url.split('/').pop()),
            ...req.body,
          },
        });
      }
    ).as('updateRecipient');
  };

  const mockDeleteRecipient = () => {
    cy.intercept(
      {
        method: 'DELETE',
        pathname: /\/recipients\/\d+$/,
      },
      {
        statusCode: 200,
        body: {},
      }
    ).as('deleteRecipient');
  };

  const visitRecipientsPage = () => {
    cy.visit('/payments/recipients', {
      onBeforeLoad(win) {
        setAdminSession(win);
      },
    });
  };

  beforeEach(() => {
    cy.intercept('POST', '**/api/auth/refresh', { statusCode: 200, body: { accessToken: 'fake' } });
    cy.intercept('GET', '**/api/accounts/my', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/payments*', { statusCode: 200, body: { content: [] } });
    cy.intercept('GET', '**/api/loans/my*', { statusCode: 200, body: { content: [] } });
    mockRecipientsList();
    mockCreateRecipient();
    mockUpdateRecipient();
    mockDeleteRecipient();
  });

  it('renders page and loads recipients list', () => {
    visitRecipientsPage();

    cy.wait('@getRecipients');

    cy.contains('h1', 'Primaoci placanja').should('be.visible');
    cy.contains('Sacuvani primaoci').should('be.visible');
    cy.contains('Dodaj primaoca').should('be.visible');

    cy.get('input[placeholder="Pretraga po imenu, racunu, adresi ili telefonu"]').should('exist');

    cy.contains('Elektroprivreda Srbije').should('be.visible');
    cy.contains('160123456789012345').should('be.visible');
    cy.contains('Bulevar umetnosti 12, Beograd').should('be.visible');
    cy.contains('0111234567').should('be.visible');

    cy.contains('Telekom Srbija').should('be.visible');
    cy.contains('Streaming Servis').should('be.visible');
  });

  it('shows empty state when there are no recipients', () => {
    cy.intercept(
      {
        method: 'GET',
        pathname: '/api/payment-recipients',
      },
      {
        statusCode: 200,
        body: [],
      }
    ).as('getRecipientsEmpty');

    visitRecipientsPage();

    cy.wait('@getRecipientsEmpty');
    cy.contains('Nema sacuvanih primalaca').should('be.visible');
  });

  it('supports search by recipient name', () => {
    visitRecipientsPage();

    cy.wait('@getRecipients');

    cy.get('input[placeholder="Pretraga po imenu, racunu, adresi ili telefonu"]')
      .clear()
      .type('Telekom');

    cy.contains('Telekom Srbija').should('be.visible');
    cy.contains('Elektroprivreda Srbije').should('not.exist');
    cy.contains('Streaming Servis').should('not.exist');
  });

  it('supports search by account number', () => {
    visitRecipientsPage();

    cy.wait('@getRecipients');

    cy.get('input[placeholder="Pretraga po imenu, racunu, adresi ili telefonu"]')
      .clear()
      .type('340555666777888900');

    cy.contains('Streaming Servis').should('be.visible');
    cy.contains('Telekom Srbija').should('not.exist');
    cy.contains('Elektroprivreda Srbije').should('not.exist');
  });

  it('supports search by address', () => {
    visitRecipientsPage();

    cy.wait('@getRecipients');

    cy.get('input[placeholder="Pretraga po imenu, racunu, adresi ili telefonu"]')
      .clear()
      .type('Takovska');

    cy.contains('Telekom Srbija').should('be.visible');
    cy.contains('Elektroprivreda Srbije').should('not.exist');
  });

  it('supports search by phone number', () => {
    visitRecipientsPage();

    cy.wait('@getRecipients');

    cy.get('input[placeholder="Pretraga po imenu, racunu, adresi ili telefonu"]')
      .clear()
      .type('0111234567');

    cy.contains('Elektroprivreda Srbije').should('be.visible');
    cy.contains('Telekom Srbija').should('not.exist');
  });

  it('shows empty search state when no recipient matches search', () => {
    visitRecipientsPage();

    cy.wait('@getRecipients');

    cy.get('input[placeholder="Pretraga po imenu, racunu, adresi ili telefonu"]')
      .clear()
      .type('Nepostojeci primalac');

    cy.contains('Nema primalaca koji odgovaraju pretrazi.').should('be.visible');
  });

  it('opens and closes create recipient form', () => {
    visitRecipientsPage();

    cy.wait('@getRecipients');

    cy.contains('button', 'Dodaj primaoca').click();
    cy.contains('Novi primalac').should('be.visible');
    cy.get('#create-name').should('exist');
    cy.get('#create-account').should('exist');
    cy.get('#create-address').should('exist');
    cy.get('#create-phone').should('exist');

    cy.contains('button', 'Zatvori formu').click();
    cy.contains('Novi primalac').should('not.exist');
  });

  it('creates a new recipient successfully', () => {
    let recipients = [...recipientsInitial];

    cy.intercept(
      {
        method: 'GET',
        pathname: '/api/payment-recipients',
      },
      (req) => {
        req.reply({
          statusCode: 200,
          body: recipients,
        });
      }
    ).as('getRecipientsStateful');

    cy.intercept(
      {
        method: /POST|PUT/,
        pathname: /\/api\/payment-recipients(\/.*)?$/,
      },
      (req) => {
        if (req.method === 'POST') {
          const created = {
            id: 4,
            ...req.body,
          };

          recipients = [...recipients, created];

          req.reply({
            statusCode: 200,
            body: created,
          });
        }
      }
    ).as('saveRecipient');

    visitRecipientsPage();

    cy.wait('@getRecipientsStateful');

    cy.contains('button', 'Dodaj primaoca').click();

    cy.get('#create-name').type('Infostan');
    cy.get('#create-account').type('170123456789012312');

    cy.contains('button', 'Sačuvaj primaoca').click();

    cy.wait('@saveRecipient');
    cy.wait('@getRecipientsStateful');

    cy.contains('Infostan').should('be.visible');
    cy.contains('Novi primalac').should('not.exist');
  });

  it('shows validation errors in create form', () => {
    visitRecipientsPage();

    cy.wait('@getRecipients');

    cy.contains('button', 'Dodaj primaoca').click();
    cy.contains('button', 'Sačuvaj primaoca').click();

    cy.get('#create-name').should('exist');
    cy.get('#create-account').should('exist');
    cy.get('.text-destructive').should('have.length.at.least', 1);
    cy.get('@createRecipient.all').should('have.length', 0);
  });

  it('handles create recipient error gracefully', () => {
    cy.intercept(
      {
        method: /POST|PUT/,
        pathname: /\/api\/payment-recipients(\/.*)?$/,
      },
      {
        statusCode: 500,
        body: { message: 'Create failed' },
      }
    ).as('saveRecipientError');

    visitRecipientsPage();

    cy.wait('@getRecipients');

    cy.contains('button', 'Dodaj primaoca').click();

    cy.get('#create-name').type('Infostan');
    cy.get('#create-account').type('170123456789012312');

    cy.contains('button', 'Sačuvaj primaoca').click();

    cy.wait('@saveRecipientError');
    cy.contains('Novi primalac').should('be.visible');
  });

  it('starts inline edit and prepopulates fields', () => {
    visitRecipientsPage();

    cy.wait('@getRecipients');

    cy.contains('tr', 'Telekom Srbija').contains('button', 'Izmeni').click();

    cy.get('#edit-name-2').should('have.value', 'Telekom Srbija');
    cy.get('#edit-account-2').should('have.value', '205987654321000011');
    cy.get('#edit-address-2').should('have.value', 'Takovska 2, Beograd');
    cy.get('#edit-phone-2').should('have.value', '011222333');
    cy.contains('button', 'Sačuvaj').should('be.visible');
    cy.contains('button', 'Otkaži').should('be.visible');
  });

  it('cancels inline edit', () => {
    visitRecipientsPage();

    cy.wait('@getRecipients');

    cy.contains('tr', 'Telekom Srbija').contains('button', 'Izmeni').click();

    cy.get('#edit-name-2').clear().type('Novo ime');
    cy.contains('button', 'Otkaži').click();

    cy.get('#edit-name-2').should('not.exist');
    cy.contains('Telekom Srbija').should('be.visible');
  });

  it('updates recipient successfully', () => {
    let recipients = [...recipientsInitial];

    cy.intercept(
      {
        method: 'GET',
        pathname: '/api/payment-recipients',
      },
      (req) => {
        req.reply({
          statusCode: 200,
          body: recipients,
        });
      }
    ).as('getRecipientsStatefulEdit');

    cy.intercept(
      {
        method: /PUT|PATCH|POST/,
        pathname: /\/recipients(\/\d+)?$/,
      },
      (req) => {
        recipients = recipients.map((recipient) =>
          recipient.id === 2
            ? {
                ...recipient,
                ...req.body,
              }
            : recipient
        );

        req.reply({
          statusCode: 200,
          body: {
            id: 2,
            ...req.body,
          },
        });
      }
    ).as('saveRecipientEdit');

    visitRecipientsPage();

    cy.wait('@getRecipientsStatefulEdit');

    cy.contains('tr', 'Telekom Srbija').contains('button', 'Izmeni').click();
    cy.get('#edit-name-2').clear().type('Telekom Srbija Updated');

    cy.contains('button', 'Sačuvaj').click();

    cy.wait('@saveRecipientEdit');
    cy.wait('@getRecipientsStatefulEdit');

    cy.contains('Telekom Srbija Updated').should('be.visible');
  });

  it('shows validation errors in inline edit form', () => {
    visitRecipientsPage();

    cy.wait('@getRecipients');

    cy.contains('tr', 'Telekom Srbija').contains('button', 'Izmeni').click();

    cy.get('#edit-name-2').clear();
    cy.get('#edit-account-2').clear();

    cy.contains('button', 'Sačuvaj').click();

    cy.get('.text-destructive').should('have.length.at.least', 1);
    cy.get('@updateRecipient.all').should('have.length', 0);
  });

  it('handles update recipient error gracefully', () => {
    cy.intercept(
      {
        method: /PUT|PATCH|POST/,
        pathname: /\/recipients(\/\d+)?$/,
      },
      {
        statusCode: 500,
        body: { message: 'Update failed' },
      }
    ).as('saveRecipientEditError');

    visitRecipientsPage();

    cy.wait('@getRecipients');

    cy.contains('tr', 'Telekom Srbija').contains('button', 'Izmeni').click();
    cy.get('#edit-name-2').clear().type('Novo ime');

    cy.contains('button', 'Sačuvaj').click();

    cy.wait('@saveRecipientEditError');
    cy.get('#edit-name-2').should('have.value', 'Novo ime');
  });

  it('deletes recipient after confirmation', () => {
    let recipients = [...recipientsInitial];

    cy.intercept(
      {
        method: 'GET',
        pathname: '/api/payment-recipients',
      },
      (req) => {
        req.reply({
          statusCode: 200,
          body: recipients,
        });
      }
    ).as('getRecipientsStatefulDelete');

    cy.intercept(
      {
        method: 'DELETE',
        pathname: '/api/payment-recipients/1',
      },
      (req) => {
        recipients = recipients.filter((recipient) => recipient.id !== 1);

        req.reply({
          statusCode: 200,
          body: {},
        });
      }
    ).as('deleteRecipientSuccess');

    cy.on('window:confirm', () => true);

    visitRecipientsPage();

    cy.wait('@getRecipientsStatefulDelete');
    cy.contains('tr', 'Elektroprivreda Srbije').contains('button', 'Obriši').click();

    cy.wait('@deleteRecipientSuccess');
    cy.wait('@getRecipientsStatefulDelete');

    cy.get('tbody').should('not.contain', 'Elektroprivreda Srbije');
  });

  it('does not delete recipient when confirmation is cancelled', () => {
    cy.on('window:confirm', () => false);

    visitRecipientsPage();

    cy.wait('@getRecipients');

    cy.contains('tr', 'Elektroprivreda Srbije').contains('button', 'Obriši').click();

    cy.get('@deleteRecipient.all').should('have.length', 0);
    cy.contains('Elektroprivreda Srbije').should('be.visible');
  });

  it('handles delete recipient error gracefully', () => {
    cy.intercept(
      {
        method: 'DELETE',
        pathname: '/api/payment-recipients/1',
      },
      {
        statusCode: 500,
        body: { message: 'Delete failed' },
      }
    ).as('deleteRecipientError');

    cy.on('window:confirm', () => true);

    visitRecipientsPage();

    cy.wait('@getRecipients');

    cy.contains('tr', 'Elektroprivreda Srbije').contains('button', 'Obriši').click();

    cy.wait('@deleteRecipientError');
    cy.contains('Elektroprivreda Srbije').should('be.visible');
  });

  it('shows save and cancel actions while a recipient row is in edit mode', () => {
    visitRecipientsPage();

    cy.wait('@getRecipients');

    cy.contains('tr', 'Telekom Srbija').contains('button', 'Izmeni').click();

    cy.get('#edit-name-2').should('exist');
    cy.contains('button', 'Sačuvaj').should('be.visible');
    cy.contains('button', 'Otkaži').should('be.visible');
  });

  it('shows loading state while recipients are loading', () => {
    cy.intercept(
      {
        method: 'GET',
        pathname: '/api/payment-recipients',
      },
      {
        delay: 1200,
        statusCode: 200,
        body: recipientsInitial,
      }
    ).as('getRecipientsDelayed');

    visitRecipientsPage();

    cy.contains('Učitavanje primalaca...', { timeout: 3000 }).should('be.visible');
    cy.wait('@getRecipientsDelayed');
    cy.contains('Učitavanje primalaca...').should('not.exist');
  });
});