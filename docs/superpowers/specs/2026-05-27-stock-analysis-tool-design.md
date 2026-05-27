# Stock Analysis Tool Design Spec

**Date:** 2026-05-27
**Status:** Approved

## Overview

A personal-use stock analysis web tool for A-share market (extensible to HK/US). Uses MACD, MA, KDJ, RSI indicators to identify buy/sell signals such as golden cross, death cross, overbought/oversold, and divergence. Self-managed watchlist with per-stock detail analysis charts.

## Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Backend framework | FastAPI | Async, auto-generated docs, type hints |
| Data analysis | pandas + ta (Technical Analysis Library) | 100+ built-in indicators, no manual formula coding |
| Data sources | akshare / tushare adapter pattern | Unified interface, runtime switchable |
| ORM / DB | SQLAlchemy + SQLite | Zero-dependency deployment, PostgreSQL-compatible |
| Task scheduling | APScheduler | Scheduled data refresh, batch analysis |
| Frontend framework | React 18 + TypeScript | SPA in project subdirectory |
| Build tool | Vite | Fast HMR, zero-config |
| Charts | ECharts (echarts-for-react) | K-line, indicators overlay, volume |
| UI library | Ant Design 5 | Tables, forms, layout, Chinese-friendly |
| State management | Zustand | Lightweight, sufficient for SPA scope |

## Architecture

```
stocktool/
├── backend/
│   ├── api/               # FastAPI routers
│   │   ├── stocks.py      # Watchlist CRUD + search
│   │   ├── market.py      # K-line data endpoints
│   │   ├── analysis.py    # Indicator computation + signal detection
│   │   └── datasource.py  # Data source switch
│   ├── services/           # Business logic
│   │   ├── indicator.py   # Strategy-pattern indicator registry
│   │   ├── signal.py      # Signal detection engine
│   │   └── screener.py    # Market scanner (placeholder)
│   ├── data_sources/       # Data source abstraction
│   │   ├── base.py        # Abstract interface
│   │   ├── akshare.py     # Akshare adapter
│   │   └── tushare.py     # Tushare adapter
│   ├── models/             # SQLAlchemy models
│   │   └── models.py
│   ├── scheduler.py        # APScheduler jobs
│   ├── config.py           # App configuration
│   ├── database.py         # DB engine / session
│   └── main.py             # FastAPI app entry
├── frontend/
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/          # Route pages
│   │   ├── hooks/          # Custom hooks
│   │   ├── api/            # Backend API client
│   │   ├── store/          # Zustand stores
│   │   └── types/          # TypeScript types
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── data/                   # SQLite database file location
├── requirements.txt
└── README.md
```

### Layered Design

Each layer communicates through well-defined interfaces, enabling independent testing and replacement:

```
API (FastAPI routers)
  → Service layer (indicator computation, signal detection)
    → Data source layer (akshare / tushare adapters)
      → External data providers
```

## Backend API Design

### Endpoints

```
# Watchlist
GET    /api/v1/stocks                    # List watchlist stocks
POST   /api/v1/stocks                    # Add stock (code, name, market)
DELETE /api/v1/stocks/{id}               # Remove from watchlist

# Stock search
GET    /api/v1/stocks/search?q=平安       # Search stocks via data source

# Market data
GET    /api/v1/market/kline?code=000001&period=daily&start=...&end=...
                                          # K-line data (auto-cached)

# Analysis
GET    /api/v1/analysis/indicators?code=000001&period=daily&indicators=MACD,MA,KDJ,RSI
                                          # Compute indicators, return with K-line data
GET    /api/v1/analysis/signals?code=000001&period=daily
                                          # Detect all signals for the stock

# Screener (later phase)
GET    /api/v1/screener?indicators=MACD&signal=golden_cross&period=daily
                                          # Market-wide scan (placeholder)

# Data source management
GET    /api/v1/data-sources               # List available sources
POST   /api/v1/data-sources/switch?source=akshare  # Switch active source
```

### Indicator Architecture (Strategy Pattern)

```python
class BaseIndicator:
    name: str
    required_columns: list[str]

    def compute(self, df: pd.DataFrame) -> pd.DataFrame:
        """Append indicator columns to OHLCV DataFrame."""
        ...

# Registry — adding a new indicator = one new file + one line registration
INDICATOR_REGISTRY: dict[str, BaseIndicator] = {}
```

### Signal Types (Initial Set)

