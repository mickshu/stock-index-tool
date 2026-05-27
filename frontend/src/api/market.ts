import api from './client';
import type { KlineResponse, IndexData } from '../types';

export async function fetchKline(
  code: string,
  period: string,
  start?: string,
  end?: string,
  forceRefresh?: boolean,
): Promise<KlineResponse> {
  const params: Record<string, string | boolean | undefined> = {
    code,
    period,
    start,
    end,
    force_refresh: forceRefresh,
  };
  const { data } = await api.get<KlineResponse>('/market/kline', { params });
  return data;
}

export async function fetchIndices(): Promise<IndexData[]> {
  const { data } = await api.get<IndexData[]>('/market/indices');
  return data;
}
