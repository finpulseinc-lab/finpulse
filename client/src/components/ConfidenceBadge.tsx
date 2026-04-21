interface Props {
  confidence: number;
}

type Tier = 'High' | 'Medium' | 'Low';

function tier(confidence: number): Tier {
  if (confidence >= 0.8) return 'High';
  if (confidence >= 0.5) return 'Medium';
  return 'Low';
}

const STYLES: Record<Tier, string> = {
  High: 'bg-green-100 text-green-800',
  Medium: 'bg-yellow-100 text-yellow-800',
  Low: 'bg-red-100 text-red-800',
};

export function ConfidenceBadge({ confidence }: Props) {
  const label = tier(confidence);
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${STYLES[label]}`}>
      <span>{label}</span>
      <span>{Math.round(confidence * 100)}%</span>
    </span>
  );
}
