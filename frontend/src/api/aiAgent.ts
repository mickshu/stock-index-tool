import api from './client';

export interface AIAgentInfo {
  name: string;
  label: string;
  binary: string;
  path: string;
  version: string;
}

export interface AIAgentAnalyzeResult {
  agent: string;
  ok: boolean;
  exit_code: number | null;
  duration: number;
  output: string;
  stderr: string;
  prompt: string;
}

export async function probeAIAgents(): Promise<AIAgentInfo[]> {
  const { data } = await api.get<{ agents: AIAgentInfo[] }>('/ai-agent/probe');
  return data.agents || [];
}

export async function analyzeWithAIAgent(payload: {
  agent: string;
  code: string;
  name?: string;
  dimension: string;
  timeout?: number;
}): Promise<AIAgentAnalyzeResult> {
  const { data } = await api.post<AIAgentAnalyzeResult>('/ai-agent/analyze', payload, {
    timeout: ((payload.timeout ?? 180) + 10) * 1000,
  });
  return data;
}
