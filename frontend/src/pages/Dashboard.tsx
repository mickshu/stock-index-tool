import { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Statistic, Typography, Empty, Button, Result } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, ReloadOutlined } from '@ant-design/icons';
import type { IndexData } from '../types';
import { fetchIndices } from '../api/market';

export default function Dashboard() {
  const [indices, setIndices] = useState<IndexData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchIndices()
      .then((data) => {
        setIndices(data);
        if (data.length === 0) setError('No index data available — data source may be unreachable');
      })
      .catch(() => setError('Failed to load indices'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Typography.Title level={4} style={{ margin: 0 }}>Market Overview</Typography.Title>
        </Col>
        <Col>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading} size="small">
            Refresh
          </Button>
        </Col>
      </Row>

      {loading && indices.length === 0 ? (
        <Row gutter={16}>
          {[1, 2, 3, 4].map((i) => (
            <Col xs={24} sm={12} md={6} key={i}>
              <Card loading style={{ minHeight: 120 }} />
            </Col>
          ))}
        </Row>
      ) : error && indices.length === 0 ? (
        <Result
          status="warning"
          title="Index Data Unavailable"
          subTitle={error}
          extra={
            <Button type="primary" icon={<ReloadOutlined />} onClick={load} loading={loading}>
              Retry
            </Button>
          }
        />
      ) : indices.length === 0 ? (
        <Empty description="No index data" />
      ) : (
        <Row gutter={16}>
          {indices.map((idx) => (
            <Col xs={24} sm={12} md={6} key={idx.code}>
              <Card>
                <Statistic
                  title={idx.name}
                  value={idx.price}
                  precision={2}
                  valueStyle={{
                    color: idx.change_pct >= 0 ? '#cf1322' : '#3f8600',
                    fontSize: 22,
                  }}
                  prefix={idx.change_pct >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                  suffix={
                    <span style={{ fontSize: 14, fontWeight: 500 }}>
                      {idx.change_pct >= 0 ? '+' : ''}{idx.change_pct.toFixed(2)}%
                    </span>
                  }
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
}
