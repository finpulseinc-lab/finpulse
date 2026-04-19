import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { FileManager } from '../FileManager';
import * as api from '../../api/files';
import type { FileRecord } from '../../types';

vi.mock('../../api/files');

const fakeRecord: FileRecord = {
  id: 'abc-123',
  userId: 'user1',
  filename: 'bank.pdf',
  gcsPath: 'user1/2026-04/bank.pdf',
  uploadedAt: '2026-04-18T10:00:00.000Z',
  month: '2026-04',
  classification: {
    origin: 'bank',
    fileType: 'pdf',
    infoType: 'checking_account',
    confidence: 0.95,
    reason: 'Bank statement',
    aiSuggested: true,
    userConfirmed: false,
    overridden: false,
  },
};

function renderPage(userId = 'user1') {
  return render(
    <MemoryRouter>
      <FileManager userId={userId} />
    </MemoryRouter>
  );
}

describe('FileManager', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows loading state while fetching', () => {
    vi.mocked(api.listFiles).mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows empty state when no files', async () => {
    vi.mocked(api.listFiles).mockResolvedValue({ files: [], total: 0 });
    renderPage();
    await waitFor(() => expect(screen.getByText(/no files/i)).toBeInTheDocument());
  });

  it('renders filename for each file', async () => {
    vi.mocked(api.listFiles).mockResolvedValue({ files: [fakeRecord], total: 1 });
    renderPage();
    await waitFor(() => expect(screen.getByText('bank.pdf')).toBeInTheDocument());
  });

  it('shows error state and retry button on API failure', async () => {
    vi.mocked(api.listFiles).mockRejectedValue(new Error('Network error'));
    renderPage();
    await waitFor(() => expect(screen.getByText(/error/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('refetches on retry click', async () => {
    const user = userEvent.setup();
    vi.mocked(api.listFiles)
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce({ files: [], total: 0 });
    renderPage();
    await waitFor(() => screen.getByRole('button', { name: /retry/i }));
    await user.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(screen.getByText(/no files/i)).toBeInTheDocument());
  });

  it('calls patchClassification on confirm', async () => {
    const user = userEvent.setup();
    vi.mocked(api.listFiles).mockResolvedValue({ files: [fakeRecord], total: 1 });
    vi.mocked(api.patchClassification).mockResolvedValue({
      ...fakeRecord,
      classification: { ...fakeRecord.classification, userConfirmed: true },
    });
    renderPage();
    await waitFor(() => screen.getByRole('button', { name: /^review$/i }));
    await user.click(screen.getByRole('button', { name: /^review$/i }));
    await user.click(screen.getByRole('button', { name: /^confirm$/i }));
    expect(api.patchClassification).toHaveBeenCalledWith('user1', 'abc-123', { confirmed: true });
  });

  it('calls deleteFile and removes card on delete', async () => {
    const user = userEvent.setup();
    window.confirm = vi.fn().mockReturnValue(true);
    vi.mocked(api.listFiles).mockResolvedValue({ files: [fakeRecord], total: 1 });
    vi.mocked(api.deleteFile).mockResolvedValue(undefined);
    renderPage();
    await waitFor(() => screen.getByRole('button', { name: /delete/i }));
    await user.click(screen.getByRole('button', { name: /delete/i }));
    expect(api.deleteFile).toHaveBeenCalledWith('user1', 'abc-123');
    await waitFor(() => expect(screen.queryByText('bank.pdf')).not.toBeInTheDocument());
  });
});
