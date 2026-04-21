import type {
  FileRecord,
  ListFilesResponse,
  InfoType,
  PatchClassificationBody,
} from '../types';

function headers(userId: string): Record<string, string> {
  return { 'X-User-ID': userId };
}

async function assertOk(res: Response): Promise<void> {
  if (!res.ok) throw new Error(String(res.status));
}

export async function listFiles(
  userId: string,
  params?: { confirmed?: false; infoType?: InfoType },
): Promise<ListFilesResponse> {
  const qs = new URLSearchParams();
  if (params?.confirmed === false) qs.set('confirmed', 'false');
  if (params?.infoType) qs.set('infoType', params.infoType);
  const query = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`/api/files${query}`, { headers: headers(userId) });
  await assertOk(res);
  return res.json() as Promise<ListFilesResponse>;
}

export async function getFile(userId: string, id: string): Promise<FileRecord> {
  const res = await fetch(`/api/files/${id}`, { headers: headers(userId) });
  await assertOk(res);
  return res.json() as Promise<FileRecord>;
}

export async function uploadFiles(userId: string, body: FormData): Promise<FileRecord[]> {
  const res = await fetch('/api/files/upload', {
    method: 'POST',
    headers: headers(userId),
    body,
  });
  await assertOk(res);
  return res.json() as Promise<FileRecord[]>;
}

export async function patchClassification(
  userId: string,
  id: string,
  body: PatchClassificationBody,
): Promise<FileRecord> {
  const res = await fetch(`/api/files/${id}/classification`, {
    method: 'PATCH',
    headers: { ...headers(userId), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  await assertOk(res);
  return res.json() as Promise<FileRecord>;
}

export async function deleteFile(userId: string, id: string): Promise<void> {
  const res = await fetch(`/api/files/${id}`, {
    method: 'DELETE',
    headers: headers(userId),
  });
  await assertOk(res);
}
