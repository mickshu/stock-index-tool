export interface KlineData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface KlineResponse {
  code: string;
  period: string;
  stale: boolean;
  data: KlineData[];
}

export interface IndicatorData {
  MACD_DIF?: number | null;
  MACD_DEA?: number | null;
  MACD_HIST?: number | null;
  MA5?: number | null;
  MA10?: number | null;
  MA20?: number | null;
  MA60?: number | null;
  KDJ_K?: number | null;
  KDJ_D?: number | null;
  KDJ_J?: number | null;
  RSI6?: number | null;
  RSI12?: number | null;
  RSI24?: number | null;
}

export type SignalCategory = 'trend' | 'momentum' | 'reversal' | 'volume';
export type SignalLevel = 'bullish' | 'bearish' | 'neutral';

export interface Signal {
  type: string;
  indicator: string;
  description: string;
  date: string;
  position?: number;
  name?: string;
  category?: SignalCategory;
  level?: SignalLevel;
  explanation?: string;
  caveat?: string;
}

export interface AnalysisResponse {
  code: string;
  period: string;
  kline: (KlineData & IndicatorData)[];
  signals: Signal[];
}

export interface StockInfo {
  id?: number;
  code: string;
  name: string;
  market: string;
}

export interface IndexData {
  name: string;
  code: string;
  price: number;
  change_pct: number;
}

export type Period = 'daily' | 'weekly' | 'monthly' | '60min' | '30min' | '15min';
