import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import { ExperimentOutlined, ThunderboltOutlined } from '@ant-design/icons';
import {
  analyzeWithAIAgent,
  probeAIAgents,
  type AIAgentAnalyzeResult,
  type AIAgentInfo,
} from '../api/aiAgent';

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

  const handleAnalyze = async () => {
    if (!agent) {
      message.warning('请选择 AI 工具');
      return;
    }
    setRunning(true);
    setResult(null);
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
                <Typography.Paragraph
                  style={{ whiteSpace: 'pre-wrap', marginBottom: 0, fontSize: 13 }}
                >
                  {result.output || '（无输出）'}
                </Typography.Paragraph>
              </>
            ) : (
              !running && (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  选择工具与分析维度后，点击「开始分析」。结果由本地 CLI 直出，可能需要数十秒。
                </Typography.Text>
              )
            )}
          </Spin>
        </>
      )}
    </Card>
  );
}
