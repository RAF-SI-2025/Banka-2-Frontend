import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PaymentHistoryPage from './PaymentHistoryPage';
import { mockAccount, mockTransaction, paginatedResponse } from '@/test/helpers';

// ---------- Mocks ----------

vi.mock('@/services/accountService', () => ({
  accountService: {
    getMyAccounts: vi.fn(),
  },
}));

vi.mock('@/services/transactionService', () => ({
  transactionService: {
    getAll: vi.fn(),
    getPaymentReceipt: vi.fn(),
  },
}));

import { accountService } from '@/services/accountService';
import { transactionService } from '@/services/transactionService';

const mockAccountService = vi.mocked(accountService);
const mockTransactionService = vi.mocked(transactionService);

const acc = mockAccount();
const tx1 = mockTransaction({ id: 1, amount: 15000, recipientName: 'EPS Srbija', status: 'COMPLETED', fromAccountNumber: acc.accountNumber });
const tx2 = mockTransaction({ id: 2, amount: 3000, recipientName: 'Telenor', status: 'PENDING', fromAccountNumber: acc.accountNumber });
const tx3 = mockTransaction({ id: 3, amount: 25000, recipientName: 'Uplata plate', status: 'COMPLETED', toAccountNumber: acc.accountNumber, fromAccountNumber: '265000000000000050' });

function renderPage(route = '/payments/history') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <PaymentHistoryPage />
    </MemoryRouter>
  );
}

describe('PaymentHistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAccountService.getMyAccounts.mockResolvedValue([acc]);
    mockTransactionService.getAll.mockResolvedValue(paginatedResponse([tx1, tx2, tx3]));
  });

  it('renders page header', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Pregled placanja/i)).toBeInTheDocument();
    });
  });

  it('renders payment list after loading', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('EPS Srbija')).toBeInTheDocument();
    });
    expect(screen.getByText('Telenor')).toBeInTheDocument();
    expect(screen.getByText('Uplata plate')).toBeInTheDocument();
  });

  it('shows summary statistics', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Odlivi/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Prilivi/i)).toBeInTheDocument();
    expect(screen.getByText(/Ukupno transakcija/i)).toBeInTheDocument();
  });

  it('shows status filter pills', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Sve')).toBeInTheDocument();
    });
    expect(screen.getByText('Zavrsene')).toBeInTheDocument();
    // "Na cekanju" appears both as filter pill and as transaction status badge
    expect(screen.getAllByText('Na cekanju').length).toBeGreaterThan(0);
    expect(screen.getByText('Odbijene')).toBeInTheDocument();
    expect(screen.getByText('Otkazane')).toBeInTheDocument();
  });

  // R1-333: BE moze vratiti PROCESSING/ABORTED — FE mora mapirati u citljive labele
  // umesto da prikaze sirov enum string.
  it('maps PROCESSING status to "U obradi" and ABORTED to "Prekinuto" (R1-333)', async () => {
    const txProcessing = mockTransaction({ id: 10, amount: 7000, recipientName: 'Inter-bank uplata', status: 'PROCESSING', fromAccountNumber: acc.accountNumber });
    const txAborted = mockTransaction({ id: 11, amount: 4000, recipientName: 'Prekinuta uplata', status: 'ABORTED', fromAccountNumber: acc.accountNumber });
    mockTransactionService.getAll.mockResolvedValue(paginatedResponse([txProcessing, txAborted]));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Inter-bank uplata')).toBeInTheDocument();
    });

    // Badge labele (a ne "PROCESSING"/"ABORTED" sirovi enum) — filter pill "U obradi"
    // takodje koristi istu labelu, pa ocekujemo bar 1 pojavu svake.
    expect(screen.getAllByText('U obradi').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Prekinute').length).toBeGreaterThan(0); // filter pill
    expect(screen.queryByText('PROCESSING')).not.toBeInTheDocument();
    expect(screen.queryByText('ABORTED')).not.toBeInTheDocument();
  });

  it('filters by status when pill is clicked', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Zavrsene')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Zavrsene'));

    await waitFor(() => {
      expect(mockTransactionService.getAll).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'COMPLETED' })
      );
    });
  });

  it('expands transaction details on click', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('EPS Srbija')).toBeInTheDocument();
    });

    // Click on the transaction row button to expand
    const txButtons = screen.getAllByRole('button');
    const epsButton = txButtons.find(btn => btn.textContent?.includes('EPS Srbija'));
    if (epsButton) {
      await user.click(epsButton);
    }

    // Expanded details should show
    await waitFor(() => {
      expect(screen.getByText(/Sa racuna/i)).toBeInTheDocument();
    });
  });

  it('shows PDF download button in expanded transaction', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('EPS Srbija')).toBeInTheDocument();
    });

    // Click to expand
    const txButtons = screen.getAllByRole('button');
    const epsButton = txButtons.find(btn => btn.textContent?.includes('EPS Srbija'));
    if (epsButton) await user.click(epsButton);

    await waitFor(() => {
      expect(screen.getByText(/Preuzmi potvrdu/i)).toBeInTheDocument();
    });
  });

  it('shows empty state when no transactions', async () => {
    mockTransactionService.getAll.mockResolvedValue(paginatedResponse([]));

    renderPage();

    await waitFor(() => {
      // "Nema transakcija" may appear in both heading and description
      expect(screen.getAllByText(/Nema transakcija/i).length).toBeGreaterThan(0);
    });
  });

  it('shows skeleton loading state', () => {
    mockAccountService.getMyAccounts.mockImplementation(() => new Promise(() => {}));
    mockTransactionService.getAll.mockImplementation(() => new Promise(() => {}));

    renderPage();

    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows pagination controls', async () => {
    mockTransactionService.getAll.mockResolvedValue({
      content: [tx1, tx2, tx3],
      totalElements: 25,
      totalPages: 3,
      size: 10,
      number: 0,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Prethodna/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Sledeca/i)).toBeInTheDocument();
    expect(screen.getByText(/1 \/ 3/)).toBeInTheDocument();
  });

  it('toggles expanded filter panel', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Filteri/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Filteri/i));

    await waitFor(() => {
      expect(screen.getByLabelText(/Racun/i)).toBeInTheDocument();
    });
  });

  it('downloads PDF receipt on button click', async () => {
    const user = userEvent.setup();
    mockTransactionService.getPaymentReceipt.mockResolvedValue(new Blob(['pdf-content']));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('EPS Srbija')).toBeInTheDocument();
    });

    // Expand
    const txButtons = screen.getAllByRole('button');
    const epsButton = txButtons.find(btn => btn.textContent?.includes('EPS Srbija'));
    if (epsButton) await user.click(epsButton);

    await waitFor(() => {
      expect(screen.getByText(/Preuzmi potvrdu/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Preuzmi potvrdu/i));

    await waitFor(() => {
      expect(mockTransactionService.getPaymentReceipt).toHaveBeenCalledWith(1);
    });
  });
});
