import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ConfidenceBadge } from './ConfidenceBadge';

describe('ConfidenceBadge', () => {
  it('renders confidence as a rounded percentage', () => {
    render(<ConfidenceBadge confidence={0.85} />);
    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  it('rounds to nearest integer', () => {
    render(<ConfidenceBadge confidence={0.856} />);
    expect(screen.getByText('86%')).toBeInTheDocument();
  });

  it('labels confidence >= 0.8 as High', () => {
    render(<ConfidenceBadge confidence={0.8} />);
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('labels confidence 0.5–0.79 as Medium', () => {
    render(<ConfidenceBadge confidence={0.65} />);
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });

  it('labels confidence < 0.5 as Low', () => {
    render(<ConfidenceBadge confidence={0.3} />);
    expect(screen.getByText('Low')).toBeInTheDocument();
  });

  it('applies green styling for high confidence', () => {
    const { container } = render(<ConfidenceBadge confidence={0.9} />);
    expect(container.firstChild).toHaveClass('bg-green-100');
    expect(container.firstChild).toHaveClass('text-green-800');
  });

  it('applies yellow styling for medium confidence', () => {
    const { container } = render(<ConfidenceBadge confidence={0.6} />);
    expect(container.firstChild).toHaveClass('bg-yellow-100');
    expect(container.firstChild).toHaveClass('text-yellow-800');
  });

  it('applies red styling for low confidence', () => {
    const { container } = render(<ConfidenceBadge confidence={0.2} />);
    expect(container.firstChild).toHaveClass('bg-red-100');
    expect(container.firstChild).toHaveClass('text-red-800');
  });

  it('boundary: 0.8 is High not Medium', () => {
    render(<ConfidenceBadge confidence={0.8} />);
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('boundary: 0.5 is Medium not Low', () => {
    render(<ConfidenceBadge confidence={0.5} />);
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });
});
