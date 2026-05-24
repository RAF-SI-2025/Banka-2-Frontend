import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from './api';
import { priceAlertService } from './priceAlertService';

vi.mock('./api');
const mockedApi = vi.mocked(api);

const sampleAlert = {
  id: 1,
  listingId: 42,
  ticker: 'AAPL',
  listingName: 'Apple Inc',
  condition: 'ABOVE' as const,
  threshold: 200,
  currency: 'USD',
  currentPrice: 195,
  status: 'ACTIVE' as const,
  createdAt: '2025-01-01T00:00:00Z',
  triggeredAt: null,
};

describe('priceAlertService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listMy salje GET /price-alerts/my', async () => {
    mockedApi.get.mockResolvedValue({ data: [sampleAlert] });
    const result = await priceAlertService.listMy();
    expect(mockedApi.get).toHaveBeenCalledWith('/price-alerts/my');
    expect(result).toHaveLength(1);
  });

  it('getById salje GET /price-alerts/:id', async () => {
    mockedApi.get.mockResolvedValue({ data: sampleAlert });
    await priceAlertService.getById(1);
    expect(mockedApi.get).toHaveBeenCalledWith('/price-alerts/1');
  });

  it('create salje POST /price-alerts', async () => {
    const dto = { listingId: 42, condition: 'BELOW' as const, threshold: 150, note: 'test' };
    mockedApi.post.mockResolvedValue({ data: { ...sampleAlert, ...dto, id: 2 } });
    await priceAlertService.create(dto);
    expect(mockedApi.post).toHaveBeenCalledWith('/price-alerts', dto);
  });

  it('update salje PATCH /price-alerts/:id', async () => {
    mockedApi.patch.mockResolvedValue({ data: { ...sampleAlert, threshold: 210 } });
    await priceAlertService.update(1, { threshold: 210 });
    expect(mockedApi.patch).toHaveBeenCalledWith('/price-alerts/1', { threshold: 210 });
  });

  it('remove salje DELETE /price-alerts/:id', async () => {
    mockedApi.delete.mockResolvedValue({ data: undefined });
    await priceAlertService.remove(3);
    expect(mockedApi.delete).toHaveBeenCalledWith('/price-alerts/3');
  });

  it('listByListing salje GET /price-alerts sa listingId param', async () => {
    mockedApi.get.mockResolvedValue({ data: [sampleAlert] });
    await priceAlertService.listByListing(42);
    expect(mockedApi.get).toHaveBeenCalledWith('/price-alerts', { params: { listingId: 42 } });
  });
});
