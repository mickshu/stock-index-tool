import { useEffect, useMemo, useState } from 'react';
import {
  Tabs,
  Card,
  Radio,
  Select,
  Input,
  Button,
  Space,
  Alert,
  Spin,
  Empty,
  Tag,
  Drawer,
  Table,
  message,
  Typography,
  Grid,
  Checkbox,
  Popconfirm,
  Tooltip,
  Modal,
} from 'antd';
import {
  ExperimentOutlined,
  ThunderboltOutlined,
  HistoryOutlined,
  StarFilled,
  StarOutlined,
  FileMarkdownOutlined,
  DeleteOutlined,
  RedoOutlined,
  DownloadOutlined,
  SwapOutlined,
  TagsOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  runAIAnalysis,
  listAIReports,
  getAIReport,
  updateAIReport,
  deleteAIReport,
  rerunAIReport,
  type AIReportItem,
  type AIReportDetail,
  type AIAnalysisScope,
  type AITarget,
} from '../api/aiAnalysis';
import { probeAIAgents, type AIAgentInfo } from '../api/aiAgent';
import MarkdownView from '../components/MarkdownView';
import StockSearchInput from '../components/StockSearchInput';

const { useBreakpoint } = Grid;

const DIMENSION_PRESETS = [
  '综合', '技术面', '基本面', '主力资金', '行业对比', '风险点', '消息面', '催化剂',
];

const SCOPE_LABELS: Record<AIAnalysisScope, string> = {
  single: '单股',
  multi: '多股对比',
  sector: '板块',
  market: '大盘',
  pick: '批量诊断',
};

const SCOPE_COLOR: Record<AIAnalysisScope, string> = {
  single: 'blue',
  multi: 'geekblue',
  sector: 'purple',
  market: 'magenta',
  pick: 'cyan',
};

const MARKET_INDICES: { value: string; label: string }[] = [
  { value: 'sh000001', label: '上证指数' },
  { value: 'sz399001', label: '深证成指' },
  { value: 'sz399006', label: '创业板指' },
  { value: 'sh000688', label: '科创50' },
  { value: 'sh000300', label: '沪深300' },
  { value: 'sh000905', label: '中证500' },
];

function ScopeTag({ scope }: { scope: AIAnalysisScope }) {
  return <Tag color={SCOPE_COLOR[scope]} style={{ marginRight: 0 }}>{SCOPE_LABELS[scope]}</Tag>;
}

interface RunSnapshot {
  ok: boolean;
  output: string;
  stderr: string;
  filename: string;
  url: string;
  duration: number;
  exit_code: number | null;
}

// 把 textarea 文本（每行：code 名称 或 code）解析成 AITarget[]
function parseStockLines(text: string): AITarget[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^([A-Za-z0-9.]+)[\s,\t]+(.+)$/);
      if (m) return { code: m[1].trim(), name: m[2].trim() };
      return { code: line };
    });
}

// 从 stockText 中删除某只股票（按 code 匹配）
function removeStockLine(text: string, code: string): string {
  return text
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      const m = trimmed.match(/^([A-Za-z0-9.]+)/);
      return m ? m[1] !== code : true;
    })
    .join('\n');
}