| Signal | Indicator | Condition |
|---|---|---|
| Golden Cross (金叉) | MACD | DIF crosses above DEA |
| Death Cross (死叉) | MACD | DIF crosses below DEA |
| Golden Cross (金叉) | MA | MA5 crosses above MA10 / MA20 |
| Death Cross (死叉) | MA | MA5 crosses below MA10 / MA20 |
| Golden Cross (金叉) | KDJ | K crosses above D |
| Death Cross (死叉) | KDJ | K crosses below D |
| Oversold (超卖) | KDJ | J < 0 |
| Overbought (超买) | KDJ | J > 100 |
| Oversold (超卖) | RSI | RSI < 30 |
| Overbought (超买) | RSI | RSI > 70 |

## Frontend Pages

```
/                   # Dashboard: index cards (SH/SZ/CYB indices)
/stocks             # Watchlist management: table + add/delete
/stock/:code        # Stock detail: core analysis page
/screener           # Signal screener (placeholder)
/settings           # App settings: data source switch
```

### Stock Detail Page Layout (Core)

```
┌──────────────────────────────────────────────┐
│  Stock Name (000001)  |  Last Price  ▲+2.3% │
├───────────┬──────────┬───────────────────────┤
│ Period    │ Indicators│                       │
│ Daily Wkly│ MACD MA  │   K-line Chart        │
│ Monthly   │ KDJ RSI  │   + Indicators        │
│ 60m 30m   │          │   (ECharts)           │
├───────────┴──────────┤                       │
│   Signal Panel        │                       │
│   🔴 MACD Golden Cross│                       │
│   🟢 KDJ Oversold     │                       │
│   🟡 MA5 ↑ MA10       │                       │
└───────────────────────┴───────────────────────┘
```

- Period/indicator toggles update chart in real time
- Signal panel items clickable to navigate K-line to that position

## Database Schema

```sql
CREATE TABLE watchlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code VARCHAR(10) NOT NULL,
    name VARCHAR(50),
    market VARCHAR(10) DEFAULT 'A',
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(code, market)
);

CREATE TABLE kline_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code VARCHAR(10) NOT NULL,
    period VARCHAR(10) NOT NULL,
    trade_date DATE NOT NULL,
    open REAL, high REAL, low REAL, close REAL, volume REAL,
    fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(code, period, trade_date)
);

CREATE TABLE signal_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code VARCHAR(10) NOT NULL,
    period VARCHAR(10) NOT NULL,
    signal_type VARCHAR(30) NOT NULL,
    indicator VARCHAR(30),
    description TEXT,
    signal_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Data Flow

```
User selects stock + period + indicators
  → Frontend calls GET /api/v1/analysis/indicators
    → Backend checks kline_cache for data freshness
      → Cache miss: fetch from data source (akshare/tushare), write cache
      → Cache hit: load from SQLite
    → Compute indicators via INDICATOR_REGISTRY
    → Detect signals via SignalEngine
    → Return { kline: [...], indicators: {...}, signals: [...] }
  → ECharts renders K-line with indicator overlays
  → Signal panel displays detected signals
```

## Cache Freshness

- Daily/weekly/monthly K-line: cache valid for 1 day (data only changes after market close)
- Intraday K-line (60m/30m/15m): cache valid for 5 minutes during trading hours
- Trading hours detection: 9:30-15:00 China Standard Time, Mon-Fri
- Stale cache: return data with `stale: true` flag; frontend shows banner warning

## Error Handling

- Data source failures: return cached data with staleness warning if available; show error message if no cache
- Invalid stock code: return 404 with descriptive message
- Missing indicator parameter: return 400 with valid options list
- Rate limiting on data source API: catch and surface with retry-after hint

## Testing Strategy

- Backend: pytest for services (indicator computation, signal detection) using mock OHLCV data
- Data sources: integration tests with live API calls (marked as slow, run manually)
- Frontend: Vitest for hooks/utils, manual browser testing for charts

## Implementation Phases

| Phase | Scope | Milestone |
|---|---|---|
| Phase 1 | Project scaffold, backend core (data source + K-line + indicator engine), frontend shell | K-line chart renders |
| Phase 2 | Signal detection engine, all 4 indicators (MACD/MA/KDJ/RSI), stock detail page complete | Full analysis page works |
| Phase 3 | Watchlist management, dashboard page | Core workflow complete |
| Phase 4 | Screener, settings page, polish | Feature complete |
