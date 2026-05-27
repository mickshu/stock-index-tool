import { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Typography, Empty, message } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import type { IndexData } from '../types';
import { fetchIndices } from '../api/market';

export default function Dashboard() {
  const [indices, setIndices] = useState<IndexData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchIndices()
      .then(setIndices)
      .catch(() => message.error('Failed to load indices'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <Typography.Title level={4}>Market Overview</Typography.Title>
      {indices.length === 0 && !loading ? (
        <Empty description="No index data" />
      ) : (
        <Row gutter={16}>
          {indices.map((idx) => (
            <Col span={8} key={idx.code}>
              <Card loading={loading}>
                <Statistic
                  title={idx.name}
                  value={idx.price}
                  precision={2}
                  valueStyle={{ color: idx.change_pct >= 0 ? '#cf1322' : '#3f8600' }}
                  prefix={idx.change_pct >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                  suffix={
                    <span style={{ fontSize: 14 }}>{idx.change_pct.toFixed(2)}%</span>
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
