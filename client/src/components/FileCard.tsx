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

const ICON_STYLES: Record<string, string> = {
  pdf:  'bg-red-50 text-red-600',
  xlsx: 'bg-green-50 text-green-700',
  csv:  'bg-green-50 text-green-700',
  png:  'bg-purple-50 text-purple-600',
  md:   'bg-blue-50 text-blue-600',
};

export function FileCard({ file, onPatch, onDelete }: Props) {
  const [reviewing, setReviewing] = useState(false);
  const { classification } = file;

  const ext = file.filename.split('.').pop()?.toLowerCase() ?? '';
  const iconStyle = ICON_STYLES[ext] ?? 'bg-slate-50 text-slate-500';
  const iconLabel = ext.toUpperCase().slice(0, 3);

  const isPending = !classification.userConfirmed;

  async function handleSubmit(body: PatchClassificationBody) {
    await onPatch(file.id, body);
    setReviewing(false);
  }

  return (
    <div>
      <div
        className={[
          'flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-sm hover:shadow-md transition-shadow',
          isPending
            ? 'border-t border-r border-b border-slate-200 border-l-4 border-l-amber-400'
            : 'border border-slate-200',
        ].join(' ')}
      >
        {/* File-type icon */}
        <div className={`flex items-center justify-center w-9 h-9 rounded-lg text-xs font-bold flex-shrink-0 ${iconStyle}`}>
          {iconLabel}
        </div>

        {/* File info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">{file.filename}</p>
          <p className="text-xs text-slate-400">
            {file.month} · {ORIGIN_LABELS[classification.origin]} · {INFO_TYPE_LABELS[classification.infoType]}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <ConfidenceBadge
            confidence={classification.confidence}
            reason={classification.reason}
            overridden={classification.overridden}
            confirmed={classification.userConfirmed}
          />

          {!reviewing && (
            <button
              type="button"
              onClick={() => setReviewing(true)}
              className={
                isPending
                  ? 'text-xs border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg px-3 py-1 transition-colors'
                  : 'text-xs border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 rounded-lg px-3 py-1 transition-colors'
              }
            >
              {isPending ? 'Review' : 'Edit'}
            </button>
          )}

          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(file.id)}
              className="text-xs border border-red-200 text-red-500 hover:bg-red-50 rounded-lg px-2 py-1 transition-colors"
              aria-label="Delete file"
            >
              <span aria-hidden="true">✕</span>
            </button>
          )}
        </div>
      </div>

      {reviewing && (
        <OverrideForm
          classification={classification}
          onSubmit={handleSubmit}
          onCancel={() => setReviewing(false)}
        />
      )}
    </div>
  );
}
