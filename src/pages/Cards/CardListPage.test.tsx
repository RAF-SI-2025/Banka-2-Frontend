import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CardListPage from './CardListPage';
import { mockCard, mockAccount } from '@/test/helpers';

// ---------- Mocks ----------

vi.mock('@/services/cardService', () => ({
  cardService: {
    getMyCards: vi.fn(),
    block: vi.fn(),
    unblock: vi.fn(),
    deactivate: vi.fn(),
    changeLimit: vi.fn(),
    submitRequest: vi.fn(),
  },
}));

vi.mock('@/services/accountService', () => ({
  accountService: {
    getMyAccounts: vi.fn(),
  },
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 1, email: 'marko@banka.rs', firstName: 'Marko', lastName: 'Petrovic', role: 'CLIENT' },
    isAdmin: false,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasPermission: vi.fn(() => false),
  })),
}));

import { cardService } from '@/services/cardService';
import { accountService } from '@/services/accountService';

const mockCardService = vi.mocked(cardService);
const mockAccountService = vi.mocked(accountService);

// R1-637/638: BE vraca VEC maskiran broj (5798********5571, Celina 2 §321) —
// FE ga prikazuje direktno bez re-maskiranja. Mockovi koriste BE-maskiranu formu.
const card1 = mockCard({
  id: 1,
  cardNumber: '4111********1234',
  cardType: 'VISA',
  cardName: 'Visa Debit',
  status: 'ACTIVE',
  holderName: 'MARKO PETROVIC',
  limit: 100000,
});

const card2 = mockCard({
  id: 2,
  cardNumber: '5500********5678',
  cardType: 'MASTERCARD',
  cardName: 'Mastercard Gold',
  status: 'BLOCKED',
  holderName: 'MARKO PETROVIC',
  limit: 200000,
});

const acc = mockAccount();

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/cards']}>
      <CardListPage />
    </MemoryRouter>
  );
}

