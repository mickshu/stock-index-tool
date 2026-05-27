import { useEffect, useRef, useState } from 'react';
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
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { StockInfo } from '../types';
import {
  fetchWatchlist,
  addStock,
  deleteStock,
  searchStocks,
} from '../api/stocks';

export default function Watchlist() {
  const navigate = useNavigate();
  const [data, setData] = useState<StockInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<StockInfo[]>([]);
  const [searching, setSearching] = useState(false);

  const reload = () => {
    setLoading(true);
    fetchWatchlist()
      .then(setData)
      .catch(() => message.error('Failed to load watchlist'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
  }, []);

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
      await addStock(stock.code, stock.name, stock.market || 'A');
      message.success(`Added ${stock.code}`);
      setModalOpen(false);
      setKeyword('');
      setSearchResults([]);
      reload();
    } catch {
      message.error('Failed to add stock');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteStock(id);
      message.success('Removed');
      reload();
    } catch {
      message.error('Failed to delete');
    }
  };

  const columns = [
    { title: 'Code', dataIndex: 'code', key: 'code' },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Market', dataIndex: 'market', key: 'market' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: StockInfo) => (
        <Space>
          <Button type="link" onClick={() => navigate(`/stock/${record.code}`)}>
            Analyze
          </Button>
          <Popconfirm
            title="Remove from watchlist?"
            onConfirm={() => record.id != null && handleDelete(record.id)}
          >
            <Button type="link" danger>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Watchlist
        </Typography.Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setModalOpen(true)}
        >
          Add Stock
        </Button>
      </Space>

      <Table
        rowKey={(r) => String(r.id ?? r.code)}
        columns={columns}
        dataSource={data}
        loading={loading}
        size="middle"
        pagination={{ pageSize: 20 }}
      />

      <Modal
        title="Add Stock"
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setKeyword('');
          setSearchResults([]);
        }}
        footer={null}
        destroyOnHidden
      >
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
            searching
              ? '搜索中…'
              : keyword.trim()
              ? '未找到匹配结果'
              : null
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
          locale={{ emptyText: 'No results — try a search above' }}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button
                  type="link"
                  key="add"
                  onClick={() => handleAdd(item)}
                >
                  Add
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
    </div>
  );
}
