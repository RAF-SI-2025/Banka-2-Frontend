import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PriceAlertDialog from './PriceAlertDialog';

vi.mock('@/services/priceAlertService', () => ({
  priceAlertService: {
    createAlert: vi.fn(),
  },
}));

vi.mock('@/lib/notify', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { priceAlertService } from '@/services/priceAlertService';

const mockedCreate = vi.mocked(priceAlertService.createAlert);

const listing = {
  id: 1,
  ticker: 'AAPL',
  currentPrice: 100,
  type: 'STOCK',
  currency: 'USD',
};

function renderDialog() {
  return render(
    <PriceAlertDialog open onOpenChange={() => {}} initialListing={listing} />
  );
}

describe('PriceAlertDialog — wrong-side block (R1 570 / R7 2037)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCreate.mockResolvedValue({} as never);
  });

  it('ne salje createAlert kad je ABOVE prag <= trenutne cene (pogresna strana)', async () => {
    const user = userEvent.setup();
    renderDialog();

    // Default condition je ABOVE; unesi prag ISPOD trenutne cene (100).
    await user.type(screen.getByTestId('price-alert-threshold'), '90');
    // Dugme je onemoguceno → submit blokiran; createAlert se ne poziva.
    expect(screen.getByTestId('price-alert-submit')).toBeDisabled();
    await user.click(screen.getByTestId('price-alert-submit'));
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it('ne salje createAlert kad je BELOW prag >= trenutne cene', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByTestId('price-alert-condition-BELOW'));
    await user.type(screen.getByTestId('price-alert-threshold'), '110');
    expect(screen.getByTestId('price-alert-submit')).toBeDisabled();
    await user.click(screen.getByTestId('price-alert-submit'));
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it('salje createAlert kad je prag na ISPRAVNOJ strani (ABOVE > cena)', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByTestId('price-alert-threshold'), '120');
    await user.click(screen.getByTestId('price-alert-submit'));

    await waitFor(() => {
      expect(mockedCreate).toHaveBeenCalledWith({
        listingId: 1,
        condition: 'ABOVE',
        threshold: 120,
      });
    });
  });

  it('dugme je onemoguceno dok je prag na pogresnoj strani', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByTestId('price-alert-threshold'), '80');
    expect(screen.getByTestId('price-alert-submit')).toBeDisabled();
  });
});
