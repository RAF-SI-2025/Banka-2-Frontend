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

  // ---------------------------------------------------------------------------
  // R1-553 / TEST-fe-banking-6: normalizeExchangeRates ne sme TIHO da odbaci
  // nepoznatu valutu — schema drift mora biti vidljiv (console.warn) tako da se
  // Currency enum azurira, a ne da valuta samo "nestane" iz tabele bez traga.
  // ---------------------------------------------------------------------------

  it('warns (console.warn) and drops an unsupported currency from the rate list (R1-553)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // BE vraca i "XYZ" koju FE Currency enum NE poznaje.
    mockCurrencyService.getExchangeRates.mockResolvedValue([
      mockExchangeRate({ currency: 'RSD', buyRate: 1, sellRate: 1, middleRate: 1 }),
      mockExchangeRate({ currency: 'EUR', buyRate: 116.5, sellRate: 118.5, middleRate: 117.5 }),
      mockExchangeRate({ currency: 'XYZ', buyRate: 7, sellRate: 8, middleRate: 7.5 }),
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('EUR').length).toBeGreaterThan(0);
    });

    // Schema drift je SURFACE-ovan kroz console.warn, sa imenom odbacene valute.
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('XYZ')
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringMatching(/Odbacene nepodrzane valute/i)
    );

    // Nepodrzana valuta NIJE u kursnoj listi (nije se "tiho provukla").
    // Kartica koristi rate.currency kao tekst — "XYZ" se ne sme renderovati.
    expect(screen.queryByText('XYZ')).not.toBeInTheDocument();

    warnSpy.mockRestore();
  });

  it('does NOT warn when every returned currency is supported (no false-positive drift log)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Sve valute su podrzane — nema drift-a, nema warn-a.
    mockCurrencyService.getExchangeRates.mockResolvedValue([
      mockExchangeRate({ currency: 'RSD', buyRate: 1, sellRate: 1, middleRate: 1 }),
      mockExchangeRate({ currency: 'EUR', buyRate: 116.5, sellRate: 118.5, middleRate: 117.5 }),
      mockExchangeRate({ currency: 'USD', buyRate: 106, sellRate: 110, middleRate: 108 }),
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('USD').length).toBeGreaterThan(0);
    });

    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringMatching(/Odbacene nepodrzane valute/i)
    );

    warnSpy.mockRestore();
  });

  // R1-553: kad BE NE vrati RSD, normalize ubacuje sinteticki RSD baseline (1:1)
  // tako da kalkulator uvek ima referentnu valutu. Pin-ujemo da se RSD pojavi
  // iako ga BE nije poslao.
  it('injects a synthetic RSD baseline row when BE omits RSD', async () => {
    mockCurrencyService.getExchangeRates.mockResolvedValue([
      mockExchangeRate({ currency: 'EUR', buyRate: 116.5, sellRate: 118.5, middleRate: 117.5 }),
      mockExchangeRate({ currency: 'USD', buyRate: 106, sellRate: 110, middleRate: 108 }),
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('EUR').length).toBeGreaterThan(0);
    });

    // RSD se pojavljuje u kursnoj listi (kao i u kalkulator selektorima) iako
    // ga BE nije vratio — sinteticki baseline.
    expect(screen.getAllByText('RSD').length).toBeGreaterThan(0);
  });
});