function NewAnalysis({ onSuccess }: { onSuccess: () => void }) {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [scope, setScope] = useState<AIAnalysisScope>('single');
  // single
  const [singleCode, setSingleCode] = useState('');
  const [singleName, setSingleName] = useState('');
  // multi / pick（共用 textarea）
  const [stockText, setStockText] = useState('');
  // sector
  const [sectorText, setSectorText] = useState('');
  // market
  const [marketIdx, setMarketIdx] = useState<string[]>(['sh000001', 'sh000300']);

  const [dimensions, setDimensions] = useState<string[]>(['综合']);
  const [agents, setAgents] = useState<AIAgentInfo[]>([]);
  const [agent, setAgent] = useState<string | undefined>(undefined);
  const [probeErr, setProbeErr] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunSnapshot | null>(null);

  useEffect(() => {
    probeAIAgents()
      .then((list) => {
        setAgents(list);
        if (list.length > 0) setAgent(list[0].name);
      })
      .catch((e) => {
        const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        setProbeErr(detail || '探测失败');
      });
  }, []);

  const buildTargets = (): AITarget[] => {
    if (scope === 'single') {
      return [{ code: singleCode.trim(), name: singleName.trim() || undefined }];
    }
    if (scope === 'multi' || scope === 'pick') {
      return parseStockLines(stockText);
    }
    if (scope === 'sector') {
      return sectorText
        .split(/[、,，;；]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => ({ sector: s }));
    }
    if (scope === 'market') {
      return marketIdx
        .map((v) => MARKET_INDICES.find((m) => m.value === v))
        .filter(Boolean)
        .map((m) => ({ index: m!.value, name: m!.label }));
    }
    return [];
  };

  const validate = (targets: AITarget[]): string | null => {
    if (!agent) return '请选择 AI 工具';
    if (scope === 'single' && !targets[0]?.code) return '请输入股票代码';
    if (scope === 'multi' && targets.length < 2) return '多股对比至少需要 2 只股票（每行一只）';
    if (scope === 'pick' && targets.length < 1) return '批量诊断至少需要 1 只股票';
    if (scope === 'sector' && targets.length < 1) return '请输入至少一个板块名';
    if (scope === 'market' && targets.length < 1) return '请勾选至少一个指数';
    return null;
  };

  const handleRun = async () => {
    const targets = buildTargets();
    const err = validate(targets);
    if (err) {
      message.warning(err);
      return;
    }
    setRunning(true);
    setResult(null);
    try {
      const data = await runAIAnalysis({
        scope,
        targets,
        dimensions: dimensions.length ? dimensions : ['综合'],
        agent: agent!,
        timeout: scope === 'single' ? 180 : 300,
      });
      setResult({
        ok: data.ok,
        output: data.output,
        stderr: data.stderr,
        filename: data.filename,
        url: data.url,
        duration: data.duration,
        exit_code: data.exit_code,
      });
      if (data.ok) {
        message.success(`完成（${data.duration.toFixed(1)}s）`);
        onSuccess();
      } else {
        message.error(`未成功（exit=${data.exit_code}）`);
      }
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      message.error(detail || '调用失败');
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card size="small" styles={{ body: { padding: isMobile ? 12 : 16 } }}>
      {probeErr && <Alert type="error" title={probeErr} style={{ marginBottom: 12 }} />}

      <div style={{ marginBottom: 16 }}>
        <Typography.Text strong>分析对象</Typography.Text>
        <div style={{ marginTop: 6 }}>
          <Radio.Group value={scope} onChange={(e) => setScope(e.target.value)}>
            <Radio value="single">单股</Radio>
            <Radio value="multi">多股对比</Radio>
            <Radio value="sector">板块</Radio>
            <Radio value="market">大盘</Radio>
            <Radio value="pick">批量诊断</Radio>
          </Radio.Group>
        </div>

        {scope === 'single' && (
          <div style={{ marginTop: 10 }}>
            <StockSearchInput
              value={singleCode}
              onChange={(v) => {
                setSingleCode(v);
                if (!v.trim()) setSingleName('');
              }}
              onSelect={(stock) => {
                setSingleCode(stock.code);
                setSingleName(stock.name);
              }}
              style={{ maxWidth: isMobile ? '100%' : 420 }}
            />
            {singleName && (
              <Typography.Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'inline-block' }}>
                已选：{singleName}
              </Typography.Text>
            )}
          </div>
        )}

        {(scope === 'multi' || scope === 'pick') && (
          <div style={{ marginTop: 10 }}>
            <div style={{ marginBottom: 8 }}>
              <StockSearchInput
                onSelect={(stock) => {
                  const existing = parseStockLines(stockText);
                  if (existing.some((t) => t.code === stock.code)) return;
                  const line = `${stock.code} ${stock.name}`.trim();
                  setStockText(stockText ? `${stockText.replace(/\s+$/, '')}\n${line}` : line);
                }}
                placeholder="搜索股票添加到下方列表（也可直接粘贴多行）"
              />
            </div>
            <Input.TextArea
              placeholder={
                scope === 'multi'
                  ? '每行一只股票：代码<空格>名称\n例：\n600519 贵州茅台\n000858 五粮液'
                  : '每行一只股票（建议 5–20 只）：代码<空格>名称'
              }
              autoSize={{ minRows: 4, maxRows: 10 }}
              value={stockText}
              onChange={(e) => setStockText(e.target.value)}
            />
            {(() => {
              const parsed = parseStockLines(stockText);
              if (parsed.length === 0) {
                return (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    尚未添加股票
                  </Typography.Text>
                );
              }
              return (
                <div style={{ marginTop: 6 }}>
                  <Typography.Text type="secondary" style={{ fontSize: 12, marginRight: 6 }}>
                    已添加 {parsed.length} 只：
                  </Typography.Text>
                  <Space size={[6, 6]} wrap style={{ marginTop: 4 }}>
                    {parsed.map((t) => (
                      <Tag
                        key={t.code}
                        closable
                        onClose={(e) => {
                          e.preventDefault();
                          setStockText(removeStockLine(stockText, t.code!));
                        }}
                        style={{ marginRight: 0 }}
                      >
                        {t.code}{t.name ? ` ${t.name}` : ''}
                      </Tag>
                    ))}
                  </Space>
                </div>
              );
            })()}
          </div>
        )}

        {scope === 'sector' && (
          <div style={{ marginTop: 10 }}>
            <Input
              placeholder="板块名，多个用逗号/顿号分隔，如：白酒、新能源"
              value={sectorText}
              onChange={(e) => setSectorText(e.target.value)}
              style={{ width: '100%' }}
              allowClear
            />
          </div>
        )}

        {scope === 'market' && (
          <div style={{ marginTop: 10 }}>
            <Checkbox.Group
              value={marketIdx}
              onChange={(v) => setMarketIdx(v as string[])}
              options={MARKET_INDICES}
            />
          </div>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <Typography.Text strong>分析维度</Typography.Text>
        <Select
          mode="tags"
          style={{ width: '100%', marginTop: 6 }}
          placeholder="选择或输入维度"
          value={dimensions}
          onChange={setDimensions}
          options={DIMENSION_PRESETS.map((d) => ({ value: d, label: d }))}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <Typography.Text strong>AI 工具</Typography.Text>
        <div style={{ marginTop: 6 }}>
          {agents.length === 0 && !probeErr ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="未检测到本地 AI CLI（claude / codex / gemini / hermes）"
            />
          ) : (
            <Select
              style={{ width: isMobile ? '100%' : 280 }}
              value={agent}
              onChange={setAgent}
              options={agents.map((a) => ({
                value: a.name,
                label: `${a.label}${a.version ? ` · ${a.version}` : ''}`,
              }))}
            />
          )}
        </div>
      </div>

      <Button
        type="primary"
        icon={<ThunderboltOutlined />}
        loading={running}
        onClick={handleRun}
        disabled={!agent}
        size="large"
        block={isMobile}
      >
        开始分析
      </Button>

      <Spin spinning={running} description="本地 CLI 运行中…" style={{ marginTop: 16, display: 'block' }}>
        {result && (
          <div style={{ marginTop: 16 }}>
            {result.ok ? (
              <Alert
                type="success"
                showIcon
                icon={<FileMarkdownOutlined />}
                style={{ marginBottom: 12 }}
                title={
                  <Space size={8} wrap>
                    <span>已保存：</span>
                    <a href={result.url} target="_blank" rel="noreferrer">{result.filename}</a>
                    <Typography.Text type="secondary">{result.duration.toFixed(1)}s</Typography.Text>
                  </Space>
                }
              />
            ) : (
              <Alert
                type="warning"
                style={{ marginBottom: 12 }}
                title={`未成功（exit=${result.exit_code}）`}
                description={
                  <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 12 }}>{result.stderr}</pre>
                }
              />
            )}
            {result.output ? (
              <MarkdownView content={result.output} />
            ) : (
              <Typography.Text type="secondary">（无输出）</Typography.Text>
            )}
          </div>
        )}
      </Spin>
    </Card>
  );
}

