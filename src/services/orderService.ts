import api from './api';
import { Order, CreateOrderRequest, PaginatedResponse } from '../types/celina3';

// FIXME: Svi endpointi cekaju backend implementaciju iz Sprint 3

const orderService = {
  /**
   * POST /orders
   * Kreiranje BUY ili SELL ordera.
   * FIXME: Backend endpoint - POST /orders
   */
  create: async (request: CreateOrderRequest): Promise<Order> => {
    const response = await api.post('/orders', request);
    return response.data;
  },

  /**
   * GET /orders?status=ALL&page=0&size=20
   * Supervizor: lista svih ordera sa filtriranjem po statusu.
   * FIXME: Backend endpoint - GET /orders
   */
  getAll: async (
    status: string = 'ALL',
    page: number = 0,
    size: number = 20
  ): Promise<PaginatedResponse<Order>> => {
    const response = await api.get('/orders', {
      params: { status, page, size },
    });
    return response.data;
  },

  /**
   * GET /orders/my?page=0&size=20
   * Korisnik: moji orderi.
   * FIXME: Backend endpoint - GET /orders/my
   */
  getMy: async (page: number = 0, size: number = 20): Promise<PaginatedResponse<Order>> => {
    const response = await api.get('/orders/my', {
      params: { page, size },
    });
    return response.data;
  },

  /**
   * GET /orders/{id}
   * Detalji jednog ordera.
   * FIXME: Backend endpoint - GET /orders/{id}
   */
  getById: async (id: number): Promise<Order> => {
    const response = await api.get(`/orders/${id}`);
    return response.data;
  },

  /**
   * PATCH /orders/{id}/approve
   * Supervizor odobrava order.
   * FIXME: Backend endpoint - PATCH /orders/{id}/approve
   */
  approve: async (id: number): Promise<Order> => {
    const response = await api.patch(`/orders/${id}/approve`);
    return response.data;
  },

  /**
   * PATCH /orders/{id}/decline
   * Supervizor odbija order.
   * FIXME: Backend endpoint - PATCH /orders/{id}/decline
   */
  decline: async (id: number): Promise<Order> => {
    const response = await api.patch(`/orders/${id}/decline`);
    return response.data;
  },
};

export default orderService;
