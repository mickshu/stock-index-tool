import { useMemo } from 'react';
import { Collapse, Empty, List, Popover, Space, Tag, Tooltip, Typography } from 'antd';
import { InfoCircleOutlined, WarningOutlined } from '@ant-design/icons';
import type { Signal, SignalCategory, SignalLevel } from '../types';

interface Props {
  signals: Signal[];
  onSignalClick?: (position: number) => void;
}

const CATEGORY_META: Record<SignalCategory, { label: string; color: string; desc: string }> = {
  trend: { label: '趋势', color: 'geekblue', desc: '反映中长期方向（MACD/MA 金叉死叉、价格突破均线等）' },
  momentum: { label: '动量', color: 'purple', desc: '反映短期动能强弱（KDJ 金叉死叉等）' },
  reversal: { label: '反转', color: 'magenta', desc: '反映超买超卖与潜在反转（RSI/KDJ 超买超卖）' },
  volume: { label: '量能', color: 'gold', desc: '成交量异常（放量、缩量）' },
};

const LEVEL_META: Record<SignalLevel, { label: string; color: string }> = {
  bullish: { label: '看多', color: 'red' },
  bearish: { label: '看空', color: 'green' },
  neutral: { label: '中性', color: 'default' },
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

export default function SignalPanel({ signals, onSignalClick }: Props) {
  const grouped = useMemo(() => {
    const map = new Map<SignalCategory, Signal[]>();
    const recent = [...signals].slice(-60).reverse();
    for (const s of recent) {
      const cat = inferCategory(s);
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(s);
    }
    return map;
  }, [signals]);

  if (signals.length === 0) {
    return <Empty description="暂无识别到的技术信号" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  const items = CATEGORY_ORDER.filter((c) => grouped.has(c)).map((cat) => {
    const list = grouped.get(cat)!;
    const meta = CATEGORY_META[cat];
    return {
      key: cat,
      label: (
        <Space size={6}>
          <Tag color={meta.color} style={{ marginRight: 0 }}>{meta.label}</Tag>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {list.length} 条
          </Typography.Text>
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
            const level = LEVEL_META[inferLevel(s)];
            return (
              <List.Item
                style={{ cursor: onSignalClick ? 'pointer' : 'default', padding: '6px 0' }}
                onClick={() => onSignalClick?.(s.position ?? 0)}
              >
                <div style={{ width: '100%' }}>
                  <Space size={4} wrap>
                    <Tag color={level.color} style={{ marginRight: 0 }}>{level.label}</Tag>
                    <Tag style={{ marginRight: 0 }}>{s.indicator}</Tag>
                    <Typography.Text strong>{s.name || s.description}</Typography.Text>
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
                  <div>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {s.date} · {s.description}
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
