import api from './client';
import type { StockInfo } from '../types';

export async function fetchWatchlist(): Promise<StockInfo[]> {
  const { data } = await api.get<StockInfo[]>('/stocks');
  return data;
}

export async function addStock(code: string, name = '', market = 'A'): Promise<StockInfo> {
  const { data } = await api.post<StockInfo>('/stocks', null, { params: { code, name, market } });
  return data;
}

export async function deleteStock(id: number): Promise<void> {
  await api.delete(`/stocks/${id}`);
}

export async function searchStocks(q: string): Promise<{ query: string; results: StockInfo[] }> {
  const { data } = await api.get<{ query: string; results: StockInfo[] }>('/stocks/search', {
    params: { q },
  });
  return data;
}

export interface DataSourceInfo {
  active: string;
  available: string[];
}

export async function fetchDataSources(): Promise<DataSourceInfo> {
  const { data } = await api.get<DataSourceInfo>('/data-sources');
  return data;
}

export async function switchDataSource(source: string): Promise<{ active: string }> {
  const { data } = await api.post<{ active: string }>('/data-sources/switch', null, {
    params: { source },
  });
  return data;
}
