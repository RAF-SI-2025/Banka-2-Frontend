import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OtcDiscoveryPage from './OtcDiscoveryPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockListDiscovery = vi.fn();
const mockCreateOffer = vi.fn();

vi.mock('@/services/otcService', () => ({
  default: {
    listDiscovery: (...a: unknown[]) => mockListDiscovery(...a),
    createOffer: (...a: unknown[]) => mockCreateOffer(...a),
  },
}));

vi.mock('./OtcInterBankDiscoveryTab', () => ({
  default: () => <div data-testid="inter-bank-discovery">[InterBank Discovery]</div>,
}));

const mockToastError = vi.fn();
vi.mock('@/lib/notify', () => ({
  toast: {
    error: (...a: unknown[]) => mockToastError(...a),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

function pastDateISO(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

beforeEach(() => {
  mockNavigate.mockClear();
  mockListDiscovery.mockReset();
  mockCreateOffer.mockReset();
  mockToastError.mockClear();
  mockListDiscovery.mockResolvedValue([
    {
      portfolioId: 1, listingId: 1, listingTicker: 'AAPL', listingName: 'Apple Inc.',
      listingCurrency: 'USD', currentPrice: 190, publicQuantity: 5, availablePublicQuantity: 5,
      sellerId: 2, sellerRole: 'CLIENT', sellerName: 'Milica Nikolic',
    },
  ]);
});

describe('OtcDiscoveryPage', () => {
  it('renders source filter chip', async () => {
    render(<MemoryRouter><OtcDiscoveryPage /></MemoryRouter>);
    await waitFor(() => screen.getByText(/Iz nase banke/i));
    expect(screen.getByRole('button', { name: /Sve/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Iz drugih banaka/i })).toBeInTheDocument();
  });

  it('shows local listings under "Sve" filter', async () => {
    render(<MemoryRouter><OtcDiscoveryPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('AAPL')).toBeInTheDocument());
  });

  it('switches to inter-bank when filter "Iz drugih banaka" clicked', async () => {
    render(<MemoryRouter><OtcDiscoveryPage /></MemoryRouter>);
    await waitFor(() => screen.getByText(/Iz drugih banaka/i));
    fireEvent.click(screen.getByRole('button', { name: /Iz drugih banaka/i }));
    expect(screen.getByTestId('inter-bank-discovery')).toBeInTheDocument();
  });

  it('opens create-offer form when "Napravi ponudu" clicked', async () => {
    render(<MemoryRouter><OtcDiscoveryPage /></MemoryRouter>);
    await waitFor(() => screen.getByText('AAPL'));
    fireEvent.click(screen.getByRole('button', { name: /Napravi ponudu/i }));
    expect(screen.getByLabelText(/Kolicina akcija/i)).toBeInTheDocument();
  });

  // R1 860: settlement u proslosti se odbija pre slanja (HTML `min` nije dovoljan).
  it('rejects offer with a past settlement date and does not call createOffer', async () => {
    render(<MemoryRouter><OtcDiscoveryPage /></MemoryRouter>);
    await waitFor(() => screen.getByText('AAPL'));
    fireEvent.click(screen.getByRole('button', { name: /Napravi ponudu/i }));

    fireEvent.change(screen.getByLabelText(/Kolicina akcija/i), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText(/Cena po akciji/i), { target: { value: '190' } });
    fireEvent.change(screen.getByLabelText(/Premija/i), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText(/Datum dospeca/i), { target: { value: pastDateISO(3) } });

    fireEvent.click(screen.getByRole('button', { name: /Posalji ponudu prodavcu/i }));

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('Datum dospeca mora biti u buducnosti.'));
    expect(mockCreateOffer).not.toHaveBeenCalled();
  });
});