// 单条详情 Drawer（含标签编辑）
function ReportDrawer({
  detail,
  onClose,
  onChanged,
}: {
  detail: AIReportDetail | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [editingTags, setEditingTags] = useState(false);
  const [tagDraft, setTagDraft] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEditingTags(false);
    setTagDraft(detail?.tags || []);
  }, [detail]);

  const handleSaveTags = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      await updateAIReport(detail.id, { tags: tagDraft });
      message.success('标签已保存');
      setEditingTags(false);
      onChanged();
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open={!!detail}
      onClose={onClose}
      title={
        detail
          ? `${detail.target_label} · ${(detail.dimensions || []).join('、') || '综合'}`
          : ''
      }
      width={isMobile ? '100%' : 720}
    >
      {detail && (
        <>
          <Space size={8} wrap style={{ marginBottom: 12 }}>
            <ScopeTag scope={detail.scope} />
            <Tag>{detail.agent}</Tag>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {detail.created_at?.replace('T', ' ').slice(0, 19)}
            </Typography.Text>
            <a href={detail.url} target="_blank" rel="noreferrer">{detail.filename}</a>
            <a href={detail.url} download={detail.filename}>
              <Button size="small" icon={<DownloadOutlined />}>下载</Button>
            </a>
          </Space>

          <div style={{ marginBottom: 12 }}>
            <Space size={6} wrap>
              <TagsOutlined />
              {!editingTags ? (
                <>
                  {(detail.tags || []).length === 0 ? (
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>无标签</Typography.Text>
                  ) : (
                    (detail.tags || []).map((t) => <Tag key={t} color="blue">{t}</Tag>)
                  )}
                  <Button size="small" type="link" onClick={() => setEditingTags(true)}>
                    编辑标签
                  </Button>
                </>
              ) : (
                <>
                  <Select
                    mode="tags"
                    style={{ minWidth: 240 }}
                    value={tagDraft}
                    onChange={setTagDraft}
                    placeholder="回车添加，常用：待复盘 / 可加仓 / 观察"
                    options={['待复盘', '可加仓', '观察', '减仓'].map((t) => ({ value: t, label: t }))}
                  />
                  <Button size="small" type="primary" loading={saving} onClick={handleSaveTags}>
                    保存
                  </Button>
                  <Button size="small" onClick={() => { setEditingTags(false); setTagDraft(detail.tags || []); }}>
                    取消
                  </Button>
                </>
              )}
            </Space>
          </div>

          <MarkdownView content={detail.content || ''} />
        </>
      )}
    </Drawer>
  );
}

