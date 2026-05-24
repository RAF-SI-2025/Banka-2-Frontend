import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from './api';
import { watchlistService } from './watchlistService';

vi.mock('./api');
const mockedApi = vi.mocked(api);

describe('watchlistService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listAll salje GET /watchlists i vraca niz lista', async () => {
    mockedApi.get.mockResolvedValue({ data: [{ id: 1, name: 'Favoriti', itemCount: 0, createdAt: '', updatedAt: '' }] });
    const result = await watchlistService.listAll();
    expect(mockedApi.get).toHaveBeenCalledWith('/watchlists');
    expect(result).toHaveLength(1);
  });

  it('getById salje GET /watchlists/:id', async () => {
    mockedApi.get.mockResolvedValue({ data: { id: 5, name: 'X', itemCount: 0, createdAt: '', updatedAt: '' } });
    await watchlistService.getById(5);
    expect(mockedApi.get).toHaveBeenCalledWith('/watchlists/5');
  });

  it('create salje POST /watchlists sa name i description', async () => {
    const dto = { name: 'Nova', description: 'Opis' };
    mockedApi.post.mockResolvedValue({ data: { id: 3, ...dto, itemCount: 0, createdAt: '', updatedAt: '' } });
    await watchlistService.create(dto);
    expect(mockedApi.post).toHaveBeenCalledWith('/watchlists', dto);
  });

  it('rename salje PATCH /watchlists/:id sa novim imenom', async () => {
    mockedApi.patch.mockResolvedValue({ data: { id: 1, name: 'Novo ime', itemCount: 0, createdAt: '', updatedAt: '' } });
    await watchlistService.rename(1, { name: 'Novo ime' });
    expect(mockedApi.patch).toHaveBeenCalledWith('/watchlists/1', { name: 'Novo ime' });
  });

  it('remove salje DELETE /watchlists/:id', async () => {
    mockedApi.delete.mockResolvedValue({ data: undefined });
    await watchlistService.remove(2);
    expect(mockedApi.delete).toHaveBeenCalledWith('/watchlists/2');
  });

  it('listItems salje GET /watchlists/:id/items', async () => {
    mockedApi.get.mockResolvedValue({ data: [] });
    await watchlistService.listItems(7);
    expect(mockedApi.get).toHaveBeenCalledWith('/watchlists/7/items');
  });

  it('addItem salje POST /watchlists/:id/items sa listingId', async () => {
    const dto = { listingId: 42 };
    mockedApi.post.mockResolvedValue({
      data: { id: 100, watchlistId: 7, listingId: 42, ticker: 'AAPL', name: 'Apple', exchange: 'NASDAQ', listingType: 'STOCK', currentPrice: 1, priceChange: 0, priceChangePct: 0, volume: 0, currency: 'USD', addedAt: '' },
    });
    await watchlistService.addItem(7, dto);
    expect(mockedApi.post).toHaveBeenCalledWith('/watchlists/7/items', dto);
  });

  it('removeItem salje DELETE /watchlists/:id/items/:itemId', async () => {
    mockedApi.delete.mockResolvedValue({ data: undefined });
    await watchlistService.removeItem(7, 100);
    expect(mockedApi.delete).toHaveBeenCalledWith('/watchlists/7/items/100');
  });

  it('moveItem salje POST /watchlists/:id/items/:itemId/move sa targetWatchlistId', async () => {
    mockedApi.post.mockResolvedValue({
      data: { id: 100, watchlistId: 9, listingId: 1, ticker: 'X', name: 'X', exchange: 'X', listingType: 'STOCK', currentPrice: 1, priceChange: 0, priceChangePct: 0, volume: 0, currency: 'USD', addedAt: '' },
    });
    await watchlistService.moveItem(7, 100, 9);
    expect(mockedApi.post).toHaveBeenCalledWith('/watchlists/7/items/100/move', { targetWatchlistId: 9 });
  });

  it('fetchMarketSnapshot salje POST /watchlists/market-snapshot sa nizom listingIds', async () => {
    mockedApi.post.mockResolvedValue({ data: [{ listingId: 1, currentPrice: 150 }] });
    await watchlistService.fetchMarketSnapshot([1, 2, 3]);
    expect(mockedApi.post).toHaveBeenCalledWith('/watchlists/market-snapshot', { listingIds: [1, 2, 3] });
  });
});
