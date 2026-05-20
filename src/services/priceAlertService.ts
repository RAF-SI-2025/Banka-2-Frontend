import api from './api';
import type {
  PriceAlertDto,
  CreatePriceAlertRequest,
  UpdatePriceAlertRequest,
} from '../types/priceAlert';

export const priceAlertService = {
  listMy: async (): Promise<PriceAlertDto[]> => {
    const { data } = await api.get<PriceAlertDto[]>('/price-alerts/my');
    return data;
  },

  getById: async (id: number): Promise<PriceAlertDto> => {
    const { data } = await api.get<PriceAlertDto>(`/price-alerts/${id}`);
    return data;
  },

  create: async (dto: CreatePriceAlertRequest): Promise<PriceAlertDto> => {
    const { data } = await api.post<PriceAlertDto>('/price-alerts', dto);
    return data;
  },

  update: async (id: number, dto: UpdatePriceAlertRequest): Promise<PriceAlertDto> => {
    const { data } = await api.patch<PriceAlertDto>(`/price-alerts/${id}`, dto);
    return data;
  },

  remove: async (id: number): Promise<void> => {
    await api.delete(`/price-alerts/${id}`);
  },

  listByListing: async (listingId: number): Promise<PriceAlertDto[]> => {
    const { data } = await api.get<PriceAlertDto[]>('/price-alerts', {
      params: { listingId },
    });
    return data;
  },
};

export default priceAlertService;
