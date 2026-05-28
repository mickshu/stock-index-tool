import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Divider,
  Empty,
  Input,
  List,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  ExperimentOutlined,
  FileMarkdownOutlined,
  HistoryOutlined,
  LinkOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import {
  analyzeWithAIAgent,
  fetchAIAgentReport,
  listAIAgentReports,
  probeAIAgents,
  type AIAgentAnalyzeResult,
  type AIAgentInfo,
  type AIAgentReport,
} from '../api/aiAgent';
import MarkdownView from './MarkdownView';

interface Props {
  code: string;
  stockName?: string;
}

const DIMENSION_PRESETS = ['综合', '技术面', '基本面', '主力资金', '行业对比', '风险点'];

export default function AIAgentCard({ code, stockName }: Props) {
  const [agents, setAgents] = useState<AIAgentInfo[]>([]);
  const [agent, setAgent] = useState<string | undefined>(undefined);
  const [dimension, setDimension] = useState('综合');
  const [probing, setProbing] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AIAgentAnalyzeResult | null>(null);
  const [probeError, setProbeError] = useState<string | null>(null);
  const [reports, setReports] = useState<AIAgentReport[]>([]);
  const [viewingReport, setViewingReport] = useState<{ filename: string; content: string } | null>(null);
  const [viewingLoading, setViewingLoading] = useState(false);

  const reloadReports = useCallback(() => {
    listAIAgentReports(stockName || undefined)
      .then(setReports)
      .catch(() => {
        // 静默失败，列表不可用不影响主流程
      });
  }, [stockName]);

  const loadProbe = () => {
    setProbing(true);
    setProbeError(null);
    probeAIAgents()
      .then((list) => {
        setAgents(list);
        if (list.length > 0 && !list.find((a) => a.name === agent)) {
          setAgent(list[0].name);
        }
      })
      .catch((e) => {
        const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        setProbeError(detail || '探测失败');
      })
      .finally(() => setProbing(false));
  };

  useEffect(() => {
    loadProbe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    reloadReports();
  }, [reloadReports]);

  const handleAnalyze = async () => {
    if (!agent) {
      message.warning('请选择 AI 工具');
      return;
    }
    setRunning(true);
    setResult(null);
    setViewingReport(null);
    try {
      const data = await analyzeWithAIAgent({
        agent,
        code,
        name: stockName,
        dimension,
      });
      setResult(data);
      if (data.ok) {
        message.success(`分析完成（${data.duration.toFixed(1)}s）`);
        reloadReports();
      } else {
        message.error(`分析未成功（exit=${data.exit_code}）`);
      }
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      message.error(detail || '调用失败');
    } finally {
      setRunning(false);
    }
  };

  const handleViewReport = async (filename: string) => {
    setViewingLoading(true);
    try {
      const data = await fetchAIAgentReport(filename);
      setViewingReport(data);
    } catch {
      message.error('读取报告失败');
    } finally {
      setViewingLoading(false);
    }
  };

  const currentAgent = agents.find((a) => a.name === agent);

  return (
    <Card
      size="small"
      style={{ marginTop: 16 }}
      title={
        <Space wrap>
          <ExperimentOutlined />
          <span>本地 AI 分析</span>
          {currentAgent && <Tag color="purple">{currentAgent.label}</Tag>}
          {currentAgent?.version && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {currentAgent.version}
            </Typography.Text>
          )}
        </Space>
      }
      extra={
        <Button size="small" onClick={loadProbe} loading={probing}>
          重新探测
        </Button>
      }
    >
      {probeError && <Alert type="error" message={probeError} style={{ marginBottom: 12 }} />}

      {agents.length === 0 && !probing ? (
        <Empty description="未检测到本地 AI CLI（claude / codex / gemini / hermes）。请先在终端中安装并确保命令在 PATH 中。" />
      ) : (
        <>
          <Space wrap style={{ marginBottom: 12 }}>
            <Select
              style={{ minWidth: 180 }}
              placeholder="选择 AI 工具"
              value={agent}
              onChange={setAgent}
              loading={probing}
              options={agents.map((a) => ({
                value: a.name,
                label: `${a.label}${a.version ? ` · ${a.version}` : ''}`,
              }))}
            />
            <Select
              style={{ minWidth: 140 }}
              value={DIMENSION_PRESETS.includes(dimension) ? dimension : '自定义'}
              onChange={(v) => {
                if (v !== '自定义') setDimension(v);
              }}
              options={[
                ...DIMENSION_PRESETS.map((d) => ({ value: d, label: d })),
                { value: '自定义', label: '自定义…' },
              ]}
            />
            <Input
              style={{ minWidth: 220 }}
              placeholder="自定义分析维度（如：估值与同行对比）"
              value={dimension}
              onChange={(e) => setDimension(e.target.value)}
              allowClear
            />
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              loading={running}
              onClick={handleAnalyze}
              disabled={!agent}
            >
              开始分析
            </Button>
          </Space>

          <Spin spinning={running} tip="本地 CLI 运行中，可能需要较久…">
            {result ? (
              <>
                {!result.ok && result.stderr && (
                  <Alert
                    type="warning"
                    message={`exit=${result.exit_code}`}
                    description={
                      <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 12 }}>
                        {result.stderr}
                      </pre>
                    }
                    style={{ marginBottom: 12 }}
                  />
                )}
                {result.report_url && result.report_filename && (
                  <Alert
                    type="success"
                    showIcon
                    icon={<FileMarkdownOutlined />}
                    style={{ marginBottom: 12 }}
                    message={
                      <Space size={8} wrap>
                        <span>已保存报告：</span>
                        <a href={result.report_url} target="_blank" rel="noreferrer">
                          {result.report_filename}
                        </a>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          （同日同股将覆盖）
                        </Typography.Text>
                      </Space>
                    }
                  />
                )}
                {result.output ? (
                  <MarkdownView content={result.output} />
                ) : (
                  <Typography.Text type="secondary">（无输出）</Typography.Text>
                )}
              </>
            ) : (
              !running && !viewingReport && (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  选择工具与分析维度后，点击「开始分析」。结果由本地 CLI 直出，可能需要数十秒。
                </Typography.Text>
              )
            )}

            {viewingReport && !result && (
              <>
                <Alert
                  type="info"
                  showIcon
                  icon={<FileMarkdownOutlined />}
                  style={{ marginBottom: 12 }}
                  message={
                    <Space size={8} wrap>
                      <span>历史报告：</span>
                      <a
                        href={`/reports/${encodeURIComponent(viewingReport.filename)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {viewingReport.filename}
                      </a>
                      <Button size="small" type="link" onClick={() => setViewingReport(null)}>
                        关闭
                      </Button>
                    </Space>
                  }
                />
                <MarkdownView content={viewingReport.content} />
              </>
            )}
          </Spin>

          <Divider style={{ margin: '16px 0 8px' }} plain>
            <Space size={6}>
              <HistoryOutlined />
              <span style={{ fontSize: 13 }}>历史报告{stockName ? `（${stockName}）` : ''}</span>
              <Button size="small" type="link" onClick={reloadReports}>
                刷新
              </Button>
            </Space>
          </Divider>
          {reports.length === 0 ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              暂无历史报告。完成一次分析后会自动保存为 markdown 文件。
            </Typography.Text>
          ) : (
            <Spin spinning={viewingLoading} size="small">
              <List
                size="small"
                dataSource={reports}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      <Button
                        key="view"
                        type="link"
                        size="small"
                        onClick={() => handleViewReport(item.filename)}
                      >
                        查看
                      </Button>,
                      <a
                        key="open"
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: 12 }}
                      >
                        <LinkOutlined /> 原文
                      </a>,
                    ]}
                  >
                    <Space size={10} wrap>
                      <Tag color="blue">{item.date || '—'}</Tag>
                      <span style={{ fontSize: 13 }}>{item.name}</span>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {item.mtime}
                      </Typography.Text>
                    </Space>
                  </List.Item>
                )}
              />
            </Spin>
          )}
        </>
      )}
    </Card>
  );
}
