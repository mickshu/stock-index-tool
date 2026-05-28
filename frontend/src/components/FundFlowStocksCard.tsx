import { useEffect, useState } from 'react';
import { Card, Col, Row, Table, Typography, Tag, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { fetchFundFlowStocks, type FundFlowStockItem, type FundFlowStocks } from '../api/summary';

function fmtYi(v: number | null | undefined): string {
  if (v == null) return '—';
  return `${(v / 1e8).toFixed(2)} 亿`;
}

function fmtPct(v: number | null | undefined): { text: string; color?: string } {
  if (v == null) return { text: '—' };
  const color = v > 0 ? '#cf1322' : v < 0 ? '#3f8600' : undefined;
  const sign = v > 0 ? '+' : '';
  return { text: `${sign}${v.toFixed(2)}%`, color };
}

function makeColumns(): ColumnsType<FundFlowStockItem> {
  return [
    { title: '代码', dataIndex: 'code', key: 'code', width: 80 },
    { title: '名称', dataIndex: 'name', key: 'name', ellipsis: true },
    {
      title: '主力净额',
      dataIndex: 'main_net',
      key: 'main_net',
      align: 'right',
      render: (v: number) => {
        const c = v >= 0 ? '#cf1322' : '#3f8600';
        return <Typography.Text style={{ color: c }} strong>{fmtYi(v)}</Typography.Text>;
      },
    },
    {
      title: '涨跌幅',
      dataIndex: 'change_pct',
      key: 'change_pct',
      width: 90,
      align: 'right',
      render: (v: number) => {
        const { text, color } = fmtPct(v);
        return <Typography.Text style={{ color }}>{text}</Typography.Text>;
      },
    },
  ];
}

export default function FundFlowStocksCard() {
  const [data, setData] = useState<FundFlowStocks | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchFundFlowStocks(10)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const cols = makeColumns();
  const dateTag = data?.date ? <Tag color="blue">{data.date}</Tag> : null;

  return (
    <Card
      size="small"
      title={
        <>
          <span>主力资金 TOP10 个股</span>
          {dateTag && <span style={{ marginLeft: 8 }}>{dateTag}</span>}
        </>
      }
      loading={loading && !data}
      style={{ marginTop: 16 }}
    >
      {!data ? (
        <Empty description="数据源不可用" />
      ) : (
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Typography.Text type="secondary">资金净流入 TOP</Typography.Text>
            <Table<FundFlowStockItem>
              rowKey="code"
              size="small"
              columns={cols}
              dataSource={data.inflow}
              pagination={false}
              style={{ marginTop: 8 }}
            />
          </Col>
          <Col xs={24} md={12}>
            <Typography.Text type="secondary">资金净流出 TOP</Typography.Text>
            <Table<FundFlowStockItem>
              rowKey="code"
              size="small"
              columns={cols}
              dataSource={data.outflow}
              pagination={false}
              style={{ marginTop: 8 }}
            />
          </Col>
        </Row>
      )}
    </Card>
  );
}
