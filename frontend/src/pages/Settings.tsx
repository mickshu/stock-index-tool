import { useEffect, useState } from 'react';
import { Card, Radio, Typography, Space, Spin, message, Alert } from 'antd';
import { fetchDataSources, switchDataSource } from '../api/stocks';

export default function Settings() {
  const [active, setActive] = useState<string>('');
  const [available, setAvailable] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const reload = () => {
    setLoading(true);
    fetchDataSources()
      .then((d) => {
        setActive(d.active);
        setAvailable(d.available);
      })
      .catch(() => message.error('Failed to load data sources'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
  }, []);

  const handleSwitch = async (source: string) => {
    setSaving(true);
    try {
      const r = await switchDataSource(source);
      setActive(r.active);
      message.success(`Switched to ${r.active}`);
    } catch {
      message.error('Switch failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Typography.Title level={4}>Settings</Typography.Title>
      <Card title="Data Source" loading={loading}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message="Switch the upstream market data provider. Cached K-line data is reused if available."
          />
          <Spin spinning={saving}>
            <Radio.Group
              value={active}
              onChange={(e) => handleSwitch(e.target.value)}
              disabled={saving}
            >
              <Space direction="vertical">
                {available.map((src) => (
                  <Radio key={src} value={src}>
                    {src}
                  </Radio>
                ))}
              </Space>
            </Radio.Group>
          </Spin>
        </Space>
      </Card>
    </div>
  );
}
