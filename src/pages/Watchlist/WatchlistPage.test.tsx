// ============================================================
// FE2 - Watchlist + cenovni alarmi | Developer: Antonije Ilic
// Vitest unit testovi za WatchlistPage.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import WatchlistPage from './WatchlistPage';
import { watchlistService } from '../../services/watchlistService';
import type { WatchlistDto, WatchlistItemDto } from '../../types/watchlist';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../services/watchlistService', () => ({
  watchlistService: {
    listMyWatchlists: vi.fn(),
    createWatchlist: vi.fn(),
    renameWatchlist: vi.fn(),
    deleteWatchlist: vi.fn(),
    listItems: vi.fn(),
    addItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock('@/lib/notify', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

const mockListAll = vi.mocked(watchlistService.listMyWatchlists);
const mockListItems = vi.mocked(watchlistService.listItems);
const mockCreate = vi.mocked(watchlistService.createWatchlist);
const mockRename = vi.mocked(watchlistService.renameWatchlist);
const mockDelete = vi.mocked(watchlistService.deleteWatchlist);
const mockRemoveItem = vi.mocked(watchlistService.removeItem);

const sampleList: WatchlistDto = {
  id: 1,
  ownerId: 10,
  ownerType: 'CLIENT',
  name: 'Favoriti',
  createdAt: '2026-05-25T10:00:00Z',
  itemCount: 1,
};

const sampleItemStock: WatchlistItemDto = {
  id: 10,
  watchlistId: 1,
  listingId: 100,
  listingTicker: 'AAPL',
  listingType: 'STOCK',
  currentPrice: 180,
  dailyChangePercent: 1.25,
  volume: 1_000_000,
  addedAt: '2026-05-25T10:00:00Z',
};

const sampleItemFutures: WatchlistItemDto = {
  id: 11,
  watchlistId: 1,
  listingId: 101,
  listingTicker: 'CL_F',
  listingType: 'FUTURES',
  currentPrice: 75,
  addedAt: '2026-05-25T10:00:00Z',
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
    mockListItems.mockResolvedValue([]);
  });

  it('prikazuje empty state kada korisnik nema lista', async () => {
    mockListAll.mockResolvedValue([]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Nemate watchlist-a/i)).toBeTruthy();
    });
  });

  it('prikazuje kartice za svaku watchlistu', async () => {
    mockListAll.mockResolvedValue([sampleList]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('watchlist-card-1')).toBeTruthy();
      expect(screen.getAllByText('Favoriti').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('klik na "Nova lista" otvara dialog', async () => {
    const user = userEvent.setup();
    mockListAll.mockResolvedValue([]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('create-watchlist-btn')).toBeTruthy();
    });
    await user.click(screen.getByTestId('create-watchlist-btn'));
    expect(screen.getByTestId('create-watchlist-dialog')).toBeTruthy();
  });

  it('kreira novu listu', async () => {
    const user = userEvent.setup();
    mockListAll.mockResolvedValueOnce([]);
    mockCreate.mockResolvedValue({ ...sampleList, id: 2, name: 'Nova' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('create-watchlist-btn')).toBeTruthy();
    });
    await user.click(screen.getByTestId('create-watchlist-btn'));
    await user.type(screen.getByTestId('create-watchlist-input'), 'Nova');
    await user.click(screen.getByTestId('create-watchlist-submit'));
    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({ name: 'Nova' });
    });
  });

  it('preimenuj otvara dialog sa trenutnim imenom', async () => {
    const user = userEvent.setup();
    mockListAll.mockResolvedValue([sampleList]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('rename-watchlist-1')).toBeTruthy();
    });
    await user.click(screen.getByTestId('rename-watchlist-1'));
    const input = screen.getByTestId('rename-watchlist-input') as HTMLInputElement;
    expect(input.value).toBe('Favoriti');
  });

  it('brisanje liste poziva delete i uklanja karticu', async () => {
    const user = userEvent.setup();
    mockListAll.mockResolvedValue([sampleList]);
    mockDelete.mockResolvedValue(undefined);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('delete-watchlist-1')).toBeTruthy();
    });
    await user.click(screen.getByTestId('delete-watchlist-1'));
    await waitFor(() => {
      expect(screen.getByTestId('confirm-delete-watchlist')).toBeTruthy();
    });
    await user.click(screen.getByTestId('confirm-delete-watchlist'));
    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith(1);
    });
  });

  it('prikazuje stavke izabrane liste', async () => {
    mockListAll.mockResolvedValue([sampleList]);
    mockListItems.mockResolvedValue([sampleItemStock]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('watchlist-item-row-10')).toBeTruthy();
      expect(screen.getByText('AAPL')).toBeTruthy();
    });
  });

  it('uklanjanje stavke poziva removeItem', async () => {
    const user = userEvent.setup();
    mockListAll.mockResolvedValue([sampleList]);
    mockListItems.mockResolvedValue([sampleItemStock]);
    mockRemoveItem.mockResolvedValue(undefined);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('remove-item-10')).toBeTruthy();
    });
    await user.click(screen.getByTestId('remove-item-10'));
    await waitFor(() => {
      // P1-fe-contracts-1: BE brise po listingId (100), ne po item PK (10).
      expect(mockRemoveItem).toHaveBeenCalledWith(1, 100);
    });
  });

  // R1 854: badge `itemCount` se optimisticki dekrementira posle uklanjanja
  // (1 stavka -> 0 stavki), bez refetch-a cele liste.
  it('optimisticki azurira itemCount badge posle uklanjanja stavke', async () => {
    const user = userEvent.setup();
    mockListAll.mockResolvedValue([{ ...sampleList, itemCount: 1 }]);
    mockListItems.mockResolvedValue([sampleItemStock]);
    mockRemoveItem.mockResolvedValue(undefined);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('remove-item-10')).toBeTruthy();
    });
    expect(screen.getByText(/1 stavka/i)).toBeTruthy();
    await user.click(screen.getByTestId('remove-item-10'));
    await waitFor(() => {
      expect(screen.getByText(/0 stavki/i)).toBeTruthy();
    });
  });

  it('filter po tipu hartije prikazuje samo odgovarajuce stavke', async () => {
    const user = userEvent.setup();
    mockListAll.mockResolvedValue([sampleList]);
    mockListItems.mockResolvedValue([sampleItemStock, sampleItemFutures]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeTruthy();
      expect(screen.getByText('CL_F')).toBeTruthy();
    });
    await user.click(screen.getByTestId('watchlist-filter-stock'));
    await waitFor(() => {
      expect(screen.queryByText('CL_F')).toBeNull();
      expect(screen.getByText('AAPL')).toBeTruthy();
    });
  });

  it('rename salje patch sa novim imenom', async () => {
    const user = userEvent.setup();
    mockListAll.mockResolvedValue([sampleList]);
    mockRename.mockResolvedValue({ ...sampleList, name: 'Novo ime' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('rename-watchlist-1')).toBeTruthy();
    });
    await user.click(screen.getByTestId('rename-watchlist-1'));
    const input = screen.getByTestId('rename-watchlist-input') as HTMLInputElement;
    await user.clear(input);
    await user.type(input, 'Novo ime');
    // Find the save button in rename dialog
    const dialog = screen.getByTestId('rename-watchlist-dialog');
    const saveBtn = Array.from(dialog.querySelectorAll('button')).find(
      (b) => b.textContent === 'Sacuvaj'
    );
    expect(saveBtn).toBeTruthy();
    await user.click(saveBtn!);
    await waitFor(() => {
      expect(mockRename).toHaveBeenCalledWith(1, { name: 'Novo ime' });
    });
  });

  // ===========================================================================
  // TEST-fe-xcut-1 (R1-234/235): item.id-as-listingId contract kroz UI.
  // BE ruta `/watchlists/{id}/items/{listingId}` brise po listingId, NE po item
  // PK. Trgovina takodje koristi listingId. Sa item gde id != listingId pinujemo
  // da UI nigde ne meša ta dva polja (regresija bi npr. slala item.id na BE).
  // ===========================================================================

  // item gde id (PK) i listingId namerno DIVERGIRAJU radi otkrivanja zamene.
  const itemWithDistinctIds: WatchlistItemDto = {
    id: 999, // item PK
    watchlistId: 1,
    listingId: 333, // listing id (razlicit)
    listingTicker: 'TSLA',
    listingType: 'STOCK',
    currentPrice: 250,
    dailyChangePercent: -0.5,
    volume: 5_000_000,
    addedAt: '2026-05-25T10:00:00Z',
  };

  it('remove uses item.listingId (not the item PK) even when they differ', async () => {
    const user = userEvent.setup();
    mockListAll.mockResolvedValue([sampleList]);
    mockListItems.mockResolvedValue([itemWithDistinctIds]);
    mockRemoveItem.mockResolvedValue(undefined);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('remove-item-999')).toBeTruthy();
    });
    await user.click(screen.getByTestId('remove-item-999'));
    await waitFor(() => {
      // listingId (333), ne item PK (999).
      expect(mockRemoveItem).toHaveBeenCalledWith(1, 333);
    });
    expect(mockRemoveItem).not.toHaveBeenCalledWith(1, 999);
  });

  it('Trguj navigates to order page using item.listingId (not the item PK)', async () => {
    const user = userEvent.setup();
    mockListAll.mockResolvedValue([sampleList]);
    mockListItems.mockResolvedValue([itemWithDistinctIds]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByLabelText('Trguj TSLA')).toBeTruthy();
    });
    await user.click(screen.getByLabelText('Trguj TSLA'));
    // /orders/new?listingId=333 — listingId, ne item PK.
    expect(mockNavigate).toHaveBeenCalledWith('/orders/new?listingId=333');
    expect(mockNavigate).not.toHaveBeenCalledWith('/orders/new?listingId=999');
  });
});