function ReportLibrary({
  starredOnly = false,
  refreshKey,
  onChange,
}: {
  starredOnly?: boolean;
  refreshKey: number;
  onChange: () => void;
}) {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [items, setItems] = useState<AIReportItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const size = 20;
  const [scopeFilter, setScopeFilter] = useState<AIAnalysisScope | undefined>(undefined);
  const [agentFilter, setAgentFilter] = useState<string | undefined>(undefined);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<AIReportDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [compareDetail, setCompareDetail] = useState<[AIReportDetail, AIReportDetail] | null>(null);
  const [rerunningId, setRerunningId] = useState<number | null>(null);

  const reload = () => {
    setLoading(true);
    listAIReports({
      scope: scopeFilter,
      agent: agentFilter,
      starred: starredOnly ? true : undefined,
      q: q.trim() || undefined,
      page,
      size,
    })
      .then((data) => {
        setItems(data.items);
        setTotal(data.total);
      })
      .catch(() => message.error('加载失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, scopeFilter, agentFilter, starredOnly, refreshKey]);

  const handleView = async (id: number) => {
    setDetailLoading(true);
    try {
      const d = await getAIReport(id);
      setDetail(d);
    } catch {
      message.error('读取失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleToggleStar = async (row: AIReportItem) => {
    try {
      await updateAIReport(row.id, { starred: !row.starred });
      reload();
      onChange();
    } catch {
      message.error('操作失败');
    }
  };

  const handleDelete = async (row: AIReportItem) => {
    try {
      await deleteAIReport(row.id);
      message.success('已删除');
      reload();
      onChange();
    } catch {
      message.error('删除失败');
    }
  };

  const handleRerun = async (row: AIReportItem) => {
    setRerunningId(row.id);
    try {
      const data = await rerunAIReport(row.id);
      if (data.ok) {
        message.success(`重跑完成（${data.duration.toFixed(1)}s）`);
        reload();
        onChange();
      } else {
        message.error(`重跑未成功（exit=${data.exit_code}）`);
      }
    } catch (e) {
      const detail2 = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      message.error(detail2 || '重跑失败');
    } finally {
      setRerunningId(null);
    }
  };

  const handleCompare = async () => {
    if (selectedIds.length !== 2) {
      message.warning('请勾选 2 条报告');
      return;
    }
    try {
      const [a, b] = await Promise.all(selectedIds.map(getAIReport));
      setCompareDetail([a, b]);
    } catch {
      message.error('加载对比失败');
    }
  };

  const columns: ColumnsType<AIReportItem> = useMemo(() => [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (v: string | null) => (v ? v.replace('T', ' ').slice(0, 19) : '—'),
    },
    {
      title: '范围',
      dataIndex: 'scope',
      key: 'scope',
      width: 90,
      render: (s: AIAnalysisScope) => <ScopeTag scope={s} />,
    },
    {
      title: '对象',
      dataIndex: 'target_label',
      key: 'target_label',
      ellipsis: true,
    },
    {
      title: '维度',
      dataIndex: 'dimensions',
      key: 'dimensions',
      render: (ds: string[]) => (
        <Space size={4} wrap>
          {(ds || []).map((d) => (<Tag key={d} style={{ marginRight: 0 }}>{d}</Tag>))}
        </Space>
      ),
    },
    { title: '工具', dataIndex: 'agent', key: 'agent', width: 90 },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      render: (ts: string[]) => (
        <Space size={4} wrap>
          {(ts || []).map((t) => <Tag key={t} color="blue" style={{ marginRight: 0 }}>{t}</Tag>)}
        </Space>
      ),
    },
    {
      title: '⭐',
      dataIndex: 'starred',
      key: 'starred',
      width: 50,
      render: (v: boolean, row) => (
        <Button
          type="text"
          size="small"
          icon={v
            ? <StarFilled style={{ color: '#faad14' }} />
            : <StarOutlined style={{ color: '#ccc' }} />}
          onClick={() => handleToggleStar(row)}
        />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      fixed: isMobile ? undefined : 'right',
      render: (_, row) => (
        <Space size={2}>
          <Button type="link" size="small" onClick={() => handleView(row.id)}>查看</Button>
          <Tooltip title="按原参数重跑">
            <Button
              type="link"
              size="small"
              icon={<RedoOutlined />}
              loading={rerunningId === row.id}
              onClick={() => handleRerun(row)}
            />
          </Tooltip>
          <Tooltip title="下载 markdown">
            <a href={row.url} download={row.filename}>
              <Button type="link" size="small" icon={<DownloadOutlined />} />
            </a>
          </Tooltip>
          <Popconfirm title="确认删除该报告？" onConfirm={() => handleDelete(row)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [isMobile, rerunningId]);

  return (
    <Card size="small" styles={{ body: { padding: isMobile ? 8 : 12 } }}>
      <Space wrap style={{ marginBottom: 12 }}>
        <Select
          placeholder="范围"
          allowClear
          style={{ width: 120 }}
          value={scopeFilter}
          onChange={(v) => { setPage(1); setScopeFilter(v); }}
          options={Object.entries(SCOPE_LABELS).map(([k, v]) => ({ value: k, label: v }))}
        />
        <Select
          placeholder="工具"
          allowClear
          style={{ width: 140 }}
          value={agentFilter}
          onChange={(v) => { setPage(1); setAgentFilter(v); }}
          options={['claude', 'codex', 'gemini', 'hermes'].map((a) => ({ value: a, label: a }))}
        />
        <Input.Search
          placeholder="搜索文件名"
          allowClear
          style={{ width: 220 }}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onSearch={() => { setPage(1); reload(); }}
        />
        <Button onClick={reload}>刷新</Button>
        <Button
          icon={<SwapOutlined />}
          disabled={selectedIds.length !== 2}
          onClick={handleCompare}
        >
          对比（已选 {selectedIds.length}/2）
        </Button>
      </Space>

      <Table
        size="small"
        rowKey="id"
        loading={loading}
        dataSource={items}
        columns={columns}
        rowSelection={{
          selectedRowKeys: selectedIds,
          onChange: (keys) => {
            const next = keys.slice(0, 2) as number[];
            if (keys.length > 2) message.info('对比最多选 2 条');
            setSelectedIds(next);
          },
        }}
        pagination={{
          current: page,
          total,
          pageSize: size,
          showSizeChanger: false,
          onChange: setPage,
        }}
        scroll={{ x: isMobile ? 1000 : undefined }}
      />

      <Spin spinning={detailLoading} fullscreen={detailLoading} />
      <ReportDrawer detail={detail} onClose={() => setDetail(null)} onChanged={reload} />

      <Modal
        open={!!compareDetail}
        onCancel={() => setCompareDetail(null)}
        footer={null}
        width="90vw"
        title="对比"
        styles={{ body: { maxHeight: '75vh', overflow: 'auto' } }}
      >
        {compareDetail && (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
            {compareDetail.map((d) => (
              <div key={d.id} style={{ borderRight: isMobile ? 'none' : '1px solid #f0f0f0', paddingRight: 12 }}>
                <Space size={6} wrap style={{ marginBottom: 8 }}>
                  <ScopeTag scope={d.scope} />
                  <Tag>{d.agent}</Tag>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {d.created_at?.replace('T', ' ').slice(0, 19)}
                  </Typography.Text>
                </Space>
                <Typography.Title level={5} style={{ marginTop: 0 }}>
                  {d.target_label}
                </Typography.Title>
                <MarkdownView content={d.content || ''} />
              </div>
            ))}
          </div>
        )}
      </Modal>
    </Card>
  );
}

export default function AIAnalysis() {
  const [tab, setTab] = useState<'new' | 'library' | 'starred'>('new');
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = () => setRefreshKey((k) => k + 1);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <Typography.Title level={4} style={{ margin: '0 0 12px' }}>
        <Space size={8}>
          <ExperimentOutlined />
          AI 分析
        </Space>
      </Typography.Title>
      <Tabs
        activeKey={tab}
        onChange={(k) => setTab(k as 'new' | 'library' | 'starred')}
        items={[
          {
            key: 'new',
            label: <Space size={6}><ThunderboltOutlined />新建分析</Space>,
            children: <NewAnalysis onSuccess={bump} />,
          },
          {
            key: 'library',
            label: <Space size={6}><HistoryOutlined />报告库</Space>,
            children: <ReportLibrary refreshKey={refreshKey} onChange={bump} />,
          },
          {
            key: 'starred',
            label: <Space size={6}><StarFilled />收藏夹</Space>,
            children: <ReportLibrary starredOnly refreshKey={refreshKey} onChange={bump} />,
          },
        ]}
      />
    </div>
  );
}
