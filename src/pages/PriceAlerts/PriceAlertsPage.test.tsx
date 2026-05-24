import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import PriceAlertsPage from './PriceAlertsPage';
import type { PriceAlertDto } from '@/types/priceAlert';

const mockListMy = vi.fn();
const mockUpdate = vi.fn();
const mockRemove = vi.fn();

vi.mock('@/services/priceAlertService', () => ({
  default: {
    listMy: (...args: unknown[]) => mockListMy(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    remove: (...args: unknown[]) => mockRemove(...args),
    getById: vi.fn(),
    create: vi.fn(),
    listByListing: vi.fn(),
  },
}));

vi.mock('@/lib/notify', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const sampleAlert: PriceAlertDto = {
  id: 1,
  listingId: 100,
  ticker: 'AAPL',
  listingName: 'Apple Inc',
  condition: 'ABOVE',
  threshold: 200,
  currency: 'USD',
  currentPrice: 195,
  status: 'ACTIVE',
  createdAt: '2025-06-01T10:00:00Z',
  triggeredAt: null,
};

function renderPage() {
  return render(
    <MemoryRouter>
      <PriceAlertsPage />
    </MemoryRouter>
  );
}

describe('PriceAlertsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListMy.mockResolvedValue([]);
  });

  it('prikazuje loading skeleton dok se alarmi ucitavaju', () => {
    mockListMy.mockImplementation(() => new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId('price-alerts-loading')).toBeInTheDocument();
  });

  it('prikazuje empty state kada nema alarma', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Nemate cenovnih alarma/i)).toBeInTheDocument();
    });
  });

  it('prikazuje redove alarma u tabeli', async () => {
    mockListMy.mockResolvedValue([sampleAlert]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('alert-row-1')).toBeInTheDocument();
      expect(screen.getByText('Aktivan')).toBeInTheDocument();
    });
  });

  it('filtrira alarme po statusu', async () => {
    const user = userEvent.setup();
    mockListMy.mockResolvedValue([
      sampleAlert,
      { ...sampleAlert, id: 2, ticker: 'MSFT', status: 'TRIGGERED' },
    ]);
    renderPage();
    await waitFor(() => expect(screen.getByText('MSFT')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Okidani/i }));
    expect(screen.queryByText('AAPL')).not.toBeInTheDocument();
  });

  it('onemogucava alarm preko toggle dugmeta', async () => {
    const user = userEvent.setup();
    mockListMy.mockResolvedValue([sampleAlert]);
    mockUpdate.mockResolvedValue({ ...sampleAlert, status: 'DISABLED' });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('toggle-alert-1')).toBeInTheDocument());
    await user.click(screen.getByTestId('toggle-alert-1'));
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(1, { status: 'DISABLED' });
    });
  });

  it('otvara edit dialog', async () => {
    const user = userEvent.setup();
    mockListMy.mockResolvedValue([sampleAlert]);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('edit-alert-1')).toBeInTheDocument());
    await user.click(screen.getByTestId('edit-alert-1'));
    expect(screen.getByTestId('price-alert-dialog')).toBeInTheDocument();
  });

  it('brise alarm nakon potvrde', async () => {
    const user = userEvent.setup();
    mockListMy.mockResolvedValueOnce([sampleAlert]).mockResolvedValue([]);
    mockRemove.mockResolvedValue(undefined);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('delete-alert-1')).toBeInTheDocument());
    await user.click(screen.getByTestId('delete-alert-1'));
    await user.click(screen.getByRole('button', { name: /^Obrisi$/i }));
    await waitFor(() => {
      expect(mockRemove).toHaveBeenCalledWith(1);
    });
  });
});
