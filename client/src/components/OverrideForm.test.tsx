import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { OverrideForm } from './OverrideForm';
import type { ClassificationResult } from '../types';

const BASE: ClassificationResult = {
  origin: 'bank',
  fileType: 'pdf',
  infoType: 'checking_account',
  confidence: 0.92,
  reason: 'Looks like a bank statement',
  aiSuggested: true,
  userConfirmed: false,
  overridden: false,
};

describe('OverrideForm', () => {
  it('pre-selects the current origin value', () => {
    render(<OverrideForm classification={BASE} onSubmit={vi.fn()} />);
    expect(screen.getByRole('combobox', { name: /origin/i })).toHaveValue('bank');
  });

  it('pre-selects the current infoType value', () => {
    render(<OverrideForm classification={BASE} onSubmit={vi.fn()} />);
    expect(screen.getByRole('combobox', { name: /info type/i })).toHaveValue('checking_account');
  });

  it('renders all origin options with human-readable labels', () => {
    render(<OverrideForm classification={BASE} onSubmit={vi.fn()} />);
    const select = screen.getByRole('combobox', { name: /origin/i });
    expect(select).toHaveTextContent('Bank');
    expect(select).toHaveTextContent('Credit Card — MAX');
    expect(select).toHaveTextContent('Credit Card — Cal');
    expect(select).toHaveTextContent('Insurance Portal');
    expect(select).toHaveTextContent('Pension Clearing House');
    expect(select).toHaveTextContent('Investment Portal');
    expect(select).toHaveTextContent('Manual');
  });

  it('renders all infoType options with human-readable labels', () => {
    render(<OverrideForm classification={BASE} onSubmit={vi.fn()} />);
    const select = screen.getByRole('combobox', { name: /info type/i });
    expect(select).toHaveTextContent('Checking Account');
    expect(select).toHaveTextContent('Credit Card Transactions');
    expect(select).toHaveTextContent('Pension');
    expect(select).toHaveTextContent('Insurance');
    expect(select).toHaveTextContent('Education Fund');
    expect(select).toHaveTextContent('Investment');
    expect(select).toHaveTextContent('Property');
  });

  it('submits { confirmed: true } when no values are changed', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<OverrideForm classification={BASE} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ confirmed: true }));
  });

  it('submits { override: { origin } } when only origin is changed', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<OverrideForm classification={BASE} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByRole('combobox', { name: /origin/i }), {
      target: { value: 'manual' },
    });
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ override: { origin: 'manual' } }),
    );
  });

  it('submits { override: { infoType } } when only infoType is changed', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<OverrideForm classification={BASE} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByRole('combobox', { name: /info type/i }), {
      target: { value: 'pension' },
    });
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ override: { infoType: 'pension' } }),
    );
  });

  it('submits { override: { origin, infoType } } when both are changed', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<OverrideForm classification={BASE} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByRole('combobox', { name: /origin/i }), {
      target: { value: 'investment_portal' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: /info type/i }), {
      target: { value: 'investment' },
    });
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        override: { origin: 'investment_portal', infoType: 'investment' },
      }),
    );
  });

  it('disables the submit button while submitting', async () => {
    let resolve!: () => void;
    const onSubmit = vi.fn(
      () => new Promise<void>((res) => { resolve = res; }),
    );
    render(<OverrideForm classification={BASE} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    expect(screen.getByRole('button', { name: /confirm/i })).toBeDisabled();
    resolve();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /confirm/i })).not.toBeDisabled(),
    );
  });

  it('calls onCancel when the cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(<OverrideForm classification={BASE} onSubmit={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('does not render a cancel button when onCancel is not provided', () => {
    render(<OverrideForm classification={BASE} onSubmit={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
  });
});
