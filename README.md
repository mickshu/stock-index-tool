# Stock Analysis Tool

A personal-use A-share stock analysis web tool. FastAPI backend computes
technical indicators (MA / MACD / KDJ / RSI) and detects trading signals
(golden/death crosses, overbought/oversold). React + TypeScript frontend
renders interactive K-line charts with ECharts.

## Architecture

```
stock-index-tool/
├── backend/                FastAPI app
│   ├── api/                REST endpoints (market, analysis, stocks, datasource)
│   ├── services/           Indicator registry + signal engine
│   ├── data_sources/       Pluggable adapters (akshare, tushare)
│   ├── models/             SQLAlchemy ORM models
│   ├── database.py         Engine + session factory
│   ├── config.py           pydantic-settings configuration
│   └── main.py             App entry, router registration, CORS
├── frontend/               Vite + React + TS + Antd 6 + ECharts 6
│   └── src/
│       ├── api/            Axios clients per resource
│       ├── components/     AppLayout, KlineChart, SignalPanel
│       ├── pages/          Dashboard, Watchlist, StockDetail, Screener, Settings
│       └── store/          Zustand analysis store
├── data/                   SQLite database file (auto-created)
└── docs/                   Design specs and implementation plans
```

### Patterns

- **Adapter pattern** — `data_sources/base.py` defines the abstract source;
  `akshare_source.py` and `tushare_source.py` provide concrete impls.
- **Strategy / registry pattern** — `services/indicator.py` exposes
  `INDICATOR_REGISTRY` keyed by name; each indicator class returns a DataFrame
  of computed columns.
- **Cache-aside** — `kline_cache` table stores recent K-line frames with TTL
  (1 day for daily, 5 min for intraday).

## Backend

### Requirements
- Python 3.11+
- See `backend/requirements.txt`

### Setup
```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

### Run
```bash
uvicorn backend.main:app --reload --port 8000
```

Open <http://localhost:8000/docs> for Swagger UI.

### Tests
```bash
python -m pytest backend/test_services.py -v
```

### Key endpoints

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/health` | Liveness probe |
| GET | `/api/v1/market/kline?code=&period=&start=&end=` | Cached K-line |
| GET | `/api/v1/market/indices` | Market overview |
| GET | `/api/v1/analysis/indicators?code=&period=&indicators=MACD,MA,KDJ,RSI` | K-line + indicators + signals |
| GET | `/api/v1/analysis/signals?code=&period=` | Detected signals only |
| GET | `/api/v1/analysis/available-indicators` | Registered indicator names |
| GET / POST | `/api/v1/stocks` | Watchlist list / add |
| DELETE | `/api/v1/stocks/{id}` | Remove from watchlist |
| GET | `/api/v1/stocks/search?q=` | Keyword search |
| GET | `/api/v1/data-sources` | Active + available data sources |
| POST | `/api/v1/data-sources/switch?source=` | Switch active source |

## Frontend

### Setup
```bash
cd frontend
npm install
```

### Run
```bash
npm run dev
```

Open <http://localhost:5173>. Vite proxies `/api/*` to
`http://localhost:8000` (see `frontend/vite.config.ts`).

### Type check
```bash
npx tsc --noEmit
```

### Pages

- **Dashboard** — index cards (Statistic) for market overview
- **Watchlist** — table of watched stocks; search + add modal; analyze / delete actions
- **StockDetail** — K-line + MA / MACD / KDJ / RSI subpanels (toggleable) and signal sidebar
- **Screener** — placeholder for future filtered scans
- **Settings** — data source switcher

## Data flow

```
akshare/tushare  →  data_sources.*  →  kline_cache (SQLite)
                                            ↓
                              services.indicator  →  services.signal
                                            ↓
                              /api/v1/analysis/indicators
                                            ↓
                           React (analysisStore → KlineChart + SignalPanel)
```

## Notes

- The `ta` library is used for indicator math. `ta.momentum.stoch` returns
  the K series; `stoch_signal` returns D. J is derived as `3K - 2D`.
- Indicator and signal computations operate on full-history DataFrames in
  memory; this is acceptable for a personal tool but would need to move to
  a column store for multi-tenant or large-universe use.
- SQLite was chosen for zero-config local persistence. Replace by editing
  `DATABASE_URL` in `.env` or `backend/config.py`.

## License

See `LICENSE`.
