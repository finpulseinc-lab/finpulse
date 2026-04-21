interface Props {
  confidence: number;
  reason?: string;
  overridden?: boolean;
  confirmed?: boolean;
}

type Tier = 'High' | 'Medium' | 'Low';

function tier(confidence: number): Tier {
  if (confidence >= 0.85) return 'High';
  if (confidence >= 0.60) return 'Medium';
  return 'Low';
}

const TIER_STYLES: Record<Tier, string> = {
  High: 'bg-green-100 text-green-800',
  Medium: 'bg-yellow-100 text-yellow-800',
  Low: 'bg-red-100 text-red-800',
};

function truncate(text: string, max = 120): string {
  return text.length > max ? text.slice(0, max) + '…' : text;
}

export function ConfidenceBadge({ confidence, reason, overridden, confirmed }: Props) {
  if (overridden) {
    return (
      <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-800">
        Overridden
      </span>
    );
  }

  if (confirmed) {
    return (
      <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800">
        <span>✓</span>
        <span>Confirmed</span>
      </span>
    );
  }

  const label = tier(confidence);
  const showReason = label !== 'High' && reason;

  return (
    <span className={`inline-flex flex-col rounded px-2 py-0.5 text-xs font-medium ${TIER_STYLES[label]}`}>
      <span className="inline-flex items-center gap-1">
        <span>{label}</span>
        <span>{Math.round(confidence * 100)}%</span>
      </span>
      {showReason && (
        <span className="font-normal opacity-80">{truncate(reason)}</span>
      )}
    </span>
  );
}
