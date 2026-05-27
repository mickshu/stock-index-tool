import { List, Tag, Typography } from 'antd';
import type { Signal } from '../types';

interface Props {
  signals: Signal[];
  onSignalClick?: (position: number) => void;
}

const signalColorMap: Record<string, string> = {
  golden_cross: 'red',
  death_cross: 'green',
  oversold: 'blue',
  overbought: 'orange',
};

export default function SignalPanel({ signals, onSignalClick }: Props) {
  if (signals.length === 0) {
    return <Typography.Text type="secondary">No signals detected.</Typography.Text>;
  }
  const recent = signals.slice(-30).reverse();
  return (
    <List
      size="small"
      dataSource={recent}
      renderItem={(s) => (
        <List.Item
          style={{ cursor: onSignalClick ? 'pointer' : 'default' }}
          onClick={() => onSignalClick?.(s.position ?? 0)}
        >
          <div>
            <Tag color={signalColorMap[s.type] || 'default'}>{s.indicator}</Tag>
            <Typography.Text>{s.description}</Typography.Text>
            <br />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {s.date}
            </Typography.Text>
          </div>
        </List.Item>
      )}
    />
  );
}
