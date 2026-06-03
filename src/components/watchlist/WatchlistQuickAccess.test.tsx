import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WatchlistQuickAccess from './WatchlistQuickAccess';
import { watchlistService } from '../../services/watchlistService';
import type { WatchlistDto, WatchlistItemDto } from '../../types/watchlist';

vi.mock('../../services/watchlistService', () => ({
  watchlistService: {
    listMyWatchlists: vi.fn(),
    listItems: vi.fn(),
  },
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, email: 'k@b.rs', firstName: 'K', lastName: 'L', role: 'CLIENT' },
  }),
}));

const mockList = vi.mocked(watchlistService.listMyWatchlists);
const mockItems = vi.mocked(watchlistService.listItems);

const wl1: WatchlistDto = {
  id: 1,
  ownerId: 10,
  ownerType: 'CLIENT',
  name: 'Favoriti',
  createdAt: '2026-05-25T10:00:00Z',
};

const items: WatchlistItemDto[] = [
  {
    id: 10,
    watchlistId: 1,
    listingId: 100,
    listingTicker: 'AAPL',
    listingType: 'STOCK',
    currentPrice: 180,
    dailyChangePercent: 1.25,
    addedAt: '2026-05-25T10:00:00Z',
  },
  {
    id: 11,
    watchlistId: 1,
    listingId: 101,
    listingTicker: 'MSFT',
    listingType: 'STOCK',
    currentPrice: 410,
    dailyChangePercent: -0.5,
    addedAt: '2026-05-25T10:00:00Z',
  },
];

function renderWidget() {
  return render(
    <MemoryRouter>
      <WatchlistQuickAccess />
    </MemoryRouter>
  );
}

describe('WatchlistQuickAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renderuje loading skeleton inicijalno', () => {
    mockList.mockImplementation(() => new Promise(() => {}));
    renderWidget();
    expect(screen.getByTestId('watchlist-quick-access-loading')).toBeTruthy();
  });

  it('renderuje empty state ako nema lista', async () => {
    mockList.mockResolvedValue([]);
    renderWidget();
    await waitFor(() => {
      expect(screen.getByText(/Nemate pracene hartije/i)).toBeTruthy();
    });
  });

  it('renderuje listu stavki sa cenama i procentima', async () => {
    mockList.mockResolvedValue([wl1]);
    mockItems.mockResolvedValue(items);
    renderWidget();
    await waitFor(() => {
      expect(screen.getByTestId('quick-access-item-AAPL')).toBeTruthy();
      expect(screen.getByTestId('quick-access-item-MSFT')).toBeTruthy();
      expect(screen.getByTestId('quick-access-price-AAPL')).toBeTruthy();
    });
  });

  // Bug 5: ticker (a ne samo cena) mora biti vidljivo prikazan u sidebar widget-u.
  it('prikazuje ticker tekst stavke (ne samo iznos)', async () => {
    mockList.mockResolvedValue([wl1]);
    mockItems.mockResolvedValue(items);
    renderWidget();
    await waitFor(() => {
      expect(screen.getByTestId('quick-access-item-AAPL')).toBeTruthy();
    });
    // Ticker tekst je vidljiv unutar stavke (ranije ga je truncate/grid gusio).
    const aaplItem = screen.getByTestId('quick-access-item-AAPL');
    expect(aaplItem).toHaveTextContent('AAPL');
    const msftItem = screen.getByTestId('quick-access-item-MSFT');
    expect(msftItem).toHaveTextContent('MSFT');
  });

  it('renderuje "Sve" CTA link', async () => {
    mockList.mockResolvedValue([]);
    renderWidget();
    await waitFor(() => {
      expect(screen.getByTestId('watchlist-quick-access-all')).toBeTruthy();
    });
  });

  it('inicijalni fetch poziva listMyWatchlists + listItems', async () => {
    mockList.mockResolvedValue([wl1]);
    mockItems.mockResolvedValue(items);
    renderWidget();
    await waitFor(() => {
      expect(mockList).toHaveBeenCalled();
      expect(mockItems).toHaveBeenCalledWith(1);
    });
  });

  it('limitira na 8 stavki', async () => {
    const many: WatchlistItemDto[] = Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      watchlistId: 1,
      listingId: 100 + i,
      listingTicker: `TICK${i}`,
      listingType: 'STOCK',
      currentPrice: 100,
      addedAt: '2026-05-25T10:00:00Z',
    }));
    mockList.mockResolvedValue([wl1]);
    mockItems.mockResolvedValue(many);
    renderWidget();
    await waitFor(() => {
      expect(screen.getByTestId('quick-access-item-TICK0')).toBeTruthy();
    });
    // 9th item should NOT be present (only first 8)
    expect(screen.queryByTestId('quick-access-item-TICK8')).toBeNull();
  });
});
