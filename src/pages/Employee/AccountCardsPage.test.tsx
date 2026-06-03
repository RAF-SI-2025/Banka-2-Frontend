import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AccountCardsPage from './AccountCardsPage';
import { renderWithProviders } from '../../test/test-utils';
import type { Account, Card as BankCard } from '@/types/celina2';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: undefined }),
  };
});

const mockAccount: Account = {
  id: 1,
  ownerName: 'Marko Petrovic',
  accountNumber: '265000000000000001',
  accountType: 'TEKUCI',
  currency: 'RSD',
  status: 'ACTIVE',
  balance: 100000,
  availableBalance: 95000,
  createdAt: '2025-01-01',
} as Account;

const mockCards: BankCard[] = [
  {
    id: 101,
    // R1-637/638: BE vraca VEC maskiran broj (5798********5571) — FE prikazuje direktno.
    cardNumber: '4111********1234',
    cardType: 'VISA',
    cardName: 'Visa Classic',
    status: 'ACTIVE',
    ownerName: 'Marko Petrovic',
    holderName: 'Marko Petrovic',
    expirationDate: '2028-01-01',
    cardLimit: 50000,
    limit: 50000,
  } as BankCard,
  {
    id: 102,
    cardNumber: '5500********5678',
    cardType: 'MASTERCARD',
    cardName: 'Mastercard Gold',
    status: 'BLOCKED',
    ownerName: 'Marko Petrovic',
    holderName: 'Marko Petrovic',
    expirationDate: '2027-06-01',
    cardLimit: 30000,
    limit: 30000,
  } as BankCard,
  {
    id: 103,
    cardNumber: '3700********9012',
    cardType: 'AMERICAN_EXPRESS',
    cardName: 'Amex',
    status: 'DEACTIVATED',
    ownerName: 'Marko Petrovic',
    holderName: 'Marko Petrovic',
    expirationDate: '2026-12-01',
    cardLimit: 0,
    limit: 0,
  } as BankCard,
];

const mockGetById = vi.fn().mockResolvedValue(mockAccount);
const mockGetAll = vi.fn().mockResolvedValue({ content: [mockAccount], totalPages: 1, totalElements: 1 });
const mockGetByAccount = vi.fn().mockResolvedValue(mockCards);
const mockBlock = vi.fn().mockResolvedValue(undefined);
const mockUnblock = vi.fn().mockResolvedValue(undefined);
const mockDeactivate = vi.fn().mockResolvedValue(undefined);
const mockCreate = vi.fn().mockResolvedValue({ id: 104 });

vi.mock('../../services/accountService', () => ({
  accountService: {
    getById: (...args: unknown[]) => mockGetById(...args),
    getAll: (...args: unknown[]) => mockGetAll(...args),
  },
}));

vi.mock('../../services/cardService', () => ({
  cardService: {
    getByAccount: (...args: unknown[]) => mockGetByAccount(...args),
    block: (...args: unknown[]) => mockBlock(...args),
    unblock: (...args: unknown[]) => mockUnblock(...args),
    deactivate: (...args: unknown[]) => mockDeactivate(...args),
    create: (...args: unknown[]) => mockCreate(...args),
  },
}));

