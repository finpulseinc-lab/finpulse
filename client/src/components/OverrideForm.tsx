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
    <form
      onSubmit={handleSubmit}
      className="space-y-4 bg-slate-50 border border-slate-200 rounded-xl p-4 mt-3"
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label htmlFor="origin" className="block text-xs font-medium text-slate-600 uppercase tracking-wide">
            Origin
          </label>
          <select
            id="origin"
            value={origin}
            onChange={(e) => setOrigin(e.target.value as Origin)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {(Object.entries(ORIGIN_LABELS) as [Origin, string][]).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="infoType" className="block text-xs font-medium text-slate-600 uppercase tracking-wide">
            Info Type
          </label>
          <select
            id="infoType"
            value={infoType}
            onChange={(e) => setInfoType(e.target.value as InfoType)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {(Object.entries(INFO_TYPE_LABELS) as [InfoType, string][]).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5 transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Saving…' : 'Confirm'}
        </button>
      </div>
    </form>
  );
}
