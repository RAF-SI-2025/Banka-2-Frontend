import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be set up before importing the component
// ---------------------------------------------------------------------------

vi.mock('@/services/transactionService', () => ({
  transactionService: {
    requestOtp: vi.fn().mockResolvedValue({ sent: true, message: 'ok' }),
    requestOtpViaEmail: vi.fn().mockResolvedValue({ sent: true, message: 'ok' }),
    getActiveOtp: vi.fn().mockResolvedValue({ active: true, code: '424242' }),
  },
}));

vi.mock('@/lib/notify', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

import VerificationModal from '../components/shared/VerificationModal';
import { transactionService } from '@/services/transactionService';
import { toast } from '@/lib/notify';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('VerificationModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onVerified: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders modal with title and description when open', async () => {
    await act(async () => {
      render(<VerificationModal {...defaultProps} />);
    });

    // TOTP refactor (05/2026) — naslov je sad "Verifikacija (TOTP)"
    expect(screen.getByText('Verifikacija (TOTP)')).toBeTruthy();
    expect(screen.getByLabelText('Verifikacioni kod')).toBeTruthy();
  });

  it('calls requestOtp when modal opens', async () => {
    await act(async () => {
      render(<VerificationModal {...defaultProps} />);
    });

    expect(transactionService.requestOtp).toHaveBeenCalledTimes(1);
  });

  it('displays initial countdown of 05:00', async () => {
    await act(async () => {
      render(<VerificationModal {...defaultProps} />);
    });

    expect(screen.getByText('05:00')).toBeTruthy();
  });

  it('displays initial attempts count of 3', async () => {
    await act(async () => {
      render(<VerificationModal {...defaultProps} />);
    });

    expect(screen.getByText('3')).toBeTruthy();
  });

  it('countdown timer decrements', async () => {
    await act(async () => {
      render(<VerificationModal {...defaultProps} />);
    });

    // Advance by 1 second
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText('04:59')).toBeTruthy();

    // Advance another 59 seconds (total 60s)
    await act(async () => {
      vi.advanceTimersByTime(59000);
    });

    expect(screen.getByText('04:00')).toBeTruthy();
  });

  it('submit calls onVerified with the entered code', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    await act(async () => {
      render(<VerificationModal {...defaultProps} />);
    });

    const input = screen.getByLabelText('Verifikacioni kod');
    await user.type(input, '123456');

    const submitBtn = screen.getByRole('button', { name: 'Potvrdi' });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(defaultProps.onVerified).toHaveBeenCalledWith('123456');
    });
  });

  it('shows error and decrements attempts on OTP (403) failure', async () => {
    const onVerified = vi.fn().mockRejectedValue({
      response: { status: 403, data: { message: 'Pogresan kod' } },
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    await act(async () => {
      render(<VerificationModal {...defaultProps} onVerified={onVerified} />);
    });

    const input = screen.getByLabelText('Verifikacioni kod');
    await user.type(input, '111111');

    const submitBtn = screen.getByRole('button', { name: 'Potvrdi' });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Pogresan kod')).toBeTruthy();
    });

    // Attempts should decrease from 3 to 2
    expect(screen.getByText('2')).toBeTruthy();
  });

  // R1-253: poslovna greska (404/400/...) NE sme da trosi OTP pokusaj —
  // OTP je bio ispravan, transakcija je pala iz drugog razloga (npr. racun
  // ne postoji). Modal prikaze poruku ali ostavlja 3 pokusaja.
  it('does NOT decrement attempts on a business error (404 account not found)', async () => {
    const onVerified = vi.fn().mockRejectedValue({
      response: { status: 404, data: { message: 'Racun primaoca ne postoji.' } },
    });
    const onClose = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    await act(async () => {
      render(<VerificationModal isOpen={true} onClose={onClose} onVerified={onVerified} />);
    });

    const input = screen.getByLabelText('Verifikacioni kod');
    await user.type(input, '123456');
    await user.click(screen.getByRole('button', { name: 'Potvrdi' }));

    await waitFor(() => {
      expect(screen.getByText('Racun primaoca ne postoji.')).toBeTruthy();
    });

    // Pokusaji ostaju 3 (nije bio OTP problem) i modal se ne gasi.
    expect(screen.getByText('3')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does NOT decrement attempts on a 400 business error (insufficient funds)', async () => {
    const onVerified = vi.fn().mockRejectedValue({
      response: { status: 400, data: { message: 'Nedovoljno sredstava.' } },
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    await act(async () => {
      render(<VerificationModal {...defaultProps} onVerified={onVerified} />);
    });

    const input = screen.getByLabelText('Verifikacioni kod');
    await user.type(input, '123456');
    await user.click(screen.getByRole('button', { name: 'Potvrdi' }));

    await waitFor(() => {
      expect(screen.getByText('Nedovoljno sredstava.')).toBeTruthy();
    });

    expect(screen.getByText('3')).toBeTruthy();
  });

  it('blocks immediately when backend returns blocked=true', async () => {
    const onVerified = vi.fn().mockRejectedValue({
      response: { status: 403, data: { message: 'Prekoracen broj pokusaja.', blocked: true } },
    });
    const onClose = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    await act(async () => {
      render(<VerificationModal isOpen={true} onClose={onClose} onVerified={onVerified} />);
    });

    const input = screen.getByLabelText('Verifikacioni kod');
    await user.type(input, '111111');
    await user.click(screen.getByRole('button', { name: 'Potvrdi' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Maksimalan broj pokusaja. Transakcija otkazana.');
    });

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(onClose).toHaveBeenCalled();
  });

  it('closes modal after max OTP (403) attempts exceeded', async () => {
    const onVerified = vi.fn().mockRejectedValue({ response: { status: 403, data: {} } });
    const onClose = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    await act(async () => {
      render(<VerificationModal isOpen={true} onClose={onClose} onVerified={onVerified} />);
    });

    const input = screen.getByLabelText('Verifikacioni kod');
    const submitBtn = screen.getByRole('button', { name: 'Potvrdi' });

    // Attempt 1
    await user.clear(input);
    await user.type(input, '111111');
    await user.click(submitBtn);
    await waitFor(() => expect(screen.getByText('2')).toBeTruthy());

    // Attempt 2
    await user.clear(input);
    await user.type(input, '222222');
    await user.click(submitBtn);
    await waitFor(() => expect(screen.getByText('1')).toBeTruthy());

    // Attempt 3 — should trigger close after timeout
    await user.clear(input);
    await user.type(input, '333333');
    await user.click(submitBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Maksimalan broj pokusaja. Transakcija otkazana.');
    });

    // The modal calls onClose via setTimeout(1500)
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(onClose).toHaveBeenCalled();
  });

  it('email fallback button calls requestOtpViaEmail', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    await act(async () => {
      render(<VerificationModal {...defaultProps} />);
    });

    const emailBtn = screen.getByText('Pošaljite na email');
    await user.click(emailBtn);

    await waitFor(() => {
      expect(transactionService.requestOtpViaEmail).toHaveBeenCalledTimes(1);
      expect(toast.info).toHaveBeenCalledWith('Kod poslat na email.');
    });
  });

  it('cancel button calls onClose', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    await act(async () => {
      render(<VerificationModal {...defaultProps} />);
    });

    const cancelBtn = screen.getByRole('button', { name: 'Otkaži' });
    await user.click(cancelBtn);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('does not render when isOpen is false', () => {
    render(<VerificationModal {...defaultProps} isOpen={false} />);

    expect(screen.queryByText('Verifikacija (TOTP)')).toBeNull();
  });

  // P0-F1/N2 — OTP kod u DOM-u (2FA no-op) gejtovan iza import.meta.env.DEV
  describe('OTP dev-display gating (N2)', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('in DEV: fetches and renders the OTP code', async () => {
      vi.stubEnv('DEV', true);
      await act(async () => {
        render(<VerificationModal {...defaultProps} />);
      });

      await waitFor(() => {
        expect(transactionService.getActiveOtp).toHaveBeenCalledTimes(1);
      });
      expect(screen.getByText('424242')).toBeTruthy();
      expect(screen.getByText('Vaš verifikacioni kod')).toBeTruthy();
    });

    it('in PROD: does NOT fetch or render the OTP code', async () => {
      vi.stubEnv('DEV', false);
      await act(async () => {
        render(<VerificationModal {...defaultProps} />);
      });

      // Modal i dalje radi (requestOtp je pozvan)...
      expect(transactionService.requestOtp).toHaveBeenCalledTimes(1);
      // ...ali kod se NE fetch-uje niti prikazuje.
      expect(transactionService.getActiveOtp).not.toHaveBeenCalled();
      expect(screen.queryByText('424242')).toBeNull();
      expect(screen.queryByText('Vaš verifikacioni kod')).toBeNull();
    });
  });
});
