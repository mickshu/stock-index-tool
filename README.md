# 股票分析工具

一个个人使用的 A 股分析 Web 工具。后端使用 FastAPI 计算技术指标
（MA / MACD / KDJ / RSI）并检测交易信号（金叉/死叉、超买/超卖）。
前端使用 React + TypeScript，通过 ECharts 渲染交互式 K 线图。

## 项目结构

```
stock-index-tool/
├── backend/                FastAPI 应用
│   ├── api/                REST 接口（market、analysis、stocks、datasource）
│   ├── services/           指标注册表 + 信号引擎
│   ├── data_sources/       可插拔数据源适配器（akshare、tushare）
│   ├── models/             SQLAlchemy ORM 模型
│   ├── database.py         数据库引擎 + 会话工厂
│   ├── config.py           基于 pydantic-settings 的配置
│   └── main.py             应用入口、路由注册、CORS
├── frontend/               Vite + React + TS + Antd 6 + ECharts 6
│   └── src/
│       ├── api/            按资源划分的 Axios 客户端
│       ├── components/     AppLayout、KlineChart、SignalPanel
│       ├── pages/          Dashboard、Watchlist、StockDetail、Screener、Settings
│       └── store/          Zustand 分析状态管理
├── data/                   SQLite 数据库文件（自动创建）
└── docs/                   设计规范与实现计划
```

### 设计模式

- **适配器模式** — `data_sources/base.py` 定义抽象数据源；
  `akshare_source.py` 与 `tushare_source.py` 提供具体实现。
- **策略 / 注册表模式** — `services/indicator.py` 暴露按名称索引的
  `INDICATOR_REGISTRY`；每个指标类返回包含计算结果列的 DataFrame。
- **缓存旁路（Cache-aside）** — `kline_cache` 表存储最近的 K 线数据，
  并设置 TTL（日线 1 天、分时 5 分钟）。

## 后端

### 环境要求
- Python 3.11+
- 依赖见 `backend/requirements.txt`

### 安装
```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

### 运行
```bash
uvicorn backend.main:app --reload --port 8000
```

打开 <http://localhost:8000/docs> 查看 Swagger UI。

### 测试
```bash
python -m pytest backend/test_services.py -v
```

### 主要接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查 |
| GET | `/api/v1/market/kline?code=&period=&start=&end=` | 带缓存的 K 线数据 |
| GET | `/api/v1/market/indices` | 市场概览 |
| GET | `/api/v1/analysis/indicators?code=&period=&indicators=MACD,MA,KDJ,RSI` | K 线 + 指标 + 信号 |
| GET | `/api/v1/analysis/signals?code=&period=` | 仅返回检测到的信号 |
| GET | `/api/v1/analysis/available-indicators` | 已注册的指标名称 |
| GET / POST | `/api/v1/stocks` | 自选股列表 / 添加 |
| DELETE | `/api/v1/stocks/{id}` | 从自选股移除 |
| GET | `/api/v1/stocks/search?q=` | 关键字搜索 |
| GET | `/api/v1/data-sources` | 当前激活及可用数据源 |
| POST | `/api/v1/data-sources/switch?source=` | 切换激活数据源 |

## 前端

### 安装
```bash
cd frontend
npm install
```

### 运行
```bash
npm run dev
```

打开 <http://localhost:5173>。Vite 会将 `/api/*` 代理到
`http://localhost:8000`（见 `frontend/vite.config.ts`）。

### 类型检查
```bash
npx tsc --noEmit
```

### 页面

- **Dashboard** — 使用 Statistic 卡片展示指数行情概览
- **Watchlist** — 自选股表格；搜索 + 添加弹窗；分析 / 删除操作
- **StockDetail** — K 线 + MA / MACD / KDJ / RSI 子图（可切换）以及信号侧边栏
- **Screener** — 后续筛选扫描功能的占位页
- **Settings** — 数据源切换

## 数据流

```
akshare/tushare  →  data_sources.*  →  kline_cache (SQLite)
                                            ↓
                              services.indicator  →  services.signal
                                            ↓
                              /api/v1/analysis/indicators
                                            ↓
                           React (analysisStore → KlineChart + SignalPanel)
```

## 备注

- 指标计算使用 `ta` 库。`ta.momentum.stoch` 返回 K 序列；
  `stoch_signal` 返回 D。J 由 `3K - 2D` 计算得出。
- 指标与信号在完整历史 DataFrame 上做内存计算；个人工具足够使用，
  但若用于多租户或大规模股票池场景，需要迁移到列式存储。
- 选用 SQLite 是为了零配置的本地持久化。如需更换，请修改 `.env`
  或 `backend/config.py` 中的 `DATABASE_URL`。

## 许可证

见 `LICENSE`。
