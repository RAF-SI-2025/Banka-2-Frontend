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

    expect(screen.getByText('Verifikacija transakcije')).toBeTruthy();
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

  it('shows error and decrements attempts on verification failure', async () => {
    const onVerified = vi.fn().mockRejectedValue({
      response: { data: { message: 'Pogresan kod' } },
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

  it('closes modal after max attempts exceeded', async () => {
    const onVerified = vi.fn().mockRejectedValue(new Error('fail'));
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

    expect(screen.queryByText('Verifikacija transakcije')).toBeNull();
  });
});
