import api from './api';
import type {
  Employee,
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
  EmployeeFilters,
  PaginatedResponse,
} from '../types';

// Backend koristi 'phone' i 'active', a FE koristi 'phoneNumber' i 'isActive'
// Ove helper funkcije mapiraju između FE i BE formata

interface BackendEmployeeDto {
  id: number;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  position: string;
  phone: string;
  active: boolean;
  permissions: string[];
  address: string;
  dateOfBirth: string;
  gender: string;
  department: string;
}

function mapEmployeeFromBackend(dto: BackendEmployeeDto): Employee {
  return {
    id: dto.id,
    firstName: dto.firstName,
    lastName: dto.lastName,
    username: dto.username,
    email: dto.email,
    position: dto.position,
    phoneNumber: dto.phone || '',
    isActive: dto.active,
    permissions: dto.permissions as Employee['permissions'],
    address: dto.address,
    dateOfBirth: dto.dateOfBirth,
    gender: dto.gender,
    department: dto.department,
  };
}

function mapEmployeeToBackend(data: CreateEmployeeRequest | UpdateEmployeeRequest) {
  const { phoneNumber, isActive, ...rest } = data as CreateEmployeeRequest;
  return {
    ...rest,
    phone: phoneNumber,
    active: isActive,
  };
}

export const employeeService = {
  getAll: async (filters?: EmployeeFilters): Promise<PaginatedResponse<Employee>> => {
    const params = new URLSearchParams();
    if (filters?.email) params.append('email', filters.email);
    if (filters?.firstName) params.append('firstName', filters.firstName);
    if (filters?.lastName) params.append('lastName', filters.lastName);
    if (filters?.position) params.append('position', filters.position);
    if (filters?.page !== undefined) params.append('page', String(filters.page));
    if (filters?.limit !== undefined) params.append('limit', String(filters.limit));

    const response = await api.get<{ content: BackendEmployeeDto[]; totalElements: number; totalPages: number; size: number; number: number }>('/employees', { params });
    return {
      ...response.data,
      content: response.data.content.map(mapEmployeeFromBackend),
    };
  },

  getById: async (id: number): Promise<Employee> => {
    const response = await api.get<BackendEmployeeDto>(`/employees/${id}`);
    return mapEmployeeFromBackend(response.data);
  },

  create: async (data: CreateEmployeeRequest): Promise<Employee> => {
    const response = await api.post<BackendEmployeeDto>('/employees', mapEmployeeToBackend(data));
    return mapEmployeeFromBackend(response.data);
  },

  update: async (id: number, data: UpdateEmployeeRequest): Promise<Employee> => {
    const backendData = mapEmployeeToBackend(data);
    const response = await api.put<BackendEmployeeDto>(`/employees/${id}`, backendData);
    return mapEmployeeFromBackend(response.data);
  },

  deactivate: async (id: number): Promise<void> => {
    await api.patch(`/employees/${id}/deactivate`);
  },
};
