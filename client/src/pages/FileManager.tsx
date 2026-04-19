import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { FileRecord, InfoType, PatchClassificationBody } from '../types';
import { INFO_TYPE_LABELS } from '../types';
import { listFiles, patchClassification, deleteFile, uploadFiles } from '../api/files';
import { FileCard } from '../components/FileCard';
import { UploadZone } from '../components/UploadZone';

interface Props { userId: string; }

type FilterStatus = 'all' | 'pending' | 'confirmed';

export function FileManager({ userId }: Props) {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const filterStatus = (searchParams.get('filter') ?? 'all') as FilterStatus;
  const filterInfoType = searchParams.get('infoType') ?? '';

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: { confirmed?: false; infoType?: InfoType } = {};
      if (filterStatus === 'pending') params.confirmed = false;
      if (filterInfoType) params.infoType = filterInfoType as InfoType;
      const data = await listFiles(userId, params);
      setFiles(data.files);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [userId, filterStatus, filterInfoType]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  async function handleUpload(selected: File[]) {
    setUploading(true);
    try {
      const fd = new FormData();
      for (const f of selected) fd.append('files', f);
      const newRecords = await uploadFiles(userId, fd);
      setFiles((prev) => [...newRecords, ...prev]);
    } finally {
      setUploading(false);
    }
  }

  async function handlePatch(id: string, body: PatchClassificationBody) {
    const updated = await patchClassification(userId, id, body);
    setFiles((prev) => prev.map((f) => f.id === id ? updated : f));
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this file?')) return;
    await deleteFile(userId, id);
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function setFilter(status: FilterStatus) {
    setSearchParams((p) => { p.set('filter', status); return p; });
  }

  function setInfoTypeFilter(val: string) {
    setSearchParams((p) => { if (val) p.set('infoType', val); else p.delete('infoType'); return p; });
  }

  const displayedFiles = filterStatus === 'confirmed'
    ? files.filter((f) => f.classification.userConfirmed)
    : files;

  const pendingCount = files.filter((f) => !f.classification.userConfirmed).length;
  const confirmedCount = files.filter((f) => f.classification.userConfirmed).length;
  const availableInfoTypes = [...new Set(files.map((f) => f.classification.infoType))];

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">FinPulse — File Manager</h1>

      <UploadZone onUpload={handleUpload} uploading={uploading} />

      <div className="flex gap-2 items-center flex-wrap">
        {(['all', 'pending', 'confirmed'] as FilterStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`text-sm px-3 py-1 rounded border ${filterStatus === s ? 'bg-blue-600 text-white' : ''}`}
          >
            {s === 'all' ? `All (${files.length})` : s === 'pending' ? `Pending review (${pendingCount})` : `Confirmed (${confirmedCount})`}
          </button>
        ))}

        <select
          value={filterInfoType}
          onChange={(e) => setInfoTypeFilter(e.target.value)}
          className="text-sm border rounded px-2 py-1 ml-auto"
          aria-label="Filter by info type"
        >
          <option value="">All types</option>
          {availableInfoTypes.map((t) => (
            <option key={t} value={t}>{INFO_TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>

      {filterInfoType && (
        <div className="text-sm">
          <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
            {INFO_TYPE_LABELS[filterInfoType as InfoType]}
            <button onClick={() => setInfoTypeFilter('')} className="ml-1 font-bold">×</button>
          </span>
        </div>
      )}

      {loading && <p className="text-sm text-gray-500">Loading…</p>}

      {error && (
        <div className="text-red-600 text-sm space-y-1">
          <p>Error loading files: {error}</p>
          <button onClick={fetchFiles} className="underline">Retry</button>
        </div>
      )}

      {!loading && !error && displayedFiles.length === 0 && (
        <p className="text-gray-400 text-sm text-center py-8">No files uploaded yet. Drop some files above to get started.</p>
      )}

      <div className="space-y-3">
        {displayedFiles.map((f) => (
          <FileCard
            key={f.id}
            file={f}
            onPatch={handlePatch}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
}
