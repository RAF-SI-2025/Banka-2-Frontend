import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaxPortalPage from './TaxPortalPage';
import { renderWithProviders } from '../../test/test-utils';
import type { TaxRecord } from '@/types/celina3';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockTaxRecords: TaxRecord[] = [
  {
    id: 1,
    userId: 100,
    userName: 'Marko Petrovic',
    userType: 'CLIENT',
    totalProfit: 50000,
    taxOwed: 7500,
    taxPaid: 5000,
    currency: 'RSD',
  },
  {
    id: 2,
    userId: 200,
    userName: 'Ana Jovanovic',
    userType: 'EMPLOYEE',
    totalProfit: 30000,
    taxOwed: 4500,
    taxPaid: 4500,
    currency: 'EUR',
  },
];

const mockGetTaxRecords = vi.fn().mockResolvedValue(mockTaxRecords);
const mockTriggerCalculation = vi.fn().mockResolvedValue(undefined);
const mockGetTaxBreakdown = vi.fn();

vi.mock('../../services/taxService', () => ({
  default: {
    getTaxRecords: (...args: unknown[]) => mockGetTaxRecords(...args),
    triggerCalculation: (...args: unknown[]) => mockTriggerCalculation(...args),
    getTaxBreakdown: (...args: unknown[]) => mockGetTaxBreakdown(...args),
  },
}));

vi.mock('../../services/currencyService', () => ({
  currencyService: {
    getExchangeRates: vi.fn().mockResolvedValue([
      { currency: 'EUR', middleRate: 117.5 },
      { currency: 'USD', middleRate: 108.0 },
    ]),
  },
}));

