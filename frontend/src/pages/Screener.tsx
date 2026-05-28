import { useMemo, useState } from 'react';
import {
  Button,
  Card,
  Segmented,
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
  List,
  Collapse,
} from 'antd';
import { SearchOutlined, FilterOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { runScreener, type ScreenerStockResult } from '../api/screener';
import type { Signal } from '../types';

const { useBreakpoint } = Grid;
const { CheckableTag } = Tag;

const SIGNAL_CATEGORY_OPTIONS: { label: string; value: string }[] = [
  { label: '趋势', value: 'trend' },
  { label: '动量', value: 'momentum' },
  { label: '反转', value: 'reversal' },
  { label: '量能', value: 'volume' },
];

const SIGNAL_LEVEL_OPTIONS: { label: string; value: string }[] = [
  { label: '看多', value: 'bullish' },
  { label: '看空', value: 'bearish' },
];

const PERIOD_OPTIONS = [
  { label: '日线', value: 'daily' },
  { label: '周线', value: 'weekly' },
  { label: '月线', value: 'monthly' },
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
      <Popover content={popoverContent} title="全部信号">
        <Tag style={{ cursor: 'pointer' }}>+{remaining.length}</Tag>
      </Popover>
    </Space>
  );
}

interface ChipGroupProps {
  options: { label: string; value: string }[];
  values: string[];
  onChange: (values: string[]) => void;
}

