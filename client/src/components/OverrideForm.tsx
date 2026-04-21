import { useState } from 'react';
import type { ClassificationResult, Origin, InfoType, PatchClassificationBody } from '../types';
import { ORIGIN_LABELS, INFO_TYPE_LABELS } from '../types';

interface Props {
  classification: ClassificationResult;
  onSubmit: (body: PatchClassificationBody) => Promise<void>;
  onCancel?: () => void;
}

export function OverrideForm({ classification, onSubmit, onCancel }: Props) {
  const [origin, setOrigin] = useState<Origin>(classification.origin);
  const [infoType, setInfoType] = useState<InfoType>(classification.infoType);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const originChanged = origin !== classification.origin;
    const infoTypeChanged = infoType !== classification.infoType;

    let body: PatchClassificationBody;
    if (!originChanged && !infoTypeChanged) {
      body = { confirmed: true };
    } else {
      const override: { origin?: Origin; infoType?: InfoType } = {};
      if (originChanged) override.origin = origin;
      if (infoTypeChanged) override.infoType = infoType;
      body = { override };
    }

    setSubmitting(true);
    try {
      await onSubmit(body);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="origin">Origin</label>
        <select
          id="origin"
          value={origin}
          onChange={(e) => setOrigin(e.target.value as Origin)}
        >
          {(Object.entries(ORIGIN_LABELS) as [Origin, string][]).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="infoType">Info Type</label>
        <select
          id="infoType"
          value={infoType}
          onChange={(e) => setInfoType(e.target.value as InfoType)}
        >
          {(Object.entries(INFO_TYPE_LABELS) as [InfoType, string][]).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div>
        {onCancel && (
          <button type="button" onClick={onCancel}>Cancel</button>
        )}
        <button type="submit" disabled={submitting}>Confirm</button>
      </div>
    </form>
  );
}
