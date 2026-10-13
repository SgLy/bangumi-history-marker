import type {
  CollectionsResponse,
  Me,
  RelatedSubject,
  SearchResult,
  Subject,
  UserCollection,
} from './types';
import { seasonEnd, seasonStart } from './seasons';
import { COLLECTION_WATCHED } from './collection';

const API_BASE = 'https://api.bgm.tv';
const COLLECTIONS_PAGE_SIZE = 50;
const COLLECTIONS_MAX = 2000;

export const SUBJECT_TYPE_ANIME = 2;

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface ErrorBody {
  title?: string;
  description?: string;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return String(error);
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ErrorBody;
    return body.description || body.title || `请求失败（HTTP ${response.status}）`;
  } catch {
    return `请求失败（HTTP ${response.status}）`;
  }
}

async function request<T>(
  path: string,
  init: RequestInit,
  token?: string,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined) headers.set('Content-Type', 'application/json');
  if (token !== undefined) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response));
  }
  // bangumi 收藏 POST 实测返回 202 且响应体为空（文档写的是 204），统一按空体处理
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export function verifyToken(token: string): Promise<Me> {
  return request<Me>('/v0/me', { method: 'GET' }, token);
}

export function searchSubjects(
  season: string,
  offset: number,
  limit = 50,
): Promise<SearchResult> {
  return request<SearchResult>(`/v0/search/subjects?limit=${limit}&offset=${offset}`, {
    method: 'POST',
    body: JSON.stringify({
      keyword: '',
      filter: {
        type: [SUBJECT_TYPE_ANIME],
        air_date: [`>=${seasonStart(season)}`, `<${seasonEnd(season)}`],
      },
      sort: 'heat',
    }),
  });
}

function normalizeDate<T extends { date?: string | null }>(item: T): T {
  return { ...item, date: item.date ?? null };
}

export async function getRelatedSubjects(id: number): Promise<RelatedSubject[]> {
  const related = await request<RelatedSubject[]>(`/v0/subjects/${id}/subjects`, {
    method: 'GET',
  });
  return related.map(normalizeDate);
}

export async function getSubject(id: number): Promise<Subject> {
  const subject = await request<Subject>(`/v0/subjects/${id}`, { method: 'GET' });
  return normalizeDate(subject);
}

export async function getUserCollections(
  username: string,
  token: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<{ items: UserCollection[]; complete: boolean }> {
  const all: UserCollection[] = [];
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;
  while (offset < total && all.length < COLLECTIONS_MAX) {
    const page = await request<CollectionsResponse>(
      `/v0/users/${encodeURIComponent(username)}/collections?subject_type=${SUBJECT_TYPE_ANIME}&limit=${COLLECTIONS_PAGE_SIZE}&offset=${offset}`,
      { method: 'GET' },
      token,
    );
    total = page.total;
    all.push(...page.data.slice(0, COLLECTIONS_MAX - all.length));
    offset += COLLECTIONS_PAGE_SIZE;
    onProgress?.(all.length, Math.min(total, COLLECTIONS_MAX));
    if (page.data.length === 0) break;
  }
  const items = all;
  return { items, complete: items.length >= total };
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

export function markAsPrivate(subjectId: number, token: string): Promise<void> {
  return request<void>(
    `/v0/users/-/collections/${subjectId}`,
    { method: 'POST', body: JSON.stringify({ type: COLLECTION_WATCHED, private: true }) },
    token,
  );
}

export function unmarkPrivate(subjectId: number, token: string): Promise<void> {
  return request<void>(
    `/v0/users/-/collections/${subjectId}`,
    { method: 'PATCH', body: JSON.stringify({ private: false }) },
    token,
  );
}
