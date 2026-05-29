import api from './client';

export type AIAnalysisScope = 'single' | 'multi' | 'sector' | 'market' | 'pick';

export interface AITarget {
  code?: string;
  name?: string;
  sector?: string;
  index?: string;
}

export interface AIReportItem {
  id: number;
  scope: AIAnalysisScope;
  targets: AITarget[];
  target_label: string;
  dimensions: string[];
  agent: string;
  filename: string;
  url: string;
  output_chars: number;
  duration: number;
  exit_code: number | null;
  ok: boolean;
  starred: boolean;
  tags: string[];
  created_at: string | null;
  updated_at: string | null;
}

export interface AIReportDetail extends AIReportItem {
  content: string;
  prompt?: string | null;
}

export interface AIRunResult extends AIReportDetail {
  output: string;
  stderr: string;
}

export interface RunPayload {
  scope: AIAnalysisScope;
  targets: AITarget[];
  dimensions: string[];
  agent: string;
  timeout?: number;
}

export interface ListParams {
  scope?: AIAnalysisScope;
  agent?: string;
  starred?: boolean;
  q?: string;
  page?: number;
  size?: number;
}

export interface ListResponse {
  items: AIReportItem[];
  total: number;
  page: number;
  size: number;
}

export async function runAIAnalysis(payload: RunPayload): Promise<AIRunResult> {
  const { data } = await api.post<AIRunResult>('/ai-analysis/run', payload, {
    timeout: ((payload.timeout ?? 180) + 10) * 1000,
  });
  return data;
}

export async function listAIReports(params: ListParams): Promise<ListResponse> {
  const { data } = await api.get<ListResponse>('/ai-analysis/reports', { params });
  return data;
}

export async function getAIReport(id: number): Promise<AIReportDetail> {
  const { data } = await api.get<AIReportDetail>(`/ai-analysis/reports/${id}`);
  return data;
}

export interface UpdatePayload {
  starred?: boolean;
  tags?: string[];
}

export async function updateAIReport(id: number, payload: UpdatePayload): Promise<AIReportItem> {
  const { data } = await api.patch<AIReportItem>(`/ai-analysis/reports/${id}`, payload);
  return data;
}

export async function deleteAIReport(id: number): Promise<void> {
  await api.delete(`/ai-analysis/reports/${id}`);
}

export async function rerunAIReport(id: number): Promise<AIRunResult> {
  const { data } = await api.post<AIRunResult>(`/ai-analysis/reports/${id}/rerun`, {}, {
    timeout: 300_000,
  });
  return data;
}
