interface Props {
  onUpload: (files: File[]) => void;
  uploading: boolean;
}

export function UploadZone({ onUpload, uploading }: Props) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) onUpload(files);
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) onUpload(files);
  }

  return (
    <label
      className={[
        'flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-8 bg-white shadow-sm transition-colors',
        uploading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-slate-50',
      ].join(' ')}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <input
        type="file"
        multiple
        accept=".pdf,.xlsx,.csv,.png,.md"
        disabled={uploading}
        onChange={handleChange}
        className="sr-only"
      />
      {uploading ? (
        <span className="text-sm text-slate-500">Uploading…</span>
      ) : (
        <>
          <span className="text-sm font-medium text-slate-700">Drop files here or click to browse</span>
          <span className="text-xs text-slate-400 mt-1">Accepted: pdf, xlsx, csv, png, md</span>
        </>
      )}
    </label>
  );
}
