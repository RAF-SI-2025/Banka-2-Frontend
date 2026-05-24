import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import WatchlistPage from './WatchlistPage';
import type { WatchlistItemDto } from '@/types/watchlist';

const mockListAll = vi.fn();
const mockListItems = vi.fn();
const mockCreate = vi.fn();
const mockRename = vi.fn();
const mockRemove = vi.fn();
const mockRemoveItem = vi.fn();

vi.mock('@/services/watchlistService', () => ({
  default: {
    listAll: (...args: unknown[]) => mockListAll(...args),
    listItems: (...args: unknown[]) => mockListItems(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    rename: (...args: unknown[]) => mockRename(...args),
    remove: (...args: unknown[]) => mockRemove(...args),
    removeItem: (...args: unknown[]) => mockRemoveItem(...args),
    getById: vi.fn(),
    addItem: vi.fn(),
    moveItem: vi.fn(),
    fetchMarketSnapshot: vi.fn(),
  },
}));

vi.mock('@/lib/notify', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const stockItem: WatchlistItemDto = {
  id: 10,
  watchlistId: 1,
  listingId: 100,
  ticker: 'AAPL',
  name: 'Apple Inc',
  exchange: 'NASDAQ',
  listingType: 'STOCK',
  currentPrice: 150,
  priceChange: 1,
  priceChangePct: 0.5,
  volume: 1000,
  currency: 'USD',
  addedAt: '',
};

const futureItem: WatchlistItemDto = {
  id: 11,
  watchlistId: 1,
  listingId: 200,
  ticker: 'ES',
  name: 'E-mini S&P',
  exchange: 'CME',
  listingType: 'FUTURE',
  currentPrice: 5000,
  priceChange: -10,
  priceChangePct: -0.2,
  volume: 500,
  currency: 'USD',
  addedAt: '',
};

function renderPage() {
  return render(
    <MemoryRouter>
      <WatchlistPage />
    </MemoryRouter>
  );
}

describe('WatchlistPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListAll.mockResolvedValue([]);
    mockListItems.mockResolvedValue([]);
  });

  it('prikazuje loading skeleton dok se liste ucitavaju', () => {
    mockListAll.mockImplementation(() => new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId('watchlist-lists-loading')).toBeInTheDocument();
  });

  it('prikazuje empty state kada korisnik nema lista', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Nemate watchlista/i)).toBeInTheDocument();
    });
  });

  it('prikazuje kartice za svaku watchlistu', async () => {
    mockListAll.mockResolvedValue([{ id: 1, name: 'Favoriti', itemCount: 3, createdAt: '', updatedAt: '' }]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('watchlist-card-1')).toBeInTheDocument();
    });
  });

  it('klik na Nova lista dugme otvara dialog', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByTestId('create-watchlist-btn')).toBeInTheDocument());
    await user.click(screen.getByTestId('create-watchlist-btn'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('kreira novu listu i osvezava prikaz', async () => {
    const user = userEvent.setup();
    mockListAll.mockResolvedValueOnce([]).mockResolvedValue([
      { id: 2, name: 'Nova', itemCount: 0, createdAt: '', updatedAt: '' },
    ]);
    mockCreate.mockResolvedValue({ id: 2, name: 'Nova', itemCount: 0, createdAt: '', updatedAt: '' });
    renderPage();
    await user.click(screen.getByTestId('create-watchlist-btn'));
    await user.type(screen.getByLabelText(/Naziv/i), 'Nova');
    await user.click(screen.getByRole('button', { name: /Kreiraj/i }));
    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({ name: 'Nova' });
      expect(screen.getByTestId('watchlist-card-2')).toBeInTheDocument();
    });
  });

  it('otvara dialog za preimenovanje i poziva rename', async () => {
    const user = userEvent.setup();
    mockListAll
      .mockResolvedValueOnce([{ id: 1, name: 'Favoriti', itemCount: 0, createdAt: '', updatedAt: '' }])
      .mockResolvedValue([{ id: 1, name: 'Moji favoriti', itemCount: 0, createdAt: '', updatedAt: '' }]);
    mockRename.mockResolvedValue({ id: 1, name: 'Moji favoriti', itemCount: 0, createdAt: '', updatedAt: '' });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('rename-watchlist-1')).toBeInTheDocument());
    await user.click(screen.getByTestId('rename-watchlist-1'));
    const input = screen.getByLabelText(/Naziv/i);
    expect(input).toHaveValue('Favoriti');
    await user.clear(input);
    await user.type(input, 'Moji favoriti');
    await user.click(screen.getByRole('button', { name: /Sacuvaj/i }));
    await waitFor(() => {
      expect(mockRename).toHaveBeenCalledWith(1, { name: 'Moji favoriti' });
    });
  });

  it('brise listu nakon potvrde u dialogu', async () => {
    const user = userEvent.setup();
    mockListAll.mockResolvedValueOnce([{ id: 1, name: 'Favoriti', itemCount: 0, createdAt: '', updatedAt: '' }]).mockResolvedValue([]);
    mockRemove.mockResolvedValue(undefined);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('delete-watchlist-1')).toBeInTheDocument());
    await user.click(screen.getByTestId('delete-watchlist-1'));
    await user.click(screen.getByRole('button', { name: /^Obrisi$/i }));
    await waitFor(() => {
      expect(mockRemove).toHaveBeenCalledWith(1);
      expect(screen.getByText(/Nemate watchlista/i)).toBeInTheDocument();
    });
  });

  it('prikazuje stavke izabrane liste u tabeli', async () => {
    mockListAll.mockResolvedValue([{ id: 1, name: 'Favoriti', itemCount: 2, createdAt: '', updatedAt: '' }]);
    mockListItems.mockResolvedValue([stockItem, futureItem]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('watchlist-item-row-10')).toBeInTheDocument();
      expect(screen.getByText('AAPL')).toBeInTheDocument();
    });
  });

  it('uklanja stavku iz liste', async () => {
    const user = userEvent.setup();
    mockListAll.mockResolvedValue([{ id: 1, name: 'Favoriti', itemCount: 2, createdAt: '', updatedAt: '' }]);
    mockListItems
      .mockResolvedValueOnce([stockItem, futureItem])
      .mockResolvedValue([futureItem]);
    mockRemoveItem.mockResolvedValue(undefined);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('remove-item-10')).toBeInTheDocument());
    await user.click(screen.getByTestId('remove-item-10'));
    await waitFor(() => {
      expect(mockRemoveItem).toHaveBeenCalledWith(1, 10);
      expect(screen.queryByText('AAPL')).not.toBeInTheDocument();
    });
  });

  it('filtrira stavke po tipu hartije', async () => {
    const user = userEvent.setup();
    mockListAll.mockResolvedValue([{ id: 1, name: 'Favoriti', itemCount: 2, createdAt: '', updatedAt: '' }]);
    mockListItems.mockResolvedValue([stockItem, futureItem]);
    renderPage();
    await waitFor(() => expect(screen.getByText('AAPL')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Fjucersi/i }));
    expect(screen.queryByText('AAPL')).not.toBeInTheDocument();
    expect(screen.getByText('ES')).toBeInTheDocument();
  });
});
