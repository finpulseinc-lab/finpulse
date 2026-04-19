import { useState } from 'react';
import type { FileRecord, PatchClassificationBody } from '../types';
import { ORIGIN_LABELS, INFO_TYPE_LABELS } from '../types';
import { ConfidenceBadge } from './ConfidenceBadge';
import { OverrideForm } from './OverrideForm';

interface Props {
  file: FileRecord;
  onPatch: (id: string, body: PatchClassificationBody) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export function FileCard({ file, onPatch, onDelete }: Props) {
  const [reviewing, setReviewing] = useState(false);
  const { classification } = file;

  async function handleSubmit(body: PatchClassificationBody) {
    await onPatch(file.id, body);
    setReviewing(false);
  }

  return (
    <div>
      <div>
        <span>{file.filename}</span>
        <span>{file.month}</span>
      </div>

      <div>
        <span>{ORIGIN_LABELS[classification.origin]}</span>
        <span>{INFO_TYPE_LABELS[classification.infoType]}</span>
        <ConfidenceBadge confidence={classification.confidence} />
      </div>

      {classification.userConfirmed && (
        <span>{classification.overridden ? 'Overridden' : 'Confirmed'}</span>
      )}

      {!classification.userConfirmed && !reviewing && (
        <button type="button" onClick={() => setReviewing(true)}>Review</button>
      )}

      {reviewing && (
        <OverrideForm
          classification={classification}
          onSubmit={handleSubmit}
          onCancel={() => setReviewing(false)}
        />
      )}

      {onDelete && (
        <button type="button" onClick={() => onDelete(file.id)}>Delete</button>
      )}
    </div>
  );
}
