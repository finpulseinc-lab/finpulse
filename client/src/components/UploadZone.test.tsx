import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { UploadZone } from './UploadZone';

describe('UploadZone', () => {
  it('renders accepted file types hint', () => {
    render(<UploadZone onUpload={vi.fn()} uploading={false} />);
    expect(screen.getByText(/pdf.*xlsx.*csv.*png.*md/i)).toBeInTheDocument();
  });

  it('calls onUpload with selected files', async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn();
    render(<UploadZone onUpload={onUpload} uploading={false} />);
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);
    expect(onUpload).toHaveBeenCalledWith([file]);
  });

  it('shows uploading text when uploading=true', () => {
    render(<UploadZone onUpload={vi.fn()} uploading={true} />);
    expect(screen.getByText(/uploading/i)).toBeInTheDocument();
  });

  it('disables the input while uploading', () => {
    render(<UploadZone onUpload={vi.fn()} uploading={true} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeDisabled();
  });
});
