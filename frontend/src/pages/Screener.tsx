import { useState } from 'react';
import {
  Button,
  Card,
  Segmented,
  Checkbox,
  Select,
  Table,
  Tag,
  Space,
  Typography,
  Empty,
  Spin,
  Popover,
  message,
  Grid,
} from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { runScreener, type ScreenerStockResult } from '../api/screener';
import type { Signal } from '../types';

const { useBreakpoint } = Grid;

const SIGNAL_CATEGORY_OPTIONS: { label: string; value: string }[] = [
  { label: 'Trend', value: 'trend' },
  { label: 'Momentum', value: 'momentum' },
  { label: 'Reversal', value: 'reversal' },
  { label: 'Volume', value: 'volume' },
];

const SIGNAL_LEVEL_OPTIONS: { label: string; value: string }[] = [
  { label: 'Bullish', value: 'bullish' },
  { label: 'Bearish', value: 'bearish' },
];

function levelColor(level?: string): string {
  if (level === 'bullish') return 'green';
  if (level === 'bearish') return 'red';
  return 'blue';
}

function SignalTagsPopover({ signals, limit = 5 }: { signals: Signal[]; limit?: number }) {
  const visible = signals.slice(0, limit);
  const remaining = signals.slice(limit);

  const renderTag = (s: Signal) => (
    <Tag key={`${s.date}-${s.type}`} color={levelColor(s.level)}>
      {s.name || s.type}
      {s.date ? ` (${s.date})` : ''}
    </Tag>
  );

  if (remaining.length === 0) {
    return <Space size={[4, 4]} wrap>{visible.map(renderTag)}</Space>;
  }

  const popoverContent = (
    <div style={{ maxWidth: 320 }}>
      <Space size={[4, 4]} wrap>
        {signals.map(renderTag)}
      </Space>
    </div>
  );

  return (
    <Space size={[4, 4]} wrap>
      {visible.map(renderTag)}
      <Popover content={popoverContent} title="All Signals">
        <Tag>+{remaining.length} more</Tag>
      </Popover>
    </Space>
  );
}

export default function Screener() {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [period, setPeriod] = useState<string>('daily');
  const [categories, setCategories] = useState<string[]>([]);
  const [levels, setLevels] = useState<string[]>([]);
  const [recentDays, setRecentDays] = useState<number>(3);
  const [results, setResults] = useState<ScreenerStockResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [summary, setSummary] = useState<{ total_stocks_screened: number; total_matches: number }>({
    total_stocks_screened: 0,
    total_matches: 0,
  });

  const handleScan = async () => {
    setLoading(true);
    try {
      const resp = await runScreener({
        period,
        signal_categories: categories.join(','),
        signal_levels: levels.join(','),
        recent_days: recentDays,
      });
      setResults(resp.results);
      setSummary({
        total_stocks_screened: resp.total_stocks_screened,
        total_matches: resp.total_matches,
      });
      setHasScanned(true);
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      message.error(detail || 'Screener scan failed');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      render: (v: string) => <Typography.Text code>{v}</Typography.Text>,
    },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Latest Price',
      dataIndex: 'latest_close',
      key: 'latest_close',
      render: (v: number | null) => (v != null ? v.toFixed(2) : '-'),
    },
    {
      title: 'Signals',
      key: 'signal_count',
      render: (_: unknown, record: ScreenerStockResult) => {
        const bullish = record.matching_signals.filter((s) => s.level === 'bullish').length;
        const bearish = record.matching_signals.filter((s) => s.level === 'bearish').length;
        return (
          <Space size={4}>
            {bullish > 0 && <Tag color="green">{bullish}</Tag>}
            {bearish > 0 && <Tag color="red">{bearish}</Tag>}
            {bullish === 0 && bearish === 0 && <Tag>{record.matching_signals.length}</Tag>}
          </Space>
        );
      },
    },
    {
      title: 'Signal Details',
      key: 'signal_details',
      render: (_: unknown, record: ScreenerStockResult) => (
        <SignalTagsPopover signals={record.matching_signals} />
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: ScreenerStockResult) => (
        <Button type="link" onClick={() => navigate(`/stock/${record.code}`)}>
          Analyze
        </Button>
      ),
    },
  ];

  const renderResults = () => {
    if (loading) {
      return (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      );
    }

    if (!hasScanned) {
      return (
        <Empty description="Configure filters above and click Scan to find stocks matching your criteria" />
      );
    }

    if (results.length === 0) {
      return (
        <Empty description="No stocks matched your criteria. Try broadening the filters." />
      );
    }

    return (
      <>
        <Typography.Text type="secondary" style={{ marginBottom: 12, display: 'block' }}>
          Scanned {summary.total_stocks_screened} stocks, found {summary.total_matches} matches
        </Typography.Text>
        <Table
          rowKey={(r) => r.code}
          columns={columns}
          dataSource={results}
          size={isMobile ? 'small' : 'middle'}
          pagination={{ pageSize: isMobile ? 10 : 20, size: isMobile ? 'small' : undefined }}
          scroll={{ x: 680 }}
        />
      </>
    );
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }} wrap>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Stock Screener
        </Typography.Title>
        <Button type="primary" icon={<SearchOutlined />} onClick={handleScan} loading={loading}>
          Scan
        </Button>
      </Space>

      <Card title="Filters" style={{ marginBottom: 16 }}>
        <Space direction="vertical" size={isMobile ? 'small' : 'middle'} style={{ width: '100%' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <Typography.Text strong style={{ marginRight: 4 }}>
              Period:
            </Typography.Text>
            <Segmented
              value={period}
              onChange={(val) => setPeriod(val as string)}
              size={isMobile ? 'small' : 'middle'}
              options={[
                { label: 'Daily', value: 'daily' },
                { label: 'Weekly', value: 'weekly' },
                { label: 'Monthly', value: 'monthly' },
              ]}
            />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <Typography.Text strong>
              Signal Categories:
            </Typography.Text>
            <Checkbox.Group
              options={SIGNAL_CATEGORY_OPTIONS}
              value={categories}
              onChange={(vals) => setCategories(vals as string[])}
            />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <Typography.Text strong>
              Signal Levels:
            </Typography.Text>
            <Checkbox.Group
              options={SIGNAL_LEVEL_OPTIONS}
              value={levels}
              onChange={(vals) => setLevels(vals as string[])}
            />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <Typography.Text strong>
              Recent Days:
            </Typography.Text>
            <Select
              value={recentDays}
              onChange={(val) => setRecentDays(val)}
              style={{ width: 80 }}
              size={isMobile ? 'small' : 'middle'}
              options={Array.from({ length: 10 }, (_, i) => ({
                label: `${i + 1}`,
                value: i + 1,
              }))}
            />
            <Typography.Text type="secondary">
              Signals within last N trading days
            </Typography.Text>
          </div>
        </Space>
      </Card>

      {renderResults()}
    </div>
  );
}