describe('TaxPortalPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTaxRecords.mockResolvedValue(mockTaxRecords);
  });

  it('renders the page header', async () => {
    renderWithProviders(<TaxPortalPage />);

    await waitFor(() => {
      expect(screen.getByText('Pracenje poreza')).toBeInTheDocument();
    });
  });

  it('renders user list after loading', async () => {
    renderWithProviders(<TaxPortalPage />);

    await waitFor(() => {
      expect(screen.getByText('Marko Petrovic')).toBeInTheDocument();
    });

    expect(screen.getByText('Ana Jovanovic')).toBeInTheDocument();
  });

  it('renders user type badges', async () => {
    renderWithProviders(<TaxPortalPage />);

    await waitFor(() => {
      expect(screen.getByText('Klijent')).toBeInTheDocument();
    });

    expect(screen.getByText('Aktuar')).toBeInTheDocument();
  });

  it('renders type filter buttons', async () => {
    renderWithProviders(<TaxPortalPage />);

    await waitFor(() => {
      expect(screen.getByText('Svi')).toBeInTheDocument();
    });

    expect(screen.getByText('Klijenti')).toBeInTheDocument();
    expect(screen.getByText('Aktuari')).toBeInTheDocument();
  });

  it('filters by type when clicking CLIENT filter', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TaxPortalPage />);

    await waitFor(() => {
      expect(screen.getByText('Klijenti')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Klijenti'));

    await waitFor(() => {
      expect(mockGetTaxRecords).toHaveBeenCalledWith('CLIENT', undefined);
    });
  });

  it('filters by type when clicking EMPLOYEE filter', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TaxPortalPage />);

    await waitFor(() => {
      expect(screen.getByText('Aktuari')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Aktuari'));

    await waitFor(() => {
      expect(mockGetTaxRecords).toHaveBeenCalledWith('EMPLOYEE', undefined);
    });
  });

  it('renders Calculate button', async () => {
    renderWithProviders(<TaxPortalPage />);

    await waitFor(() => {
      expect(screen.getByText('Izracunaj porez')).toBeInTheDocument();
    });
  });

  it('calls triggerCalculation after confirming in dialog (R1 561 — ConfirmDialog, ne window.confirm)', async () => {
    const user = userEvent.setup();

    renderWithProviders(<TaxPortalPage />);

    await waitFor(() => {
      expect(screen.getByText('Izracunaj porez')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Izracunaj porez'));

    // ConfirmDialog se otvara — potvrdi.
    const confirmBtn = await screen.findByTestId('confirm-dialog-confirm');
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(mockTriggerCalculation).toHaveBeenCalled();
    });
  });

  it('does not trigger calculation when dialog is cancelled', async () => {
    const user = userEvent.setup();

    renderWithProviders(<TaxPortalPage />);

    await waitFor(() => {
      expect(screen.getByText('Izracunaj porez')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Izracunaj porez'));

    // Otkazi (zatvori dialog bez potvrde).
    const cancelBtn = await screen.findByRole('button', { name: 'Otkazi' });
    await user.click(cancelBtn);

    expect(mockTriggerCalculation).not.toHaveBeenCalled();
  });

  it('renders search input', async () => {
    renderWithProviders(<TaxPortalPage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Pretraga po imenu')).toBeInTheDocument();
    });
  });

  it('searches by name with debounce', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TaxPortalPage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Pretraga po imenu')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Pretraga po imenu'), 'Marko');

    await waitFor(() => {
      expect(mockGetTaxRecords).toHaveBeenCalledWith(undefined, 'Marko');
    });
  });

  it('shows loading skeletons while loading', () => {
    mockGetTaxRecords.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<TaxPortalPage />);

    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows empty state when no records', async () => {
    mockGetTaxRecords.mockResolvedValue([]);

    renderWithProviders(<TaxPortalPage />);

    await waitFor(() => {
      expect(screen.getByText('Nema podataka za prikaz')).toBeInTheDocument();
    });
  });

  it('renders table headers', async () => {
    renderWithProviders(<TaxPortalPage />);

    await waitFor(() => {
      expect(screen.getByText('Korisnik')).toBeInTheDocument();
    });

    expect(screen.getByText('Tip')).toBeInTheDocument();
    expect(screen.getByText('Ukupan profit')).toBeInTheDocument();
    expect(screen.getByText('Porez dugovan')).toBeInTheDocument();
    expect(screen.getByText('Porez placen')).toBeInTheDocument();
    expect(screen.getByText('Valuta')).toBeInTheDocument();
    expect(screen.getByText('Dugovanje (RSD)')).toBeInTheDocument();
  });

  it('displays currency column', async () => {
    renderWithProviders(<TaxPortalPage />);

    await waitFor(() => {
      expect(screen.getByText('RSD')).toBeInTheDocument();
    });

    expect(screen.getByText('EUR')).toBeInTheDocument();
  });

  it('shows error alert when loading fails', async () => {
    mockGetTaxRecords.mockRejectedValue(new Error('fail'));

    renderWithProviders(<TaxPortalPage />);

    await waitFor(() => {
      expect(screen.getByText(/Greska pri ucitavanju poreskih podataka/i)).toBeInTheDocument();
    });
  });

  it('renders refresh button', async () => {
    renderWithProviders(<TaxPortalPage />);

    await waitFor(() => {
      expect(screen.getByText('Osvezi')).toBeInTheDocument();
    });
  });

  // ---------- Tax detail view (Celina 3 spec ~525) ----------

  it('opens detail dialog when clicking a tax row', async () => {
    const user = userEvent.setup();
    mockGetTaxBreakdown.mockResolvedValue({
      userId: 100,
      userType: 'CLIENT',
      userName: 'Marko Petrovic',
      year: 2026,
      month: 5,
      totalProfit: 50000,
      totalTax: 7500,
      items: [
        {
          orderId: 11,
          listingTicker: 'AAPL',
          listingType: 'STOCK',
          source: 'STOCK_ORDER',
          quantity: 10,
          buyPrice: 150,
          sellPrice: 200,
          profit: 500,
          taxAmount: 75,
          currency: 'USD',
          executedAt: '2026-04-15T10:00:00Z',
        },
      ],
    });

    renderWithProviders(<TaxPortalPage />);

    await waitFor(() => {
      expect(screen.getByText('Marko Petrovic')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('tax-row-CLIENT-100'));

    await waitFor(() => {
      expect(screen.getByText(/Detalji poreza · Marko Petrovic/i)).toBeInTheDocument();
    });

    // Verifikuj da je service pozvan sa pravim argumentima
    expect(mockGetTaxBreakdown).toHaveBeenCalledWith(100, 'CLIENT');

    // Item appears in table (await loading complete)
    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument();
    });
  });

  it('shows graceful unavailable placeholder when BE returns 404', async () => {
    const user = userEvent.setup();
    mockGetTaxBreakdown.mockRejectedValue({
      response: { status: 404 },
    });

    renderWithProviders(<TaxPortalPage />);

    await waitFor(() => {
      expect(screen.getByText('Marko Petrovic')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('tax-row-CLIENT-100'));

    await waitFor(() => {
      expect(screen.getByTestId('tax-detail-unavailable')).toBeInTheDocument();
    });
  });

  it('shows error alert when BE returns 500', async () => {
    const user = userEvent.setup();
    mockGetTaxBreakdown.mockRejectedValue({
      response: { status: 500 },
    });

    renderWithProviders(<TaxPortalPage />);

    await waitFor(() => {
      expect(screen.getByText('Marko Petrovic')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('tax-row-CLIENT-100'));

    await waitFor(() => {
      expect(screen.getByTestId('tax-detail-error')).toBeInTheDocument();
    });
  });

  // TEST-fe-xcut-3: pored 404, dialog tretira i 501 (Not Implemented) kao
  // "unavailable" placeholder (ne kao hard error) — BE jos nije implementirao
  // /tax/{userId}/details endpoint.
  it('shows graceful unavailable placeholder when BE returns 501 (not implemented)', async () => {
    const user = userEvent.setup();
    mockGetTaxBreakdown.mockRejectedValue({
      response: { status: 501 },
    });

    renderWithProviders(<TaxPortalPage />);

    await waitFor(() => {
      expect(screen.getByText('Marko Petrovic')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('tax-row-CLIENT-100'));

    await waitFor(() => {
      expect(screen.getByTestId('tax-detail-unavailable')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('tax-detail-error')).not.toBeInTheDocument();
  });
});
