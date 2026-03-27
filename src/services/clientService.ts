import api from './api';
import type { ClientFilters } from '../types/celina2';
import type { PaginatedResponse, Client } from '../types';

// Backend returns `phone`, FE expects `phoneNumber`
function mapClientFromBE(data: Record<string, unknown>): Client {
  return {
    ...data,
    phoneNumber: (data.phoneNumber as string) || (data.phone as string) || '',
  } as Client;
}

export const clientService = {
  getAll: async (filters?: ClientFilters): Promise<PaginatedResponse<Client>> => {
    const params = new URLSearchParams();
    if (filters?.firstName) params.append('firstName', filters.firstName);
    if (filters?.lastName) params.append('lastName', filters.lastName);
    if (filters?.email) params.append('email', filters.email);
    if (filters?.page !== undefined) params.append('page', String(filters.page));
    if (filters?.limit !== undefined) params.append('limit', String(filters.limit));

    const response = await api.get<PaginatedResponse<Record<string, unknown>>>('/clients', { params });
    const data = response.data;
    return {
      ...data,
      content: (data.content ?? []).map(mapClientFromBE),
    };
  },

  getById: async (id: number): Promise<Client> => {
    const response = await api.get<Record<string, unknown>>(`/clients/${id}`);
    return mapClientFromBE(response.data);
  },

  create: async (data: Partial<Client> & { password?: string }): Promise<Client> => {
    // Map phoneNumber -> phone for BE
    const payload = {
      ...data,
      phone: data.phoneNumber || (data as Record<string, unknown>).phone,
    };
    const response = await api.post<Record<string, unknown>>('/clients', payload);
    return mapClientFromBE(response.data);
  },

  update: async (id: number, data: Partial<Client>): Promise<Client> => {
    // Map phoneNumber -> phone for BE (also sends phoneNumber via @JsonAlias)
    const payload = {
      ...data,
      phone: data.phoneNumber || (data as Record<string, unknown>).phone,
    };
    const response = await api.put<Record<string, unknown>>(`/clients/${id}`, payload);
    return mapClientFromBE(response.data);
  },
};
