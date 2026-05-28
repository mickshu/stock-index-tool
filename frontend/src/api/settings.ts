import api from './client';

export type AiProvider = 'openai' | 'anthropic';
export type SearchProvider = 'none' | 'tavily';

export interface AiSettings {
  provider: AiProvider;
  openai_base_url: string;
  openai_api_key: string;
  openai_model: string;
  anthropic_api_key: string;
  anthropic_model: string;
  search_provider: SearchProvider;
  tavily_api_key: string;
}

export async function fetchAiSettings(): Promise<AiSettings> {
  const { data } = await api.get<AiSettings>('/settings/ai');
  return data;
}

export async function saveAiSettings(payload: Partial<AiSettings> & { provider: AiProvider }): Promise<AiSettings> {
  const { data } = await api.put<AiSettings>('/settings/ai', payload);
  return data;
}
