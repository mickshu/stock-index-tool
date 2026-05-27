import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import type { KlineData, IndicatorData } from '../types';

interface Props {
  klineData: (KlineData & Partial<IndicatorData>)[];
  height?: number;
  showMA?: boolean;
  showMACD?: boolean;
  showKDJ?: boolean;
  showRSI?: boolean;
}

interface GridSpec {
  id: string;
  type: 'price' | 'volume' | 'macd' | 'kdj' | 'rsi';
}

export default function KlineChart({
  klineData,
  height = 600,
  showMA = true,
  showMACD = false,
  showKDJ = false,
  showRSI = false,
}: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    if (!instanceRef.current) {
      instanceRef.current = echarts.init(chartRef.current);
    }
    const chart = instanceRef.current;

    if (klineData.length === 0) {
      chart.clear();
      return;
    }

    const dates = klineData.map((d) => d.date);
    const ohlc = klineData.map((d) => [d.open, d.close, d.low, d.high]);
    const volumes = klineData.map((d) => d.volume);

    const grids: GridSpec[] = [
      { id: 'price', type: 'price' },
      { id: 'volume', type: 'volume' },
    ];
    if (showMACD) grids.push({ id: 'macd', type: 'macd' });
    if (showKDJ) grids.push({ id: 'kdj', type: 'kdj' });
    if (showRSI) grids.push({ id: 'rsi', type: 'rsi' });

    const total = grids.length;
    const extra = total - 1;
    const priceHeight = total === 2 ? 60 : 50;
    const subHeight = extra === 0 ? 20 : (95 - priceHeight - 5) / extra;
    const gridConfigs: Record<string, unknown>[] = [];
    let top = 8;
    grids.forEach((_, idx) => {
      const h = idx === 0 ? priceHeight : subHeight;
      gridConfigs.push({ left: '8%', right: '6%', top: `${top}%`, height: `${h}%` });
      top += h + 3;
    });

    const xAxes = grids.map((_, idx) => ({
      type: 'category',
      data: dates,
      gridIndex: idx,
      axisLabel: { show: idx === grids.length - 1 },
      axisLine: { onZero: false },
      splitLine: { show: false },
    }));
    const yAxes = grids.map((g, idx) => ({
      type: 'value',
      gridIndex: idx,
      scale: g.type === 'price',
      splitNumber: 3,
    }));

    const series: Record<string, unknown>[] = [
      {
        type: 'candlestick',
        name: 'K线',
        data: ohlc,
        xAxisIndex: 0,
        yAxisIndex: 0,
        itemStyle: {
          color: '#ef5350',
          color0: '#26a69a',
          borderColor: '#ef5350',
          borderColor0: '#26a69a',
        },
      },
    ];

    if (showMA) {
      const maColors = ['#f5a623', '#4a90d9', '#7ed321', '#9b59b6'];
      (['MA5', 'MA10', 'MA20', 'MA60'] as const).forEach((key, i) => {
        const vals = klineData.map((d) => d[key] ?? null);
        if (vals.some((v) => v != null)) {
          series.push({
            type: 'line',
            name: key,
            data: vals,
            xAxisIndex: 0,
            yAxisIndex: 0,
            smooth: true,
            symbol: 'none',
            lineStyle: { width: 1, color: maColors[i] },
          });
        }
      });
    }

    const volumeGridIdx = grids.findIndex((g) => g.type === 'volume');
    series.push({
      type: 'bar',
      name: '成交量',
      data: volumes,
      xAxisIndex: volumeGridIdx,
      yAxisIndex: volumeGridIdx,
      itemStyle: {
        color: (params: { dataIndex: number }) => {
          const d = ohlc[params.dataIndex];
          return d && d[1] >= d[0] ? '#ef5350' : '#26a69a';
        },
      },
    });

    const macdGridIdx = grids.findIndex((g) => g.type === 'macd');
    if (showMACD && macdGridIdx >= 0) {
      series.push({
        type: 'line',
        name: 'DIF',
        data: klineData.map((d) => d.MACD_DIF ?? null),
        xAxisIndex: macdGridIdx,
        yAxisIndex: macdGridIdx,
        symbol: 'none',
        lineStyle: { width: 1, color: '#2962ff' },
      });
      series.push({
        type: 'line',
        name: 'DEA',
        data: klineData.map((d) => d.MACD_DEA ?? null),
        xAxisIndex: macdGridIdx,
        yAxisIndex: macdGridIdx,
        symbol: 'none',
        lineStyle: { width: 1, color: '#ff6f00' },
      });
      series.push({
        type: 'bar',
        name: 'MACD',
        data: klineData.map((d) => d.MACD_HIST ?? null),
        xAxisIndex: macdGridIdx,
        yAxisIndex: macdGridIdx,
        itemStyle: {
          color: (params: { data: number | null }) =>
            params.data != null && params.data >= 0 ? '#ef5350' : '#26a69a',
        },
      });
    }

    const kdjGridIdx = grids.findIndex((g) => g.type === 'kdj');
    if (showKDJ && kdjGridIdx >= 0) {
      const colors = ['#2962ff', '#ff6f00', '#7ed321'];
      (['KDJ_K', 'KDJ_D', 'KDJ_J'] as const).forEach((key, i) => {
        series.push({
          type: 'line',
          name: key.replace('KDJ_', 'KDJ-'),
          data: klineData.map((d) => d[key] ?? null),
          xAxisIndex: kdjGridIdx,
          yAxisIndex: kdjGridIdx,
          symbol: 'none',
          lineStyle: { width: 1, color: colors[i] },
        });
      });
    }

    const rsiGridIdx = grids.findIndex((g) => g.type === 'rsi');
    if (showRSI && rsiGridIdx >= 0) {
      const colors = ['#2962ff', '#ff6f00', '#7ed321'];
      (['RSI6', 'RSI12', 'RSI24'] as const).forEach((key, i) => {
        series.push({
          type: 'line',
          name: key,
          data: klineData.map((d) => d[key] ?? null),
          xAxisIndex: rsiGridIdx,
          yAxisIndex: rsiGridIdx,
          symbol: 'none',
          lineStyle: { width: 1, color: colors[i] },
        });
      });
    }

    const allAxisIndexes = grids.map((_, i) => i);

    chart.setOption(
      {
        tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
        legend: { top: 0 },
        grid: gridConfigs,
        xAxis: xAxes,
        yAxis: yAxes,
        series,
        dataZoom: [
          { type: 'inside', xAxisIndex: allAxisIndexes, start: 60, end: 100 },
          { type: 'slider', xAxisIndex: allAxisIndexes, start: 60, end: 100, bottom: 8, height: 18 },
        ],
      },
      true,
    );
  }, [klineData, showMA, showMACD, showKDJ, showRSI]);

  useEffect(() => {
    instanceRef.current?.resize();
  }, [height]);

  useEffect(() => {
    const handleResize = () => instanceRef.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, []);

  return <div ref={chartRef} style={{ width: '100%', height }} />;
}
