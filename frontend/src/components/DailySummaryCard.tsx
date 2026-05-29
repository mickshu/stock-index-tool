import { useEffect, useState } from 'react';
import { Button, Card, Empty, Space, Spin, Tag, Typography, message, Grid } from 'antd';
import { ReloadOutlined, OpenAIOutlined } from '@ant-design/icons';
import {
  fetchDailySummary,
  refreshDailySummary,
  type DailySummaryPayload,
} from '../api/summary';
import MarkdownView from './MarkdownView';

const { useBreakpoint } = Grid;

export default function DailySummaryCard() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
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
        <Space wrap size={6}>
          <OpenAIOutlined />
          <span>AI 收盘总结</span>
          {data?.model && <Tag color="purple" style={{ marginRight: 0 }}>{data.model}</Tag>}
        </Space>
      }
      extra={
        <Button
          icon={<ReloadOutlined />}
          size="small"
          loading={refreshing}
          onClick={handleRefresh}
        >
          {data ? '重新生成' : '生成'}
        </Button>
      }
      style={{ marginTop: isMobile ? 12 : 16 }}
    >
      <Spin spinning={loading || refreshing}>
        {data ? (
          <>
            <MarkdownView content={data.content} />
            {!isMobile && data.sources && data.sources.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  信息来源：
                </Typography.Text>
                <ul style={{ marginTop: 4, paddingLeft: 18 }}>
                  {data.sources.map((u) => (
                    <li key={u}>
                      <a href={u} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
                        {u}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <Empty description={hint || '点击「生成」获取今日总结'} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Spin>
    </Card>
  );
}
