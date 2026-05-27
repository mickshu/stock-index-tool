import { useMemo } from 'react';
import { Collapse, Empty, List, Popover, Space, Tag, Tooltip, Typography } from 'antd';
import { InfoCircleOutlined, WarningOutlined } from '@ant-design/icons';
import type { Signal, SignalCategory, SignalLevel } from '../types';

interface Props {
  signals: Signal[];
  onSignalClick?: (position: number) => void;
  showMA?: boolean;
  showMACD?: boolean;
  showKDJ?: boolean;
  showRSI?: boolean;
}

const CATEGORY_META: Record<SignalCategory, { label: string; color: string; desc: string }> = {
  trend: { label: '趋势', color: 'geekblue', desc: '反映中长期方向（MACD/MA 金叉死叉、价格突破均线等）' },
  momentum: { label: '动量', color: 'purple', desc: '反映短期动能强弱（KDJ 金叉死叉等）' },
  reversal: { label: '反转', color: 'magenta', desc: '反映超买超卖与潜在反转（RSI/KDJ 超买超卖）' },
  volume: { label: '量能', color: 'gold', desc: '成交量异常（放量、缩量）' },
};

const LEVEL_COLOR: Record<SignalLevel, string> = {
  bullish: '#ef5350',
  bearish: '#26a69a',
  neutral: '#faad14',
};

const CATEGORY_ORDER: SignalCategory[] = ['trend', 'momentum', 'reversal', 'volume'];

function inferCategory(s: Signal): SignalCategory {
  if (s.category) return s.category;
  if (s.type === 'golden_cross' || s.type === 'death_cross') return 'trend';
  if (s.type === 'overbought' || s.type === 'oversold') return 'reversal';
  return 'trend';
}

function inferLevel(s: Signal): SignalLevel {
  if (s.level) return s.level;
  if (
    s.type.includes('golden') ||
    s.type.includes('oversold') ||
    s.type.includes('breakout') ||
    s.type.includes('bull')
  ) {
    return 'bullish';
  }
  if (
    s.type.includes('death') ||
    s.type.includes('overbought') ||
    s.type.includes('breakdown') ||
    s.type.includes('bear')
  ) {
    return 'bearish';
  }
  return 'neutral';
}

function indicatorEnabled(
  s: Signal,
  showMA: boolean,
  showMACD: boolean,
  showKDJ: boolean,
  showRSI: boolean,
): boolean {
  const ind = s.indicator;
  if (ind === 'MA' || ind === 'PRICE') return showMA;
  if (ind === 'MACD') return showMACD;
  if (ind === 'KDJ') return showKDJ;
  if (ind === 'RSI') return showRSI;
  if (ind === 'VOL') return true;
  return true;
}

function SignalDetail({ signal }: { signal: Signal }) {
  return (
    <div style={{ maxWidth: 320 }}>
      <Typography.Paragraph style={{ marginBottom: 8 }}>
        <InfoCircleOutlined style={{ color: '#1677ff', marginRight: 6 }} />
        <Typography.Text strong>解释：</Typography.Text>
        {signal.explanation || '—'}
      </Typography.Paragraph>
      <Typography.Paragraph style={{ marginBottom: 0 }}>
        <WarningOutlined style={{ color: '#faad14', marginRight: 6 }} />
        <Typography.Text strong>误导说明：</Typography.Text>
        {signal.caveat || '—'}
      </Typography.Paragraph>
    </div>
  );
}

export default function SignalPanel({
  signals,
  onSignalClick,
  showMA = true,
  showMACD = true,
  showKDJ = true,
  showRSI = true,
}: Props) {
  const grouped = useMemo(() => {
    const map = new Map<SignalCategory, Signal[]>();
    const filtered = signals.filter((s) => indicatorEnabled(s, showMA, showMACD, showKDJ, showRSI));
    const sorted = [...filtered].sort((a, b) => (b.position ?? 0) - (a.position ?? 0));
    for (const s of sorted) {
      const cat = inferCategory(s);
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(s);
    }
    return map;
  }, [signals, showMA, showMACD, showKDJ, showRSI]);

  const totalShown = Array.from(grouped.values()).reduce((sum, list) => sum + list.length, 0);

  if (signals.length === 0) {
    return <Empty description="暂无识别到的技术信号" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }
  if (totalShown === 0) {
    return (
      <Empty
        description="勾选 MA / MACD / KDJ / RSI 后将在此显示对应信号"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  const items = CATEGORY_ORDER.filter((c) => grouped.has(c)).map((cat) => {
    const list = grouped.get(cat)!;
    const meta = CATEGORY_META[cat];
    const bull = list.filter((s) => inferLevel(s) === 'bullish').length;
    const bear = list.filter((s) => inferLevel(s) === 'bearish').length;
    const neut = list.length - bull - bear;
    return {
      key: cat,
      label: (
        <Space size={6} wrap>
          <Tag color={meta.color} style={{ marginRight: 0 }}>{meta.label}</Tag>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {list.length} 条
          </Typography.Text>
          {bull > 0 && (
            <Typography.Text style={{ fontSize: 12, color: LEVEL_COLOR.bullish }}>
              ↑{bull}
            </Typography.Text>
          )}
          {bear > 0 && (
            <Typography.Text style={{ fontSize: 12, color: LEVEL_COLOR.bearish }}>
              ↓{bear}
            </Typography.Text>
          )}
          {neut > 0 && (
            <Typography.Text style={{ fontSize: 12, color: LEVEL_COLOR.neutral }}>
              ·{neut}
            </Typography.Text>
          )}
          <Tooltip title={meta.desc}>
            <InfoCircleOutlined style={{ color: '#999' }} />
          </Tooltip>
        </Space>
      ),
      children: (
        <List
          size="small"
          dataSource={list}
          renderItem={(s) => {
            const lvl = inferLevel(s);
            const color = LEVEL_COLOR[lvl];
            return (
              <List.Item
                style={{ cursor: onSignalClick ? 'pointer' : 'default', padding: '6px 0' }}
                onClick={() => onSignalClick?.(s.position ?? 0)}
              >
                <div style={{ width: '100%' }}>
                  <Space size={6} align="center" wrap>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        backgroundColor: color,
                      }}
                    />
                    <Typography.Text style={{ fontSize: 12, color: '#888' }}>
                      {s.date}
                    </Typography.Text>
                    <Typography.Text strong style={{ color }}>
                      {s.name || s.type}
                    </Typography.Text>
                    <Tag style={{ marginRight: 0, fontSize: 11, lineHeight: '16px' }}>
                      {s.indicator}
                    </Tag>
                    <Popover
                      content={<SignalDetail signal={s} />}
                      title={s.name || s.type}
                      trigger="click"
                    >
                      <InfoCircleOutlined
                        style={{ color: '#1677ff', cursor: 'pointer' }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </Popover>
                  </Space>
                  <div style={{ marginLeft: 13 }}>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {s.description}
                    </Typography.Text>
                  </div>
                </div>
              </List.Item>
            );
          }}
        />
      ),
    };
  });

  return (
    <Collapse
      size="small"
      ghost
      defaultActiveKey={CATEGORY_ORDER.filter((c) => grouped.has(c))}
      items={items}
    />
  );
}
