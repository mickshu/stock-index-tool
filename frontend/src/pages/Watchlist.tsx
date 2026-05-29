import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Table,
  Button,
  Modal,
  AutoComplete,
  Space,
  Popconfirm,
  Typography,
  message,
  List,
  Tag,
  Grid,
  Menu,
  Select,
  Input,
  Row,
  Col,
  Card,
  Empty,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { StockInfo, WatchlistGroup } from '../types';

const { useBreakpoint } = Grid;
import {
  fetchWatchlist,
  addStock,
  deleteStock,
  searchStocks,
  fetchGroups,
  createGroup,
  renameGroup,
  deleteGroup,
  setStockGroup,
} from '../api/stocks';
import { fetchQuote, type QuoteData } from '../api/market';

const ALL_KEY = '__all__';
const UNGROUPED_KEY = '__ungrouped__';

type GroupFilter = typeof ALL_KEY | typeof UNGROUPED_KEY | number;

export default function Watchlist() {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [data, setData] = useState<StockInfo[]>([]);
  const [quotes, setQuotes] = useState<Record<string, QuoteData>>({});
  const [groups, setGroups] = useState<WatchlistGroup[]>([]);
  const [ungroupedCount, setUngroupedCount] = useState(0);
  const [filter, setFilter] = useState<GroupFilter>(ALL_KEY);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<StockInfo[]>([]);
  const [searching, setSearching] = useState(false);
  const [addTargetGroup, setAddTargetGroup] = useState<number | null>(null);

  const [newGroupName, setNewGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const reloadGroups = async () => {
    try {
      const { groups: gs, ungrouped_count } = await fetchGroups();
      setGroups(gs);
      setUngroupedCount(ungrouped_count);
    } catch {
      message.error('加载分组失败');
    }
  };

  const quoteSeqRef = useRef(0);

  const reloadStocks = async (current: GroupFilter = filter) => {
    setLoading(true);
    try {
      const opts =
        current === ALL_KEY
          ? {}
          : current === UNGROUPED_KEY
          ? { ungrouped: true }
          : { groupId: current as number };
      const rows = await fetchWatchlist(opts);
      setData(rows);
      const seq = ++quoteSeqRef.current;
      setQuotes({});
      Promise.all(
        rows.map((r) =>
          fetchQuote(r.code)
            .then((q) => [r.code, q] as const)
            .catch(() => null),
        ),
      ).then((results) => {
        if (seq !== quoteSeqRef.current) return;
        const next: Record<string, QuoteData> = {};
        for (const item of results) {
          if (item) next[item[0]] = item[1];
        }
        setQuotes(next);
      });
    } catch {
      message.error('加载自选股失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reloadGroups();
  }, []);

  useEffect(() => {
    reloadStocks(filter);
  }, [filter]);

  const debounceRef = useRef<number | null>(null);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    return () => {
      if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
    };
  }, []);

  const runSearch = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    const seq = ++requestSeqRef.current;
    setSearching(true);
    searchStocks(trimmed)
      .then(({ results }) => {
        if (seq === requestSeqRef.current) setSearchResults(results);
      })
      .catch(() => {
        if (seq === requestSeqRef.current) message.error('搜索失败');
      })
      .finally(() => {
        if (seq === requestSeqRef.current) setSearching(false);
      });
  };

  const handleKeywordChange = (value: string) => {
    setKeyword(value);
    if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    debounceRef.current = window.setTimeout(() => runSearch(value), 250);
  };

  const handleAdd = async (stock: StockInfo) => {
    try {
      await addStock(stock.code, stock.name, stock.market || 'A', addTargetGroup);
      message.success(`已添加 ${stock.name}`);
      setModalOpen(false);
      setKeyword('');
      setSearchResults([]);
      reloadGroups();
      reloadStocks();
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      message.error(detail || '添加失败');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteStock(id);
      message.success('已移除');
      reloadGroups();
      reloadStocks();
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      message.error(detail || '删除失败');
    }
  };

  const handleCreateGroup = async () => {
    const name = newGroupName.trim();
    if (!name) return;
    setCreatingGroup(true);
    try {
      const g = await createGroup(name);
      setNewGroupName('');
      await reloadGroups();
      setFilter(g.id);
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      message.error(detail || '创建分组失败');
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleRenameGroup = async (id: number) => {
    const name = renameValue.trim();
    if (!name) {
      setRenamingId(null);
      return;
    }
    try {
      await renameGroup(id, name);
      setRenamingId(null);
      setRenameValue('');
      reloadGroups();
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      message.error(detail || '重命名失败');
    }
  };

  const handleDeleteGroup = async (id: number) => {
    try {
      await deleteGroup(id);
      if (filter === id) setFilter(ALL_KEY);
      reloadGroups();
      reloadStocks();
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      message.error(detail || '删除分组失败');
    }
  };

  const handleMoveStock = async (stockId: number, groupId: number | null) => {
    try {
      await setStockGroup(stockId, groupId);
      reloadGroups();
      reloadStocks();
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      message.error(detail || '调整分组失败');
    }
  };

  const groupNameById = useMemo(() => {
    const map = new Map<number, string>();
    groups.forEach((g) => map.set(g.id, g.name));
    return map;
  }, [groups]);

  const totalCount = ungroupedCount + groups.reduce((sum, g) => sum + (g.count ?? 0), 0);

  const filterLabel =
    filter === ALL_KEY
      ? '全部'
      : filter === UNGROUPED_KEY
      ? '未分组'
      : groupNameById.get(filter as number) || '分组';

  const groupMenuItems = [
    { key: ALL_KEY, label: <Space>全部 <Tag>{totalCount}</Tag></Space> },
    { key: UNGROUPED_KEY, label: <Space>未分组 <Tag>{ungroupedCount}</Tag></Space> },
    ...(groups.length ? [{ type: 'divider' as const }] : []),
    ...groups.map((g) => ({
      key: String(g.id),
      label: (
        <Row justify="space-between" align="middle" wrap={false}>
          <Col flex="auto" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {renamingId === g.id ? (
              <Input
                size="small"
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onPressEnter={() => handleRenameGroup(g.id)}
                onBlur={() => handleRenameGroup(g.id)}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span>{g.name}</span>
            )}
          </Col>
          <Col>
            <Space size={0}>
              <Tag style={{ marginRight: 4 }}>{g.count ?? 0}</Tag>
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  setRenamingId(g.id);
                  setRenameValue(g.name);
                }}
              />
              <Popconfirm
                title={`删除分组「${g.name}」？组内股票将变为未分组`}
                onConfirm={(e) => {
                  e?.stopPropagation();
                  handleDeleteGroup(g.id);
                }}
                onCancel={(e) => e?.stopPropagation()}
              >
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={(e) => e.stopPropagation()}
                />
              </Popconfirm>
            </Space>
          </Col>
        </Row>
      ),
    })),
  ];

  // Mobile card list
  const renderMobileList = () => {
    if (data.length === 0 && !loading) {
      return <Empty description="该分组暂无股票" />;
    }
    return (
      <List
        loading={loading}
        dataSource={data}
        renderItem={(record) => {
          const q = quotes[record.code];
          const changeColor = q?.change_pct != null
            ? q.change_pct > 0 ? '#cf1322' : q.change_pct < 0 ? '#3f8600' : undefined
            : undefined;
          return (
            <div
              style={{
                background: '#fff',
                borderRadius: 8,
                padding: '10px 12px',
                marginBottom: 8,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Typography.Text strong style={{ fontSize: 15 }}>{record.name}</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12, marginLeft: 6 }}>{record.code}</Typography.Text>
                </div>
                <Space size={4}>
                  <Button type="link" size="small" onClick={() => navigate(`/stock/${record.code}`)}>
                    分析
                  </Button>
                  <Popconfirm
                    title="从自选股移除？"
                    onConfirm={() => record.id != null && handleDelete(record.id)}
                  >
                    <Button type="link" size="small" danger>删</Button>
                  </Popconfirm>
                </Space>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4 }}>
                <Typography.Text strong style={{ fontSize: 18, color: changeColor }}>
                  {q && q.price > 0 ? q.price.toFixed(2) : '—'}
                </Typography.Text>
                {q?.change_pct != null && (
                  <Typography.Text strong style={{ color: changeColor, fontSize: 14 }}>
                    {q.change_pct > 0 ? '+' : ''}{q.change_pct.toFixed(2)}%
                  </Typography.Text>
                )}
              </div>
              {groups.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <Select
                    size="small"
                    style={{ width: 120 }}
                    value={record.group_id ?? null}
                    onChange={(val) => record.id != null && handleMoveStock(record.id, val)}
                    options={[
                      { value: null as number | null, label: '未分组' },
                      ...groups.map((g) => ({ value: g.id, label: g.name })),
                    ]}
                  />
                </div>
              )}
            </div>
          );
        }}
      />
    );
  };

  // Desktop table
  const desktopColumns = [
    { title: '代码', dataIndex: 'code', key: 'code', width: 90 },
    { title: '名称', dataIndex: 'name', key: 'name' },
    {
      title: '最新价',
      key: 'price',
      width: 90,
      align: 'right' as const,
      render: (_: unknown, record: StockInfo) => {
        const q = quotes[record.code];
        if (!q || !(q.price > 0)) return <Typography.Text type="secondary">—</Typography.Text>;
        return <Typography.Text strong>{q.price.toFixed(2)}</Typography.Text>;
      },
    },
    {
      title: '涨跌幅',
      key: 'change_pct',
      width: 90,
      align: 'right' as const,
      render: (_: unknown, record: StockInfo) => {
        const q = quotes[record.code];
        if (!q || q.change_pct == null) return <Typography.Text type="secondary">—</Typography.Text>;
        const v = q.change_pct;
        const color = v > 0 ? '#cf1322' : v < 0 ? '#3f8600' : undefined;
        const sign = v > 0 ? '+' : '';
        return <Typography.Text strong style={{ color }}>{`${sign}${v.toFixed(2)}%`}</Typography.Text>;
      },
    },
    {
      title: '分组',
      key: 'group',
      width: 160,
      render: (_: unknown, record: StockInfo) => (
        <Select
          size="small"
          style={{ width: 140 }}
          value={record.group_id ?? null}
          onChange={(val) => record.id != null && handleMoveStock(record.id, val)}
          options={[
            { value: null as number | null, label: '未分组' },
            ...groups.map((g) => ({ value: g.id, label: g.name })),
          ]}
        />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: StockInfo) => (
        <Space>
          <Button type="link" size="small" onClick={() => navigate(`/stock/${record.code}`)}>
            分析
          </Button>
          <Popconfirm
            title="从自选股移除？"
            onConfirm={() => record.id != null && handleDelete(record.id)}
          >
            <Button type="link" size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Row gutter={isMobile ? 0 : 16}>
      <Col xs={24} md={6} lg={5}>
        <Card
          size="small"
          title={<Space><AppstoreOutlined />分组</Space>}
          styles={{ body: { padding: 0 } }}
          style={{ marginBottom: isMobile ? 12 : 0 }}
        >
          <Menu
            mode="inline"
            selectedKeys={[String(filter)]}
            onClick={({ key }) => {
              if (key === ALL_KEY || key === UNGROUPED_KEY) setFilter(key as GroupFilter);
              else setFilter(Number(key));
            }}
            items={groupMenuItems}
          />
          <div style={{ padding: 8, borderTop: '1px solid #f0f0f0' }}>
            <Space.Compact style={{ width: '100%' }}>
              <Input
                size="small"
                placeholder="新建分组"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onPressEnter={handleCreateGroup}
                maxLength={50}
              />
              <Button
                size="small"
                type="primary"
                loading={creatingGroup}
                onClick={handleCreateGroup}
                disabled={!newGroupName.trim()}
              >
                添加
              </Button>
            </Space.Compact>
          </div>
        </Card>
      </Col>

      <Col xs={24} md={18} lg={19}>
        <Space style={{ marginBottom: isMobile ? 12 : 16 }} wrap>
          <Typography.Title level={4} style={{ margin: 0 }}>
            自选股 · {filterLabel}
          </Typography.Title>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setAddTargetGroup(typeof filter === 'number' ? (filter as number) : null);
              setModalOpen(true);
            }}
            block={isMobile}
          >
            添加股票
          </Button>
        </Space>

        {isMobile ? (
          renderMobileList()
        ) : (
          data.length === 0 && !loading ? (
            <Empty description="该分组暂无股票" />
          ) : (
            <Table
              rowKey={(r) => String(r.id ?? r.code)}
              columns={desktopColumns}
              dataSource={data}
              loading={loading}
              size="middle"
              pagination={{ pageSize: 20 }}
              scroll={{ x: 520 }}
            />
          )
        )}

        <Modal
          title="添加股票"
          open={modalOpen}
          onCancel={() => {
            setModalOpen(false);
            setKeyword('');
            setSearchResults([]);
          }}
          footer={null}
          destroyOnHidden
        >
          <div style={{ marginBottom: 12 }}>
            <Typography.Text type="secondary">加入分组：</Typography.Text>
            <Select
              style={{ width: 200, marginLeft: 8 }}
              value={addTargetGroup}
              onChange={(val) => setAddTargetGroup(val)}
              options={[
                { value: null as number | null, label: '未分组' },
                ...groups.map((g) => ({ value: g.id, label: g.name })),
              ]}
            />
          </div>

          <AutoComplete
            style={{ width: '100%', marginBottom: 12 }}
            value={keyword}
            onChange={handleKeywordChange}
            onSelect={(value) => {
              const stock = searchResults.find((s) => s.code === value);
              if (stock) handleAdd(stock);
            }}
            placeholder="输入代码或名称，如 000001 或 平安"
            notFoundContent={
              searching ? '搜索中…' : keyword.trim() ? '未找到匹配结果' : null
            }
            options={searchResults.map((s) => ({
              value: s.code,
              label: (
                <Space>
                  <Tag>{s.code}</Tag>
                  <span>{s.name}</span>
                  {s.market && (
                    <Typography.Text type="secondary">[{s.market}]</Typography.Text>
                  )}
                </Space>
              ),
            }))}
            allowClear
          />

          <List
            size="small"
            bordered
            dataSource={searchResults}
            locale={{ emptyText: '在上方搜索股票' }}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Button type="link" key="add" onClick={() => handleAdd(item)}>
                    加入
                  </Button>,
                ]}
              >
                <Space>
                  <Tag>{item.code}</Tag>
                  <span>{item.name}</span>
                  {item.market && (
                    <Typography.Text type="secondary">[{item.market}]</Typography.Text>
                  )}
                </Space>
              </List.Item>
            )}
          />
        </Modal>
      </Col>
    </Row>
  );
}
