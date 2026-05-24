import api from './api';
import type {
  WatchlistDto,
  WatchlistItemDto,
  CreateWatchlistRequest,
  RenameWatchlistRequest,
  AddToWatchlistRequest,
} from '../types/watchlist';

export const watchlistService = {
  listAll: async (): Promise<WatchlistDto[]> => {
    const { data } = await api.get<WatchlistDto[]>('/watchlists');
    return data;
  },

  getById: async (id: number): Promise<WatchlistDto> => {
    const { data } = await api.get<WatchlistDto>(`/watchlists/${id}`);
    return data;
  },

  create: async (dto: CreateWatchlistRequest): Promise<WatchlistDto> => {
    const { data } = await api.post<WatchlistDto>('/watchlists', dto);
    return data;
  },

  rename: async (id: number, dto: RenameWatchlistRequest): Promise<WatchlistDto> => {
    const { data } = await api.patch<WatchlistDto>(`/watchlists/${id}`, dto);
    return data;
  },

  remove: async (id: number): Promise<void> => {
    await api.delete(`/watchlists/${id}`);
  },

  listItems: async (watchlistId: number): Promise<WatchlistItemDto[]> => {
    const { data } = await api.get<WatchlistItemDto[]>(`/watchlists/${watchlistId}/items`);
    return data;
  },

  addItem: async (watchlistId: number, dto: AddToWatchlistRequest): Promise<WatchlistItemDto> => {
    const { data } = await api.post<WatchlistItemDto>(`/watchlists/${watchlistId}/items`, dto);
    return data;
  },

  removeItem: async (watchlistId: number, itemId: number): Promise<void> => {
    await api.delete(`/watchlists/${watchlistId}/items/${itemId}`);
  },

  moveItem: async (
    sourceWatchlistId: number,
    itemId: number,
    targetWatchlistId: number
  ): Promise<WatchlistItemDto> => {
    const { data } = await api.post<WatchlistItemDto>(
      `/watchlists/${sourceWatchlistId}/items/${itemId}/move`,
      { targetWatchlistId }
    );
    return data;
  },

  fetchMarketSnapshot: async (listingIds: number[]): Promise<WatchlistItemDto[]> => {
    const { data } = await api.post<WatchlistItemDto[]>('/watchlists/market-snapshot', {
      listingIds,
    });
    return data;
  },
};

export default watchlistService;
