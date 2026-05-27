import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Spin,
  Alert,
  Typography,
  Segmented,
  Button,
  Space,
  Row,
  Col,
  Checkbox,
  Card,
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import KlineChart from '../components/KlineChart';
import SignalPanel from '../components/SignalPanel';
import { useAnalysisStore } from '../store/analysisStore';
import { fetchQuote } from '../api/market';
import type { Period } from '../types';

const periodOptions: { label: string; value: Period }[] = [
  { label: '日线', value: 'daily' },
  { label: '周线', value: 'weekly' },
  { label: '月线', value: 'monthly' },
  { label: '60分', value: '60min' },
  { label: '30分', value: '30min' },
  { label: '15分', value: '15min' },
];

export default function StockDetail() {
  const { code } = useParams<{ code: string }>();
  const [stockName, setStockName] = useState('');
  const {
    klineData,
    signals,
    period,
    loading,
    error,
    showMA,
    showMACD,
    showKDJ,
    showRSI,
    setPeriod,
    setShowMA,
    setShowMACD,
    setShowKDJ,
    setShowRSI,
    loadAnalysis,
  } = useAnalysisStore();

  useEffect(() => {
    if (code) loadAnalysis(code);
  }, [code, period, loadAnalysis]);

  useEffect(() => {
    if (code) {
      fetchQuote(code).then((q) => setStockName(q.name || '')).catch(() => setStockName(''));
    }
  }, [code]);

  if (!code) return <Alert type="error" message="No stock code provided" />;

  const chartHeight = 450 + ([showMACD, showKDJ, showRSI].filter(Boolean).length * 110);

  const title = stockName ? `${code} ${stockName}` : code;

  return (
    <div>
      <Space style={{ marginBottom: 16 }} wrap>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
        <Segmented
          options={periodOptions}
          value={period}
          onChange={(val) => setPeriod(val as Period)}
        />
        <Button
          icon={<ReloadOutlined />}
          onClick={() => loadAnalysis(code, true)}
          disabled={loading}
        >
          Refresh
        </Button>
      </Space>

      {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}

      <Row gutter={16}>
        <Col xs={24} lg={18}>
          <Card size="small" styles={{ body: { padding: 12 } }}>
            <div style={{ marginBottom: 8 }}>
              <Checkbox checked={showMA} onChange={(e) => setShowMA(e.target.checked)}>
                MA
              </Checkbox>
              <Checkbox
                checked={showMACD}
                onChange={(e) => setShowMACD(e.target.checked)}
                style={{ marginLeft: 12 }}
              >
                MACD
              </Checkbox>
              <Checkbox
                checked={showKDJ}
                onChange={(e) => setShowKDJ(e.target.checked)}
                style={{ marginLeft: 12 }}
              >
                KDJ
              </Checkbox>
              <Checkbox
                checked={showRSI}
                onChange={(e) => setShowRSI(e.target.checked)}
                style={{ marginLeft: 12 }}
              >
                RSI
              </Checkbox>
            </div>
            <Spin spinning={loading}>
              <KlineChart
                klineData={klineData}
                height={chartHeight}
                showMA={showMA}
                showMACD={showMACD}
                showKDJ={showKDJ}
                showRSI={showRSI}
              />
            </Spin>
          </Card>
        </Col>
        <Col xs={24} lg={6}>
          <Card size="small" title="Signals">
            <SignalPanel signals={signals} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
