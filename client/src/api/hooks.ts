import { useQuery, UseQueryResult } from '@tanstack/react-query';
import type { AuditEvent } from '../types';

// Relative API base for Domino - proxy may serve app at subpath
const API = './api';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json();
}

export interface AuditParams {
  startTimestamp: number;
  endTimestamp: number;
  actorId?: string;
  actorName?: string;
  limit?: number;
  offset?: number;
}

export function useAuditEvents(params: AuditParams | null, autoRefresh: boolean): UseQueryResult<AuditEvent[]> {
  return useQuery({
    queryKey: ['audit', params],
    queryFn: async () => {
      if (!params) return [];
      const url = new URL(API + '/audit', window.location.href);
      url.searchParams.set('startTimestamp', String(params.startTimestamp));
      url.searchParams.set('endTimestamp', String(params.endTimestamp));
      if (params.actorId) url.searchParams.set('actorId', params.actorId);
      if (params.actorName) url.searchParams.set('actorName', params.actorName);
      if (params.limit != null) url.searchParams.set('limit', String(params.limit));
      if (params.offset != null) url.searchParams.set('offset', String(params.offset));
      const data = await fetchJson<AuditEvent[] | { data?: AuditEvent[] }>(url.toString());
      if (Array.isArray(data)) return data;
      return (data as { data?: AuditEvent[] }).data ?? [];
    },
    enabled: params != null,
    refetchInterval: autoRefresh ? 30_000 : false,
  });
}

export interface DominoUser {
  id?: string;
  userName?: string;
  [key: string]: unknown;
}

export function useUsers(): UseQueryResult<DominoUser[]> {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const data = await fetchJson<DominoUser[] | { data?: DominoUser[] }>(API + '/users');
      if (Array.isArray(data)) return data;
      return (data as { data?: DominoUser[] }).data ?? [];
    },
  });
}

export function useCurrentUser(): UseQueryResult<DominoUser | null> {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const data = await fetchJson<DominoUser | null>(API + '/me');
      return data;
    },
  });
}
