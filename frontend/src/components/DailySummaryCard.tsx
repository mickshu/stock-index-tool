import { useEffect, useState } from 'react';
import { Button, Card, Empty, Space, Spin, Tag, Typography, message } from 'antd';
import { ReloadOutlined, OpenAIOutlined } from '@ant-design/icons';
import {
  fetchDailySummary,
  refreshDailySummary,
  type DailySummaryPayload,
} from '../api/summary';

export default function DailySummaryCard() {
  const [data, setData] = useState<DailySummaryPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchDailySummary(false)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (cancelled) return;
        const detail = (e as { response?: { data?: { detail?: string }; status?: number } })?.response?.data?.detail;
        const status = (e as { response?: { status?: number } })?.response?.status;
        if (status === 400) {
          setHint(detail || '未配置 AI');
        } else if (detail) {
          setHint(detail);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    setHint(null);
    try {
      const d = await refreshDailySummary();
      setData(d);
      message.success('已生成今日收盘总结');
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setHint(detail || '生成失败');
      message.error(detail || '生成失败');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Card
      size="small"
      title={
        <Space wrap>
          <OpenAIOutlined />
          <span>AI 收盘总结</span>
          {data?.model && <Tag color="purple">{data.model}</Tag>}
          {data?.generated_at && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              生成于 {data.generated_at.replace('T', ' ')}
            </Typography.Text>
          )}
        </Space>
      }
      extra={
        <Button
          icon={<ReloadOutlined />}
          size="small"
          loading={refreshing}
          onClick={handleRefresh}
        >
          {data ? '重新生成' : '生成总结'}
        </Button>
      }
      style={{ marginTop: 16 }}
    >
      <Spin spinning={loading || refreshing}>
        {data ? (
          <>
            <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 8 }}>
              {data.content}
            </Typography.Paragraph>
            {data.sources && data.sources.length > 0 && (
              <div>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  信息来源：
                </Typography.Text>
                <ul style={{ marginTop: 4, paddingLeft: 18 }}>
                  {data.sources.map((u) => (
                    <li key={u}>
                      <a href={u} target="_blank" rel="noreferrer">
                        {u}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <Empty description={hint || '点击右上角「生成总结」'} />
        )}
      </Spin>
    </Card>
  );
}