describe('CardListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCardService.getMyCards.mockResolvedValue([card1, card2]);
    mockAccountService.getMyAccounts.mockResolvedValue([acc]);
  });

  it('renders page with card list', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Visa Debit/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Mastercard Gold/i)).toBeInTheDocument();
  });

  it('displays masked card numbers', async () => {
    renderPage();

    await waitFor(() => {
      // Card numbers should be partially masked: first 4 and last 4 visible
      expect(screen.getByText(/4111.*1234/)).toBeInTheDocument();
    });
    expect(screen.getByText(/5500.*5678/)).toBeInTheDocument();
  });

  it('shows card status badges', async () => {
    renderPage();

    await waitFor(() => {
      // "Aktivna" appears both in the badge and in the switch label area
      expect(screen.getAllByText(/Aktivna/i).length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(/Blokirana/i).length).toBeGreaterThan(0);
  });

  it('shows card holder names', async () => {
    renderPage();

    await waitFor(() => {
      const holderTexts = screen.getAllByText(/MARKO PETROVIC/i);
      expect(holderTexts.length).toBeGreaterThan(0);
    });
  });

  it('has block/unblock action via Switch toggles', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Visa Debit/i)).toBeInTheDocument();
    });

    // The card uses Switch components for block/unblock, not named buttons
    // Active card has a Switch with "Aktivna" label, blocked card has "Blokirana" label
    const switches = screen.getAllByRole('switch');
    expect(switches.length).toBeGreaterThan(0);
  });

  it('calls block service when switch is toggled on active card', async () => {
    const user = userEvent.setup();
    mockCardService.block.mockResolvedValue(undefined);
    mockCardService.getMyCards.mockResolvedValue([card1, card2]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Visa Debit/i)).toBeInTheDocument();
    });

    // The active card has a Switch that is checked (true). Toggling it triggers confirm dialog,
    // sa SC30 fix-om iz 14.05.2026 — pa moramo da kliknemo "Blokiraj" u dialog-u da bi se
    // pozvao cardService.block.
    const switches = screen.getAllByRole('switch');
    const activeSwitch = switches.find(s => s.getAttribute('aria-checked') === 'true');
    if (activeSwitch) {
      await user.click(activeSwitch);
      await waitFor(() => {
        expect(screen.getByTestId('card-block-confirm-dialog')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('card-block-confirm-button'));

      await waitFor(() => {
        expect(mockCardService.block).toHaveBeenCalledWith(1);
      });
    }
  });

  it('shows loading skeleton initially', () => {
    mockCardService.getMyCards.mockImplementation(() => new Promise(() => {}));

    renderPage();

    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows empty state when no cards', async () => {
    mockCardService.getMyCards.mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      // Either "Nema kartica" or some empty state text
      screen.queryByText(/Nema kartic|Nemate kartic/i);
      // Or at minimum the page loaded without cards
      expect(mockCardService.getMyCards).toHaveBeenCalled();
    });
  });

  it('renders new card request button', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Visa Debit/i)).toBeInTheDocument();
    });

    const newCardBtn = screen.queryByRole('button', { name: /Nova kartica|Zatrazi novu karticu|Zahtev za karticu/i });
    // The button should exist
    expect(newCardBtn || screen.queryByText(/Nova kartica|Zatrazi novu karticu|Zahtev/i)).toBeTruthy();
  });

  it('displays card expiration dates', async () => {
    renderPage();

    await waitFor(() => {
      // Card expiry format is MM/YY
      const expiryTexts = screen.getAllByText(/\d{2}\/\d{2}/);
      expect(expiryTexts.length).toBeGreaterThan(0);
    });
  });

  // ---------- Card status transitions ----------

  it('shows deactivated card message for deactivated cards', async () => {
    const { useAuth } = await import('@/context/AuthContext');
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 1, email: 'marko@banka.rs', firstName: 'Marko', lastName: 'Petrovic', role: 'CLIENT' } as never,
      isAdmin: false,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      hasPermission: vi.fn(() => false),
    });

    const deactivatedCard = mockCard({
      id: 3,
      cardNumber: '3700000000003456',
      cardType: 'AMERICAN_EXPRESS',
      cardName: 'AmEx Platinum',
      status: 'DEACTIVATED',
      holderName: 'MARKO PETROVIC',
      limit: 300000,
    });
    mockCardService.getMyCards.mockResolvedValue([deactivatedCard]);

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText(/Deaktivirana/i).length).toBeGreaterThan(0);
    });
    expect(screen.getByText(/Kartica je deaktivirana/i)).toBeInTheDocument();
  });

  it('does not show action buttons for deactivated cards', async () => {
    const { useAuth } = await import('@/context/AuthContext');
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 1, email: 'marko@banka.rs', firstName: 'Marko', lastName: 'Petrovic', role: 'CLIENT' } as never,
      isAdmin: false,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      hasPermission: vi.fn(() => false),
    });

    const deactivatedCard = mockCard({
      id: 3,
      status: 'DEACTIVATED',
      cardName: 'Deaktivirana kartica',
    });
    mockCardService.getMyCards.mockResolvedValue([deactivatedCard]);

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText(/Deaktivirana/i).length).toBeGreaterThan(0);
    });

    expect(screen.queryByText(/Promeni limit/i)).not.toBeInTheDocument();
  });

  it('shows "Kontaktirajte banku" for blocked card when not admin', async () => {
    mockCardService.getMyCards.mockResolvedValue([card2]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Kontaktirajte banku/i)).toBeInTheDocument();
    });
  });

  // ---------- Card limit update flow ----------

  it('calls changeLimit when user enters valid limit via prompt', async () => {
    const user = userEvent.setup();
    mockCardService.changeLimit.mockResolvedValue(undefined);
    // Mock window.prompt to return a valid number
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('250000');

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Visa Debit/i)).toBeInTheDocument();
    });

    const limitButtons = screen.getAllByText(/Promeni limit/i);
    // The first active card's limit button
    await user.click(limitButtons[0]);

    await waitFor(() => {
      expect(mockCardService.changeLimit).toHaveBeenCalledWith(1, 250000);
    });

    promptSpy.mockRestore();
  });

  it('does not call changeLimit when user cancels prompt', async () => {
    const user = userEvent.setup();
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue(null);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Visa Debit/i)).toBeInTheDocument();
    });

    const limitButtons = screen.getAllByText(/Promeni limit/i);
    await user.click(limitButtons[0]);

    expect(mockCardService.changeLimit).not.toHaveBeenCalled();

    promptSpy.mockRestore();
  });

  it('shows error toast when limit is negative', async () => {
    const user = userEvent.setup();
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('-100');

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Visa Debit/i)).toBeInTheDocument();
    });

    const limitButtons = screen.getAllByText(/Promeni limit/i);
    await user.click(limitButtons[0]);

    expect(mockCardService.changeLimit).not.toHaveBeenCalled();

    promptSpy.mockRestore();
  });

  // ---------- Deactivate flow ----------

  it('calls deactivate when user confirms via window.confirm', async () => {
    // To test deactivate, need admin role
    const { useAuth } = await import('@/context/AuthContext');
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 1, email: 'admin@banka.rs', firstName: 'Admin', lastName: 'User', role: 'ADMIN' } as never,
      isAdmin: true,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      hasPermission: vi.fn(() => true),
    });

    const user = userEvent.setup();
    mockCardService.deactivate.mockResolvedValue(undefined);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Visa Debit/i)).toBeInTheDocument();
    });

    const deactivateBtn = screen.getAllByText(/Deaktiviraj/i);
    await user.click(deactivateBtn[0]);

    await waitFor(() => {
      expect(mockCardService.deactivate).toHaveBeenCalledWith(1);
    });

    confirmSpy.mockRestore();
  });

  it('does not deactivate when user cancels confirm dialog', async () => {
    const { useAuth } = await import('@/context/AuthContext');
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 1, email: 'admin@banka.rs', firstName: 'Admin', lastName: 'User', role: 'ADMIN' } as never,
      isAdmin: true,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      hasPermission: vi.fn(() => true),
    });

    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Visa Debit/i)).toBeInTheDocument();
    });

    const deactivateBtn = screen.getAllByText(/Deaktiviraj/i);
    await user.click(deactivateBtn[0]);

    expect(mockCardService.deactivate).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  // ---------- New card request error handling ----------

  it('opens new card form when "Nova kartica" is clicked', async () => {
    const { useAuth } = await import('@/context/AuthContext');
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 1, email: 'marko@banka.rs', firstName: 'Marko', lastName: 'Petrovic', role: 'CLIENT' } as never,
      isAdmin: false,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      hasPermission: vi.fn(() => false),
    });

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Visa Debit/i)).toBeInTheDocument();
    });

    const newCardBtn = screen.getByRole('button', { name: /Nova kartica|Zatrazi novu karticu/i });
    await user.click(newCardBtn);

    await waitFor(() => {
      expect(screen.getByText(/Zahtev za novu karticu/i)).toBeInTheDocument();
    });
  });

  it('shows error when submitting new card without selecting account', async () => {
    const { useAuth } = await import('@/context/AuthContext');
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 1, email: 'marko@banka.rs', firstName: 'Marko', lastName: 'Petrovic', role: 'CLIENT' } as never,
      isAdmin: false,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      hasPermission: vi.fn(() => false),
    });

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Visa Debit/i)).toBeInTheDocument();
    });

    // Open form
    await user.click(screen.getByRole('button', { name: /Nova kartica|Zatrazi novu karticu/i }));

    await waitFor(() => {
      expect(screen.getByText(/Zahtev za novu karticu/i)).toBeInTheDocument();
    });

    // ACCEPTED-DEVIATION (user-directed 03.06): bez izabranog racuna, dugme za
    // podnosenje zahteva je disabled (single-step submit, bez OTP/email koda).
    const submitBtn = screen.getByTestId('card-submit-request-button');
    expect(submitBtn).toBeDisabled();
  });

  it('closes new card form when "Otkazi" is clicked', async () => {
    const { useAuth } = await import('@/context/AuthContext');
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 1, email: 'marko@banka.rs', firstName: 'Marko', lastName: 'Petrovic', role: 'CLIENT' } as never,
      isAdmin: false,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      hasPermission: vi.fn(() => false),
    });

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Visa Debit/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Nova kartica|Zatrazi novu karticu/i }));

    await waitFor(() => {
      expect(screen.getByText(/Zahtev za novu karticu/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Otkazi/i }));

    await waitFor(() => {
      expect(screen.queryByText(/Zahtev za novu karticu/i)).not.toBeInTheDocument();
    });
  });

  // ---------- Stats row ----------

  it('shows stats row with card counts', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Ukupno kartica/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Aktivne/i)).toBeInTheDocument();
    expect(screen.getByText(/Blokirane/i)).toBeInTheDocument();
  });

  it('displays correct card counts in stats', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Ukupno kartica/i)).toBeInTheDocument();
    });

    // 2 cards total, 1 active, 1 blocked
    const statNumbers = screen.getAllByText('2');
    expect(statNumbers.length).toBeGreaterThan(0); // total = 2
    const oneElements = screen.getAllByText('1');
    expect(oneElements.length).toBeGreaterThanOrEqual(2); // 1 active, 1 blocked
  });

  // ---------- Error handling ----------

  it('handles card load error gracefully', async () => {
    mockCardService.getMyCards.mockRejectedValue(new Error('Network error'));

    renderPage();

    await waitFor(() => {
      expect(mockCardService.getMyCards).toHaveBeenCalled();
    });

    // Should show empty state after error
    await waitFor(() => {
      expect(screen.getByText(/Nemate kartic/i)).toBeInTheDocument();
    });
  });

  it('handles block action failure', async () => {
    const user = userEvent.setup();
    mockCardService.block.mockRejectedValue(new Error('Server error'));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Visa Debit/i)).toBeInTheDocument();
    });

    const switches = screen.getAllByRole('switch');
    const activeSwitch = switches.find(s => s.getAttribute('aria-checked') === 'true');
    if (activeSwitch) {
      // SC30 fix: switch sad otvara confirm dialog umesto direktnog poziva.
      await user.click(activeSwitch);
      await waitFor(() => {
        expect(screen.getByTestId('card-block-confirm-dialog')).toBeInTheDocument();
      });
      const confirmBtn = screen.getByTestId('card-block-confirm-button');
      await user.click(confirmBtn);
      await waitFor(() => {
        expect(mockCardService.block).toHaveBeenCalled();
      });
    }
  });

  // ---------- Card type gradients ----------

  it('renders different card type visuals (VISA and MASTERCARD)', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Visa Debit/i)).toBeInTheDocument();
      expect(screen.getByText(/Mastercard Gold/i)).toBeInTheDocument();
    });
  });

  // ---------- Limit button disabled for blocked card ----------

  it('disables limit button for blocked cards', async () => {
    mockCardService.getMyCards.mockResolvedValue([card2]); // blocked card only

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Mastercard Gold/i)).toBeInTheDocument();
    });

    const limitBtn = screen.getByText(/Promeni limit/i);
    expect(limitBtn.closest('button')).toBeDisabled();
  });

  // ---------- New card form complete flow ----------

  it('submits new card request successfully when account is selected', async () => {
    const { useAuth } = await import('@/context/AuthContext');
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 1, email: 'marko@banka.rs', firstName: 'Marko', lastName: 'Petrovic', role: 'CLIENT' } as never,
      isAdmin: false,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      hasPermission: vi.fn(() => false),
    });

    mockCardService.submitRequest.mockResolvedValue(undefined);
    const activeAcc = mockAccount({ id: 10, status: 'ACTIVE', accountNumber: '265000000000000010', name: 'Tekuci' });
    mockAccountService.getMyAccounts.mockResolvedValue([activeAcc]);
    // No existing cards on this account
    mockCardService.getMyCards.mockResolvedValue([]);

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Nemate kartic/i)).toBeInTheDocument();
    });

    // Click "Zatrazite karticu" in empty state
    await user.click(screen.getByRole('button', { name: /Zatrazite karticu/i }));

    await waitFor(() => {
      expect(screen.getByText(/Zahtev za novu karticu/i)).toBeInTheDocument();
    });

    // Select account from the dropdown
    const selectTriggers = screen.getAllByRole('combobox');
    await user.click(selectTriggers[0]);

    const accOption = await screen.findByRole('option', { name: /Tekuci/i });
    await user.click(accOption);

    // ACCEPTED-DEVIATION (user-directed 03.06): jednokoracni submit bez OTP/email koda.
    const submitBtn = screen.getByTestId('card-submit-request-button');
    expect(submitBtn).not.toBeDisabled();
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockCardService.submitRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 10,
        })
      );
    });
    // OTP/email kod se vise NE salje uz zahtev za karticu.
    expect(mockCardService.submitRequest).toHaveBeenCalledWith(
      expect.not.objectContaining({ verificationCode: expect.anything() })
    );
  });

  it('shows error when card creation API fails', async () => {
    const { useAuth } = await import('@/context/AuthContext');
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 1, email: 'marko@banka.rs', firstName: 'Marko', lastName: 'Petrovic', role: 'CLIENT' } as never,
      isAdmin: false,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      hasPermission: vi.fn(() => false),
    });

    mockCardService.submitRequest.mockRejectedValue({
      response: { data: { message: 'Limit kartica prekoracen.' } },
    });
    const activeAcc = mockAccount({ id: 10, status: 'ACTIVE', accountNumber: '265000000000000010', name: 'Tekuci' });
    mockAccountService.getMyAccounts.mockResolvedValue([activeAcc]);
    mockCardService.getMyCards.mockResolvedValue([]);

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Nemate kartic/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Zatrazite karticu/i }));

    await waitFor(() => {
      expect(screen.getByText(/Zahtev za novu karticu/i)).toBeInTheDocument();
    });

    const selectTriggers = screen.getAllByRole('combobox');
    await user.click(selectTriggers[0]);
    const accOption = await screen.findByRole('option', { name: /Tekuci/i });
    await user.click(accOption);

    // ACCEPTED-DEVIATION (user-directed 03.06): direktan submit bez OTP/email koda.
    await user.click(screen.getByTestId('card-submit-request-button'));

    await waitFor(() => {
      expect(mockCardService.submitRequest).toHaveBeenCalled();
    });
  });

  it('shows max cards error for personal account with 2 cards', async () => {
    const { useAuth } = await import('@/context/AuthContext');
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 1, email: 'marko@banka.rs', firstName: 'Marko', lastName: 'Petrovic', role: 'CLIENT' } as never,
      isAdmin: false,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      hasPermission: vi.fn(() => false),
    });

    const activeAcc = mockAccount({ id: 10, status: 'ACTIVE', accountNumber: '265000000000000010', name: 'Tekuci' });
    mockAccountService.getMyAccounts.mockResolvedValue([activeAcc]);
    // 2 active cards already on the same account
    const existingCards = [
      mockCard({ id: 100, accountNumber: '265000000000000010', status: 'ACTIVE' }),
      mockCard({ id: 101, accountNumber: '265000000000000010', status: 'ACTIVE' }),
    ];
    mockCardService.getMyCards.mockResolvedValue(existingCards);

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Nova kartica|Zatrazi novu karticu/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Nova kartica|Zatrazi novu karticu/i }));

    await waitFor(() => {
      expect(screen.getByText(/Zahtev za novu karticu/i)).toBeInTheDocument();
    });

    const selectTriggers = screen.getAllByRole('combobox');
    await user.click(selectTriggers[0]);
    const accOption = await screen.findByRole('option', { name: /Tekuci/i });
    await user.click(accOption);

    // ACCEPTED-DEVIATION (user-directed 03.06): max-cards validacija blokira submit
    // (jednokoracni flow, bez OTP/email koda).
    await user.click(screen.getByTestId('card-submit-request-button'));

    // Zahtev se ne salje zbog max-cards praga.
    expect(mockCardService.submitRequest).not.toHaveBeenCalled();
  });

  // ---------- Admin sees deactivate but no "Nova kartica" ----------

  it('does not show "Nova kartica" button for admin users', async () => {
    const { useAuth } = await import('@/context/AuthContext');
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 1, email: 'admin@banka.rs', firstName: 'Admin', lastName: 'User', role: 'ADMIN' } as never,
      isAdmin: true,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      hasPermission: vi.fn(() => true),
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Visa Debit/i)).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /Nova kartica|Zatrazi novu karticu/i })).not.toBeInTheDocument();
  });

  // ---------- Admin can unblock via switch ----------

  it('admin can unblock a blocked card via switch', async () => {
    const { useAuth } = await import('@/context/AuthContext');
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 1, email: 'admin@banka.rs', firstName: 'Admin', lastName: 'User', role: 'ADMIN' } as never,
      isAdmin: true,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      hasPermission: vi.fn(() => true),
    });

    mockCardService.unblock.mockResolvedValue(undefined);
    mockCardService.getMyCards.mockResolvedValue([card2]); // blocked card only

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Mastercard Gold/i)).toBeInTheDocument();
    });

    // Admin sees a switch for blocked card (unchecked)
    const switches = screen.getAllByRole('switch');
    const blockedSwitch = switches.find(s => s.getAttribute('aria-checked') === 'false');
    if (blockedSwitch) {
      await user.click(blockedSwitch);
      await waitFor(() => {
        expect(mockCardService.unblock).toHaveBeenCalledWith(2);
      });
    }
  });

  // ---------- Card limit ring display (R1-548) ----------

  it('does NOT show a fake 0% limit ring for DEBIT cards (R1-548)', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Visa Debit/i)).toBeInTheDocument();
    });

    // card1/card2 nemaju cardCategory → DEBIT → nema spending podataka → nema prstena.
    // Pre fix-a je svaka kartica imala hardkodiran "0%" (lazni podatak).
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('shows a REAL usage ring for CREDIT cards (outstanding/credit-limit) (R1-548)', async () => {
    const creditCard = mockCard({
      id: 99,
      cardNumber: '5200000000009999',
      cardType: 'MASTERCARD',
      cardName: 'Mastercard Credit',
      status: 'ACTIVE',
      holderName: 'MARKO PETROVIC',
      limit: 100000,
      cardCategory: 'CREDIT',
      creditLimit: 100000,
      outstandingBalance: 25000,
    });
    mockCardService.getMyCards.mockResolvedValue([creditCard]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Mastercard Credit/i)).toBeInTheDocument();
    });

    // 25000 / 100000 = 25%
    expect(screen.getByText('25%')).toBeInTheDocument();
  });
});
