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
  Grid,
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import KlineChart from '../components/KlineChart';
import SignalPanel from '../components/SignalPanel';
import SignalConfluence from '../components/SignalConfluence';
import { useAnalysisStore } from '../store/analysisStore';
import { fetchQuote } from '../api/market';
import type { Period } from '../types';

const { useBreakpoint } = Grid;

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
  const screens = useBreakpoint();
  const isMobile = !screens.md;
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
    showSignals,
    highlightPosition,
    setPeriod,
    setShowMA,
    setShowMACD,
    setShowKDJ,
    setShowRSI,
    setShowSignals,
    setHighlightPosition,
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
      <Space style={{ marginBottom: 16 }} wrap direction={isMobile ? 'vertical' : 'horizontal'}>
        <Space wrap>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {title}
          </Typography.Title>
          <Segmented
            options={periodOptions}
            value={period}
            onChange={(val) => setPeriod(val as Period)}
            size={isMobile ? 'small' : 'middle'}
          />
        </Space>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => loadAnalysis(code, true)}
          disabled={loading}
          size={isMobile ? 'small' : 'middle'}
        >
          Refresh
        </Button>
      </Space>

      {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}

      <SignalConfluence
        signals={signals}
        showMA={showMA}
        showMACD={showMACD}
        showKDJ={showKDJ}
        showRSI={showRSI}
        onSignalClick={(pos) => setHighlightPosition(pos)}
      />

      <Row gutter={isMobile ? 8 : 16}>
        <Col xs={24} lg={18}>
          <Card size="small" styles={{ body: { padding: isMobile ? 8 : 12 } }}>
            <div style={{ marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: isMobile ? '8px 12px' : '0 12px' }}>
              <Checkbox checked={showMA} onChange={(e) => setShowMA(e.target.checked)}>
                MA
              </Checkbox>
              <Checkbox checked={showMACD} onChange={(e) => setShowMACD(e.target.checked)}>
                MACD
              </Checkbox>
              <Checkbox checked={showKDJ} onChange={(e) => setShowKDJ(e.target.checked)}>
                KDJ
              </Checkbox>
              <Checkbox checked={showRSI} onChange={(e) => setShowRSI(e.target.checked)}>
                RSI
              </Checkbox>
              <Checkbox checked={showSignals} onChange={(e) => setShowSignals(e.target.checked)}>
                信号标注
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
                signals={signals}
                showSignals={showSignals}
                highlightPosition={highlightPosition}
              />
            </Spin>
          </Card>
        </Col>
        <Col xs={24} lg={6}>
          <Card size="small" title="Signals">
            <SignalPanel
              signals={signals}
              onSignalClick={(pos) => setHighlightPosition(pos)}
              showMA={showMA}
              showMACD={showMACD}
              showKDJ={showKDJ}
              showRSI={showRSI}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
