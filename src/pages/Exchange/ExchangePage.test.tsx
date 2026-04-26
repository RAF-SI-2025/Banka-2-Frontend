import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ExchangePage from './ExchangePage';
import { mockExchangeRate } from '@/test/helpers';

// ---------- Mocks ----------

vi.mock('@/services/currencyService', () => ({
  currencyService: {
    getExchangeRates: vi.fn(),
    convert: vi.fn(),
  },
}));

import { currencyService } from '@/services/currencyService';

const mockCurrencyService = vi.mocked(currencyService);

const rates = [
  mockExchangeRate({ currency: 'RSD', buyRate: 1, sellRate: 1, middleRate: 1 }),
  mockExchangeRate({ currency: 'EUR', buyRate: 116.5, sellRate: 118.5, middleRate: 117.5 }),
  mockExchangeRate({ currency: 'USD', buyRate: 106.0, sellRate: 110.0, middleRate: 108.0 }),
  mockExchangeRate({ currency: 'CHF', buyRate: 120.0, sellRate: 124.0, middleRate: 122.0 }),
  mockExchangeRate({ currency: 'GBP', buyRate: 135.0, sellRate: 139.0, middleRate: 137.0 }),
];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/exchange']}>
      <ExchangePage />
    </MemoryRouter>
  );
}

describe('ExchangePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrencyService.getExchangeRates.mockResolvedValue(rates);
    mockCurrencyService.convert.mockResolvedValue({
      convertedAmount: 11750,
      exchangeRate: 117.5,
    });
  });

  it('renders page header', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Menjacnica/i)).toBeInTheDocument();
    });
  });

  it('renders exchange rate list', async () => {
    renderPage();

    await waitFor(() => {
      // EUR appears in both the rate list and the currency selector
      expect(screen.getAllByText('EUR').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('USD').length).toBeGreaterThan(0);
    expect(screen.getAllByText('CHF').length).toBeGreaterThan(0);
    expect(screen.getAllByText('GBP').length).toBeGreaterThan(0);
  });

  it('displays buy, middle, and sell rates', async () => {
    renderPage();

    // findAllByText polls until elements appear — sprecava CI flake kad render
    // jos nije zavrsen kad se cita DOM (lokalno radi, CI sporiji).
    const buyHeaders = await screen.findAllByText(/Kupovni/i);
    expect(buyHeaders.length).toBeGreaterThan(0);

    const middleHeaders = await screen.findAllByText(/Srednji/i);
    expect(middleHeaders.length).toBeGreaterThan(0);

    const sellHeaders = await screen.findAllByText(/Prodajni/i);
    expect(sellHeaders.length).toBeGreaterThan(0);
  });

  it('renders calculator form', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Kalkulator/i)).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/Iznos/i)).toBeInTheDocument();
  });

  it('performs conversion on form submit', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Iznos/i)).toBeInTheDocument();
    });

    const amountInput = screen.getByLabelText(/Iznos/i);
    await user.clear(amountInput);
    await user.type(amountInput, '100');

    // Submit the conversion form
    const convertBtn = screen.getByRole('button', { name: /Izracunaj|Konvertuj|Preracunaj/i });
    await user.click(convertBtn);

    await waitFor(() => {
      expect(mockCurrencyService.convert).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 100 })
      );
    });
  });

  it('shows conversion result', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Iznos/i)).toBeInTheDocument();
    });

    const amountInput = screen.getByLabelText(/Iznos/i);
    await user.clear(amountInput);
    await user.type(amountInput, '100');

    const convertBtn = screen.getByRole('button', { name: /Izracunaj|Konvertuj|Preracunaj/i });
    await user.click(convertBtn);

    await waitFor(() => {
      // Should display the converted amount
      expect(screen.getByText(/11.*750/)).toBeInTheDocument();
    });
  });

  it('shows empty state when no rates available', async () => {
    // normalizeExchangeRates([]) still produces a synthetic RSD entry,
    // so we need the service to throw to get a truly empty rate list
    mockCurrencyService.getExchangeRates.mockRejectedValue(new Error('fail'));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Nema dostupnih kurseva/i)).toBeInTheDocument();
    });
  });

  it('shows loading skeleton initially', () => {
    mockCurrencyService.getExchangeRates.mockImplementation(() => new Promise(() => {}));

    renderPage();

    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders kursna lista section title', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Kursna lista/i)).toBeInTheDocument();
    });
  });
});
