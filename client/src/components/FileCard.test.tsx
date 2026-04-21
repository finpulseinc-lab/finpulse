import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FileCard } from './FileCard';
import type { FileRecord } from '../types';

const BASE_FILE: FileRecord = {
  id: 'abc-123',
  userId: 'user-1',
  filename: 'statement-2026-04.pdf',
  gcsPath: 'user-1/2026-04/statement-2026-04.pdf',
  uploadedAt: '2026-04-15T10:00:00Z',
  month: '2026-04',
  classification: {
    origin: 'bank',
    fileType: 'pdf',
    infoType: 'checking_account',
    confidence: 0.92,
    reason: 'Looks like a bank statement',
    aiSuggested: true,
    userConfirmed: false,
    overridden: false,
  },
};

describe('FileCard', () => {
  it('renders the filename', () => {
    render(<FileCard file={BASE_FILE} onPatch={vi.fn()} />);
    expect(screen.getByText('statement-2026-04.pdf')).toBeInTheDocument();
  });

  it('renders the month', () => {
    render(<FileCard file={BASE_FILE} onPatch={vi.fn()} />);
    expect(screen.getByText('2026-04')).toBeInTheDocument();
  });

  it('renders the confidence badge', () => {
    render(<FileCard file={BASE_FILE} onPatch={vi.fn()} />);
    expect(screen.getByText('92%')).toBeInTheDocument();
  });

  it('renders human-readable origin label', () => {
    render(<FileCard file={BASE_FILE} onPatch={vi.fn()} />);
    expect(screen.getByText('Bank')).toBeInTheDocument();
  });

  it('renders human-readable infoType label', () => {
    render(<FileCard file={BASE_FILE} onPatch={vi.fn()} />);
    expect(screen.getByText('Checking Account')).toBeInTheDocument();
  });

  it('shows Review button for unconfirmed files', () => {
    render(<FileCard file={BASE_FILE} onPatch={vi.fn()} />);
    expect(screen.getByRole('button', { name: /review/i })).toBeInTheDocument();
  });

  it('does not show OverrideForm initially', () => {
    render(<FileCard file={BASE_FILE} onPatch={vi.fn()} />);
    expect(screen.queryByRole('combobox', { name: /origin/i })).not.toBeInTheDocument();
  });

  it('shows OverrideForm when Review is clicked', () => {
    render(<FileCard file={BASE_FILE} onPatch={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /review/i }));
    expect(screen.getByRole('combobox', { name: /origin/i })).toBeInTheDocument();
  });

  it('hides Review button when OverrideForm is open', () => {
    render(<FileCard file={BASE_FILE} onPatch={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /review/i }));
    expect(screen.queryByRole('button', { name: /review/i })).not.toBeInTheDocument();
  });

  it('hides OverrideForm when Cancel is clicked', () => {
    render(<FileCard file={BASE_FILE} onPatch={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /review/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByRole('combobox', { name: /origin/i })).not.toBeInTheDocument();
  });

  it('calls onPatch with file id and body when form is submitted', async () => {
    const onPatch = vi.fn().mockResolvedValue(undefined);
    render(<FileCard file={BASE_FILE} onPatch={onPatch} />);
    fireEvent.click(screen.getByRole('button', { name: /review/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await waitFor(() =>
      expect(onPatch).toHaveBeenCalledWith('abc-123', { confirmed: true }),
    );
  });

  it('hides OverrideForm after successful submit', async () => {
    const onPatch = vi.fn().mockResolvedValue(undefined);
    render(<FileCard file={BASE_FILE} onPatch={onPatch} />);
    fireEvent.click(screen.getByRole('button', { name: /review/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await waitFor(() =>
      expect(screen.queryByRole('combobox', { name: /origin/i })).not.toBeInTheDocument(),
    );
  });

  it('shows Confirmed badge for confirmed files', () => {
    const confirmed = {
      ...BASE_FILE,
      classification: { ...BASE_FILE.classification, userConfirmed: true },
    };
    render(<FileCard file={confirmed} onPatch={vi.fn()} />);
    expect(screen.getByText(/confirmed/i)).toBeInTheDocument();
  });

  it('does not show Review button for confirmed files', () => {
    const confirmed = {
      ...BASE_FILE,
      classification: { ...BASE_FILE.classification, userConfirmed: true },
    };
    render(<FileCard file={confirmed} onPatch={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /review/i })).not.toBeInTheDocument();
  });

  it('shows Overridden badge for overridden files', () => {
    const overridden = {
      ...BASE_FILE,
      classification: {
        ...BASE_FILE.classification,
        userConfirmed: true,
        overridden: true,
        origin: 'manual' as const,
      },
    };
    render(<FileCard file={overridden} onPatch={vi.fn()} />);
    expect(screen.getByText(/overridden/i)).toBeInTheDocument();
  });
});