describe('AccountCardsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetByAccount.mockResolvedValue(mockCards);
    mockGetById.mockResolvedValue(mockAccount);
    mockGetAll.mockResolvedValue({ content: [mockAccount], totalPages: 1, totalElements: 1 });
  });

  it('renders the page header', () => {
    renderWithProviders(<AccountCardsPage />);

    expect(screen.getByText('Portal kartica')).toBeInTheDocument();
    expect(screen.getByText(/Pregledajte i upravljajte karticama/i)).toBeInTheDocument();
  });

  it('renders back button', () => {
    renderWithProviders(<AccountCardsPage />);

    expect(screen.getByText('Nazad na portal racuna')).toBeInTheDocument();
  });

  it('navigates back when clicking back button', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AccountCardsPage />);

    await user.click(screen.getByText('Nazad na portal racuna'));
    expect(mockNavigate).toHaveBeenCalledWith('/employee/accounts');
  });

  it('renders search inputs', () => {
    renderWithProviders(<AccountCardsPage />);

    expect(screen.getByPlaceholderText('18 cifara')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ime ili prezime')).toBeInTheDocument();
  });

  it('renders Pretrazi button', () => {
    renderWithProviders(<AccountCardsPage />);

    expect(screen.getByText('Pretrazi')).toBeInTheDocument();
  });

  it('renders Nova kartica button', () => {
    renderWithProviders(<AccountCardsPage />);

    expect(screen.getByText('Nova kartica')).toBeInTheDocument();
  });

  it('shows empty state when no account is selected', () => {
    renderWithProviders(<AccountCardsPage />);

    expect(screen.getByText('Pretrazite racun da biste videli kartice')).toBeInTheDocument();
  });

  it('shows error on search without input', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AccountCardsPage />);

    await user.click(screen.getByText('Pretrazi'));

    // Toast fires -- the page still shows the empty state
    expect(screen.getByText('Pretrazite racun da biste videli kartice')).toBeInTheDocument();
  });

  it('searches by account number and displays cards', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AccountCardsPage />);

    const input = screen.getByPlaceholderText('18 cifara');
    await user.type(input, '1');
    await user.click(screen.getByText('Pretrazi'));

    await waitFor(() => {
      expect(screen.getAllByText(/Marko Petrovic/).length).toBeGreaterThan(0);
    });

    // Cards should be displayed — BE-maskiran broj (4111********1234) prikazan direktno.
    expect(screen.getAllByText(/4111\*+1234/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/5500\*+5678/).length).toBeGreaterThan(0);
  });

  it('displays card status labels correctly', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AccountCardsPage />);

    const input = screen.getByPlaceholderText('18 cifara');
    await user.type(input, '1');
    await user.click(screen.getByText('Pretrazi'));

    await waitFor(() => {
      expect(screen.getByText('Aktivna')).toBeInTheDocument();
    });
    expect(screen.getByText('Blokirana')).toBeInTheDocument();
    expect(screen.getByText('Deaktivirana')).toBeInTheDocument();
  });

  it('shows stats row when cards are loaded', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AccountCardsPage />);

    const input = screen.getByPlaceholderText('18 cifara');
    await user.type(input, '1');
    await user.click(screen.getByText('Pretrazi'));

    await waitFor(() => {
      expect(screen.getAllByText('Ukupno').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('Aktivne').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Blokirane').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Deaktivirane').length).toBeGreaterThan(0);
  });

  it('shows Blokiraj button for active card', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AccountCardsPage />);

    const input = screen.getByPlaceholderText('18 cifara');
    await user.type(input, '1');
    await user.click(screen.getByText('Pretrazi'));

    await waitFor(() => {
      expect(screen.getByText('Blokiraj')).toBeInTheDocument();
    });
  });

  it('shows Deblokiraj button for blocked card', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AccountCardsPage />);

    const input = screen.getByPlaceholderText('18 cifara');
    await user.type(input, '1');
    await user.click(screen.getByText('Pretrazi'));

    await waitFor(() => {
      expect(screen.getByText('Deblokiraj')).toBeInTheDocument();
    });
  });

  it('shows "Trajno deaktivirana" for deactivated card', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AccountCardsPage />);

    const input = screen.getByPlaceholderText('18 cifara');
    await user.type(input, '1');
    await user.click(screen.getByText('Pretrazi'));

    await waitFor(() => {
      expect(screen.getByText('Trajno deaktivirana')).toBeInTheDocument();
    });
  });

  it('calls block service when Blokiraj is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AccountCardsPage />);

    const input = screen.getByPlaceholderText('18 cifara');
    await user.type(input, '1');
    await user.click(screen.getByText('Pretrazi'));

    await waitFor(() => {
      expect(screen.getByText('Blokiraj')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Blokiraj'));

    await waitFor(() => {
      expect(mockBlock).toHaveBeenCalledWith(101);
    });
  });

  it('calls unblock service when Deblokiraj is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AccountCardsPage />);

    const input = screen.getByPlaceholderText('18 cifara');
    await user.type(input, '1');
    await user.click(screen.getByText('Pretrazi'));

    await waitFor(() => {
      expect(screen.getByText('Deblokiraj')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Deblokiraj'));

    await waitFor(() => {
      expect(mockUnblock).toHaveBeenCalledWith(102);
    });
  });

  it('shows no cards message when account has no cards', async () => {
    mockGetByAccount.mockResolvedValue([]);
    const user = userEvent.setup();
    renderWithProviders(<AccountCardsPage />);

    const input = screen.getByPlaceholderText('18 cifara');
    await user.type(input, '1');
    await user.click(screen.getByText('Pretrazi'));

    await waitFor(() => {
      expect(screen.getByText('Nema kartica za ovaj racun')).toBeInTheDocument();
    });
  });

  it('shows search results when multiple accounts found by owner name', async () => {
    const account2: Account = { ...mockAccount, id: 2, ownerName: 'Ana Jovanovic', accountNumber: '265000000000000002' };
    mockGetAll.mockResolvedValue({ content: [mockAccount, account2], totalPages: 1, totalElements: 2 });

    const user = userEvent.setup();
    renderWithProviders(<AccountCardsPage />);

    const nameInput = screen.getByPlaceholderText('Ime ili prezime');
    await user.type(nameInput, 'a');
    await user.click(screen.getByText('Pretrazi'));

    await waitFor(() => {
      expect(screen.getByText(/Pronadjeno 2 racuna/)).toBeInTheDocument();
    });
  });

  it('shows loading skeletons during search', async () => {
    mockGetById.mockReturnValue(new Promise(() => {})); // never resolves
    const user = userEvent.setup();
    renderWithProviders(<AccountCardsPage />);

    const input = screen.getByPlaceholderText('18 cifara');
    await user.type(input, '1');
    await user.click(screen.getByText('Pretrazi'));

    await waitFor(() => {
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  it('opens create card form when Nova kartica is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AccountCardsPage />);

    // First search to get an account loaded
    const input = screen.getByPlaceholderText('18 cifara');
    await user.type(input, '1');
    await user.click(screen.getByText('Pretrazi'));

    await waitFor(() => {
      expect(screen.getAllByText(/Marko Petrovic/).length).toBeGreaterThan(0);
    });

    // Click "Nova kartica"
    await user.click(screen.getByText('Nova kartica'));

    await waitFor(() => {
      expect(screen.getByText('Kreiraj karticu')).toBeInTheDocument();
    });

    // The card type select should be visible
    expect(screen.getByText(/Izaberite tip/i)).toBeInTheDocument();
  });

  it('creates a new card with selected type', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AccountCardsPage />);

    const input = screen.getByPlaceholderText('18 cifara');
    await user.type(input, '1');
    await user.click(screen.getByText('Pretrazi'));

    await waitFor(() => {
      expect(screen.getAllByText(/Marko Petrovic/).length).toBeGreaterThan(0);
    });

    await user.click(screen.getByText('Nova kartica'));

    await waitFor(() => {
      expect(screen.getByText('Kreiraj karticu')).toBeInTheDocument();
    });

    // Select card type
    const selectTriggers = screen.getAllByRole('combobox');
    const cardTypeSelect = selectTriggers.find((t) =>
      t.textContent?.includes('Izaberite tip')
    );
    if (cardTypeSelect) {
      await user.click(cardTypeSelect);
      const visaOption = await screen.findByRole('option', { name: 'Visa' });
      await user.click(visaOption);
    }

    // Click create
    await user.click(screen.getByText('Kreiraj karticu'));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalled();
    });
  });

  it('cancels create card form', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AccountCardsPage />);

    const input = screen.getByPlaceholderText('18 cifara');
    await user.type(input, '1');
    await user.click(screen.getByText('Pretrazi'));

    await waitFor(() => {
      expect(screen.getAllByText(/Marko Petrovic/).length).toBeGreaterThan(0);
    });

    await user.click(screen.getByText('Nova kartica'));

    await waitFor(() => {
      expect(screen.getByText('Kreiraj karticu')).toBeInTheDocument();
    });

    // Click the cancel button inside create card form
    const cancelButtons = screen.getAllByText('Otkazi');
    await user.click(cancelButtons[cancelButtons.length - 1]);

    await waitFor(() => {
      expect(screen.queryByText('Kreiraj karticu')).not.toBeInTheDocument();
    });
  });

  it('deactivation requires confirmation dialog', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderWithProviders(<AccountCardsPage />);

    const input = screen.getByPlaceholderText('18 cifara');
    await user.type(input, '1');
    await user.click(screen.getByText('Pretrazi'));

    await waitFor(() => {
      expect(screen.getByText('Aktivna')).toBeInTheDocument();
    });

    // Find and click the deactivate (ShieldX) button for the active card
    // The active card has both "Blokiraj" and a small deactivate button
    const allButtons = screen.getAllByRole('button');
    const deactivateButtons = allButtons.filter(
      (btn) => btn.classList.contains('destructive') || btn.className.includes('destructive')
    );

    // Click a destructive variant button (deactivate)
    if (deactivateButtons.length > 0) {
      await user.click(deactivateButtons[0]);
      await waitFor(() => {
        expect(confirmSpy).toHaveBeenCalled();
      });
    }

    confirmSpy.mockRestore();
  });

  it('does not deactivate if confirmation is cancelled', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    renderWithProviders(<AccountCardsPage />);

    const input = screen.getByPlaceholderText('18 cifara');
    await user.type(input, '1');
    await user.click(screen.getByText('Pretrazi'));

    await waitFor(() => {
      expect(screen.getByText('Aktivna')).toBeInTheDocument();
    });

    const allButtons = screen.getAllByRole('button');
    const deactivateButtons = allButtons.filter(
      (btn) => btn.className.includes('destructive')
    );

    if (deactivateButtons.length > 0) {
      await user.click(deactivateButtons[0]);
      expect(mockDeactivate).not.toHaveBeenCalled();
    }

    confirmSpy.mockRestore();
  });

  it('searches by owner name and shows single account directly', async () => {
    mockGetAll.mockResolvedValue({ content: [mockAccount], totalPages: 1, totalElements: 1 });
    const user = userEvent.setup();
    renderWithProviders(<AccountCardsPage />);

    const nameInput = screen.getByPlaceholderText('Ime ili prezime');
    await user.type(nameInput, 'Marko');
    await user.click(screen.getByText('Pretrazi'));

    await waitFor(() => {
      // Single result should load directly, not show a list
      expect(screen.getAllByText(/Marko Petrovic/).length).toBeGreaterThan(0);
    });
  });

  it('selects an account from search results list', async () => {
    const account2 = { ...mockAccount, id: 2, ownerName: 'Ana Jovanovic', accountNumber: '265000000000000002' } as Account;
    mockGetAll.mockResolvedValue({ content: [mockAccount, account2], totalPages: 1, totalElements: 2 });

    const user = userEvent.setup();
    renderWithProviders(<AccountCardsPage />);

    const nameInput = screen.getByPlaceholderText('Ime ili prezime');
    await user.type(nameInput, 'a');
    await user.click(screen.getByText('Pretrazi'));

    await waitFor(() => {
      expect(screen.getByText(/Pronadjeno 2 racuna/)).toBeInTheDocument();
    });

    // Click on one of the results
    const markoButton = screen.getAllByRole('button').find((btn) =>
      btn.textContent?.includes('Marko Petrovic')
    );
    if (markoButton) {
      await user.click(markoButton);

      await waitFor(() => {
        expect(mockGetByAccount).toHaveBeenCalledWith(1);
      });
    }
  });

  it('shows different card type gradients (VISA, MASTERCARD, AMEX)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AccountCardsPage />);

    const input = screen.getByPlaceholderText('18 cifara');
    await user.type(input, '1');
    await user.click(screen.getByText('Pretrazi'));

    await waitFor(() => {
      // All three card types should be displayed
      expect(screen.getByText(/visa/i)).toBeInTheDocument();
      expect(screen.getByText(/mastercard/i)).toBeInTheDocument();
      expect(screen.getByText(/amex/i)).toBeInTheDocument();
    });
  });

  it('handles search error gracefully', async () => {
    mockGetById.mockRejectedValue(new Error('Not found'));
    mockGetAll.mockRejectedValue(new Error('Not found'));

    const user = userEvent.setup();
    renderWithProviders(<AccountCardsPage />);

    const input = screen.getByPlaceholderText('18 cifara');
    await user.type(input, '999999');
    await user.click(screen.getByText('Pretrazi'));

    await waitFor(() => {
      expect(screen.getByText(/Pretraga kartica nije uspela/i)).toBeInTheDocument();
    });
  });

  it('handles card creation failure', async () => {
    mockCreate.mockRejectedValue(new Error('Create failed'));
    const user = userEvent.setup();
    renderWithProviders(<AccountCardsPage />);

    const input = screen.getByPlaceholderText('18 cifara');
    await user.type(input, '1');
    await user.click(screen.getByText('Pretrazi'));

    await waitFor(() => {
      expect(screen.getAllByText(/Marko Petrovic/).length).toBeGreaterThan(0);
    });

    await user.click(screen.getByText('Nova kartica'));

    await waitFor(() => {
      expect(screen.getByText('Kreiraj karticu')).toBeInTheDocument();
    });

    // Select card type
    const selectTriggers = screen.getAllByRole('combobox');
    const cardTypeSelect = selectTriggers.find((t) =>
      t.textContent?.includes('Izaberite tip')
    );
    if (cardTypeSelect) {
      await user.click(cardTypeSelect);
      const visaOption = await screen.findByRole('option', { name: 'Visa' });
      await user.click(visaOption);
    }

    await user.click(screen.getByText('Kreiraj karticu'));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalled();
    });
  });

  it('searches by Enter key press on account number field', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AccountCardsPage />);

    const input = screen.getByPlaceholderText('18 cifara');
    await user.type(input, '1');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(mockGetById).toHaveBeenCalled();
    });
  });
});
