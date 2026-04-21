import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ConfidenceBadge } from './ConfidenceBadge';

describe('ConfidenceBadge – confidence display', () => {
  it('renders confidence as a rounded percentage', () => {
    render(<ConfidenceBadge confidence={0.85} />);
    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  it('rounds to nearest integer', () => {
    render(<ConfidenceBadge confidence={0.856} />);
    expect(screen.getByText('86%')).toBeInTheDocument();
  });

  it('labels confidence >= 0.85 as High', () => {
    render(<ConfidenceBadge confidence={0.85} />);
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('labels confidence 0.60–0.84 as Medium', () => {
    render(<ConfidenceBadge confidence={0.72} />);
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });

  it('labels confidence < 0.60 as Low', () => {
    render(<ConfidenceBadge confidence={0.3} />);
    expect(screen.getByText('Low')).toBeInTheDocument();
  });
});

describe('ConfidenceBadge – colours', () => {
  it('applies green styling for high confidence', () => {
    const { container } = render(<ConfidenceBadge confidence={0.9} />);
    expect(container.firstChild).toHaveClass('bg-green-100');
    expect(container.firstChild).toHaveClass('text-green-800');
  });

  it('applies yellow styling for medium confidence', () => {
    const { container } = render(<ConfidenceBadge confidence={0.72} />);
    expect(container.firstChild).toHaveClass('bg-yellow-100');
    expect(container.firstChild).toHaveClass('text-yellow-800');
  });

  it('applies red styling for low confidence', () => {
    const { container } = render(<ConfidenceBadge confidence={0.2} />);
    expect(container.firstChild).toHaveClass('bg-red-100');
    expect(container.firstChild).toHaveClass('text-red-800');
  });
});

describe('ConfidenceBadge – threshold boundaries', () => {
  it('boundary: 0.85 is High not Medium', () => {
    render(<ConfidenceBadge confidence={0.85} />);
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('boundary: 0.84 is Medium not High', () => {
    render(<ConfidenceBadge confidence={0.84} />);
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });

  it('boundary: 0.60 is Medium not Low', () => {
    render(<ConfidenceBadge confidence={0.60} />);
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });

  it('boundary: 0.59 is Low not Medium', () => {
    render(<ConfidenceBadge confidence={0.59} />);
    expect(screen.getByText('Low')).toBeInTheDocument();
  });
});

describe('ConfidenceBadge – reason sub-label', () => {
  it('shows reason text under a medium confidence badge', () => {
    render(<ConfidenceBadge confidence={0.72} reason="Filename matches credit card pattern" />);
    expect(screen.getByText('Filename matches credit card pattern')).toBeInTheDocument();
  });

  it('shows reason text under a low confidence badge', () => {
    render(<ConfidenceBadge confidence={0.4} reason="Unable to determine origin" />);
    expect(screen.getByText('Unable to determine origin')).toBeInTheDocument();
  });

  it('does not show reason text for a high confidence badge', () => {
    render(<ConfidenceBadge confidence={0.9} reason="Very clear bank statement" />);
    expect(screen.queryByText('Very clear bank statement')).not.toBeInTheDocument();
  });

  it('truncates reason to 120 characters with ellipsis', () => {
    const long = 'A'.repeat(130);
    render(<ConfidenceBadge confidence={0.5} reason={long} />);
    expect(screen.getByText('A'.repeat(120) + '…')).toBeInTheDocument();
  });

  it('shows full reason when 120 chars or fewer', () => {
    const exact = 'B'.repeat(120);
    render(<ConfidenceBadge confidence={0.5} reason={exact} />);
    expect(screen.getByText(exact)).toBeInTheDocument();
  });
});

describe('ConfidenceBadge – overridden state', () => {
  it('shows Overridden badge when overridden is true', () => {
    render(<ConfidenceBadge confidence={0.4} overridden />);
    expect(screen.getByText('Overridden')).toBeInTheDocument();
  });

  it('does not show confidence percentage when overridden', () => {
    render(<ConfidenceBadge confidence={0.4} overridden />);
    expect(screen.queryByText('40%')).not.toBeInTheDocument();
  });

  it('applies grey styling for overridden badge', () => {
    const { container } = render(<ConfidenceBadge confidence={0.4} overridden />);
    expect(container.firstChild).toHaveClass('bg-gray-100');
    expect(container.firstChild).toHaveClass('text-gray-800');
  });
});

describe('ConfidenceBadge – confirmed state', () => {
  it('shows Confirmed badge when confirmed and not overridden', () => {
    render(<ConfidenceBadge confidence={0.9} confirmed />);
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
  });

  it('does not show confidence percentage when confirmed', () => {
    render(<ConfidenceBadge confidence={0.9} confirmed />);
    expect(screen.queryByText('90%')).not.toBeInTheDocument();
  });

  it('applies green styling for confirmed badge', () => {
    const { container } = render(<ConfidenceBadge confidence={0.9} confirmed />);
    expect(container.firstChild).toHaveClass('bg-green-100');
    expect(container.firstChild).toHaveClass('text-green-800');
  });

  it('overridden takes precedence over confirmed when both true', () => {
    render(<ConfidenceBadge confidence={0.4} overridden confirmed />);
    expect(screen.getByText('Overridden')).toBeInTheDocument();
    expect(screen.queryByText('Confirmed')).not.toBeInTheDocument();
  });
});