function ChipGroup({ options, values, onChange }: ChipGroupProps) {
  const toggle = (val: string, checked: boolean) => {
    const next = checked ? [...values, val] : values.filter((v) => v !== val);
    onChange(next);
  };
  return (
    <Space size={[6, 6]} wrap>
      {options.map((opt) => {
        const checked = values.includes(opt.value);
        return (
          <CheckableTag
            key={opt.value}
            checked={checked}
            onChange={(c) => toggle(opt.value, c)}
            style={{ padding: '2px 10px', fontSize: 13, borderRadius: 12 }}
          >
            {opt.label}
          </CheckableTag>
        );
      })}
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

  const activeFilterCount = useMemo(
    () => categories.length + levels.length,
    [categories, levels],
  );

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
      message.error(detail || '扫描失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setCategories([]);
    setLevels([]);
    setRecentDays(3);
    setPeriod('daily');
  };

  const columns = [
    {
      title: '代码',
      dataIndex: 'code',
      key: 'code',
      width: 100,
      render: (v: string) => <Typography.Text code>{v}</Typography.Text>,
    },
    { title: '名称', dataIndex: 'name', key: 'name', width: 120 },
    {
      title: '最新价',
      dataIndex: 'latest_close',
      key: 'latest_close',
      width: 90,
      render: (v: number | null) => (v != null ? v.toFixed(2) : '-'),
    },
    {
      title: '信号数',
      key: 'signal_count',
      width: 110,
      render: (_: unknown, record: ScreenerStockResult) => {
        const bullish = record.matching_signals.filter((s) => s.level === 'bullish').length;
        const bearish = record.matching_signals.filter((s) => s.level === 'bearish').length;
        return (
          <Space size={4}>
            {bullish > 0 && <Tag color="green">多 {bullish}</Tag>}
            {bearish > 0 && <Tag color="red">空 {bearish}</Tag>}
            {bullish === 0 && bearish === 0 && <Tag>{record.matching_signals.length}</Tag>}
          </Space>
        );
      },
    },
    {
      title: '命中信号',
      key: 'signal_details',
      render: (_: unknown, record: ScreenerStockResult) => (
        <SignalTagsPopover signals={record.matching_signals} />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 90,
      render: (_: unknown, record: ScreenerStockResult) => (
        <Button type="link" size="small" onClick={() => navigate(`/stock/${record.code}`)}>
          分析
        </Button>
      ),
    },
  ];

  const renderMobileList = () => (
    <List
      itemLayout="vertical"
      size="small"
      dataSource={results}
      pagination={{ pageSize: 10, size: 'small', align: 'center' }}
      renderItem={(record) => {
        const bullish = record.matching_signals.filter((s) => s.level === 'bullish').length;
        const bearish = record.matching_signals.filter((s) => s.level === 'bearish').length;
        return (
          <List.Item
            key={record.code}
            style={{ padding: '10px 4px' }}
            actions={[
              <Button
                key="analyze"
                type="link"
                size="small"
                onClick={() => navigate(`/stock/${record.code}`)}
              >
                分析 →
              </Button>,
            ]}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: 6,
              }}
            >
              <Space size={6} wrap>
                <Typography.Text strong>{record.name}</Typography.Text>
                <Typography.Text code style={{ fontSize: 12 }}>
                  {record.code}
                </Typography.Text>
              </Space>
              <Typography.Text strong style={{ fontSize: 15 }}>
                {record.latest_close != null ? record.latest_close.toFixed(2) : '-'}
              </Typography.Text>
            </div>
            <Space size={4} wrap style={{ marginBottom: 6 }}>
              {bullish > 0 && <Tag color="green">多 {bullish}</Tag>}
              {bearish > 0 && <Tag color="red">空 {bearish}</Tag>}
              {bullish === 0 && bearish === 0 && (
                <Tag>{record.matching_signals.length}</Tag>
              )}
            </Space>
            <SignalTagsPopover signals={record.matching_signals} limit={3} />
          </List.Item>
        );
      }}
    />
  );

  const renderResults = () => {
    if (loading) {
      return (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      );
    }

    if (!hasScanned) {
      return <Empty description="设置筛选条件后点击「扫描」开始查找股票" />;
    }

    if (results.length === 0) {
      return <Empty description="没有匹配的股票，请放宽筛选条件" />;
    }

    return (
      <>
        <Typography.Text type="secondary" style={{ marginBottom: 12, display: 'block' }}>
          已扫描 {summary.total_stocks_screened} 只股票，命中 {summary.total_matches} 只
        </Typography.Text>
        {isMobile ? (
          renderMobileList()
        ) : (
          <Table
            rowKey={(r) => r.code}
            columns={columns}
            dataSource={results}
            size="middle"
            pagination={{ pageSize: 20 }}
            scroll={{ x: 680 }}
          />
        )}
      </>
    );
  };

  const filterBody = (
    <Space direction="vertical" size={isMobile ? 10 : 14} style={{ width: '100%' }}>
      <div>
        <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
          周期
        </Typography.Text>
        <Segmented
          value={period}
          onChange={(val) => setPeriod(val as string)}
          size={isMobile ? 'small' : 'middle'}
          options={PERIOD_OPTIONS}
          block={isMobile}
        />
      </div>

      <div>
        <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
          信号方向
        </Typography.Text>
        <ChipGroup options={SIGNAL_LEVEL_OPTIONS} values={levels} onChange={setLevels} />
      </div>

      <div>
        <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
          信号类别
        </Typography.Text>
        <ChipGroup
          options={SIGNAL_CATEGORY_OPTIONS}
          values={categories}
          onChange={setCategories}
        />
      </div>

      <div>
        <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
          最近交易日
        </Typography.Text>
        <Space size={8} wrap>
          <Select
            value={recentDays}
            onChange={(val) => setRecentDays(val)}
            style={{ width: 96 }}
            size={isMobile ? 'small' : 'middle'}
            options={Array.from({ length: 10 }, (_, i) => ({
              label: `${i + 1} 天`,
              value: i + 1,
            }))}
          />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            最近 N 个交易日内触发
          </Typography.Text>
        </Space>
      </div>

      <Space size={8} style={{ width: '100%' }}>
        <Button
          type="primary"
          icon={<SearchOutlined />}
          onClick={handleScan}
          loading={loading}
          block={isMobile}
        >
          扫描
        </Button>
        <Button onClick={handleReset}>重置</Button>
      </Space>
    </Space>
  );

  const filterTitle = (
    <Space size={6}>
      <FilterOutlined />
      <span>筛选器</span>
      {activeFilterCount > 0 && <Tag color="blue">{activeFilterCount}</Tag>}
    </Space>
  );

  return (
    <div>
      <Space style={{ marginBottom: 12 }} wrap>
        <Typography.Title level={4} style={{ margin: 0 }}>
          选股扫描
        </Typography.Title>
      </Space>

      {isMobile ? (
        <Collapse
          size="small"
          defaultActiveKey={['filters']}
          style={{ marginBottom: 12 }}
          items={[
            {
              key: 'filters',
              label: filterTitle,
              children: filterBody,
            },
          ]}
        />
      ) : (
        <Card title={filterTitle} size="small" style={{ marginBottom: 16 }}>
          {filterBody}
        </Card>
      )}

      {renderResults()}
    </div>
  );
}
