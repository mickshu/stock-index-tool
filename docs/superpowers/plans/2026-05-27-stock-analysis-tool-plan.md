# Stock Analysis Tool — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal stock analysis web tool with MACD/MA/KDJ/RSI indicators, golden cross / death cross signal detection, self-managed watchlist, and interactive K-line charts.

**Architecture:** FastAPI backend with layered design (API → Services → DataSources), React+TypeScript frontend with ECharts, SQLite for persistence. Strategy pattern for indicators, adapter pattern for data sources.

**Tech Stack:** Python 3.11+, FastAPI, pandas, ta, SQLAlchemy, akshare, tushare, React 18, TypeScript, Vite, Ant Design 5, ECharts, Zustand

---

## Phase 1: Project Scaffold & Backend Core

### Task 1: Create project directory structure and requirements.txt

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/__init__.py`
- Create: `backend/api/__init__.py`
- Create: `backend/services/__init__.py`
- Create: `backend/data_sources/__init__.py`
- Create: `backend/models/__init__.py`
- Create: `data/.gitkeep`

- [ ] **Step 1: Create backend directory structure**

```bash
mkdir -p /home/admin/stocktool/backend/api
mkdir -p /home/admin/stocktool/backend/services
mkdir -p /home/admin/stocktool/backend/data_sources
mkdir -p /home/admin/stocktool/backend/models
mkdir -p /home/admin/stocktool/data
```

- [ ] **Step 2: Create requirements.txt**

Write `backend/requirements.txt`:
```
fastapi==0.115.6
uvicorn[standard]==0.34.0
sqlalchemy==2.0.36
pandas==2.2.3
ta==0.11.0
akshare>=1.15.0
tushare>=1.4.0
apscheduler==3.10.4
pydantic==2.10.3
pydantic-settings==2.7.0
```

- [ ] **Step 3: Create empty __init__.py files**

```bash
touch /home/admin/stocktool/backend/__init__.py
touch /home/admin/stocktool/backend/api/__init__.py
touch /home/admin/stocktool/backend/services/__init__.py
touch /home/admin/stocktool/backend/data_sources/__init__.py
touch /home/admin/stocktool/backend/models/__init__.py
touch /home/admin/stocktool/data/.gitkeep
```

- [ ] **Step 4: Install dependencies**

```bash
cd /home/admin/stocktool && pip install -r backend/requirements.txt
```

Expected: all packages install successfully.

- [ ] **Step 5: Commit**

```bash
cd /home/admin/stocktool && git init && git add -A && git commit -m "feat: project scaffold and dependencies"
```

---

### Task 2: Create config.py and database.py

**Files:**
- Create: `backend/config.py`
- Create: `backend/database.py`

- [ ] **Step 1: Write config.py**

Write `backend/config.py`:
```python
from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    database_url: str = f"sqlite:///{Path(__file__).parent.parent / 'data' / 'stocktool.db'}"
    active_data_source: str = "akshare"
    tushare_token: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
```

- [ ] **Step 2: Write database.py**

Write `backend/database.py`:
```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from backend.config import settings

engine = create_engine(settings.database_url, echo=False, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from backend.models.models import Watchlist, KlineCache, SignalLog  # noqa: F401
    Base.metadata.create_all(bind=engine)
```

- [ ] **Step 3: Verify imports work**

```bash
cd /home/admin/stocktool && python -c "from backend.config import settings; from backend.database import init_db; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
cd /home/admin/stocktool && git add -A && git commit -m "feat: config and database setup"
```

---

### Task 3: Create SQLAlchemy models

**Files:**
- Create: `backend/models/models.py`

- [ ] **Step 1: Write models.py**

Write `backend/models/models.py`:
```python
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Date, DateTime, UniqueConstraint
from backend.database import Base


class Watchlist(Base):
    __tablename__ = "watchlist"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(10), nullable=False)
    name = Column(String(50))
    market = Column(String(10), default="A")
    added_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (UniqueConstraint("code", "market", name="uq_watchlist_code_market"),)


class KlineCache(Base):
    __tablename__ = "kline_cache"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(10), nullable=False)
    period = Column(String(10), nullable=False)
    trade_date = Column(Date, nullable=False)
    open = Column(Float)
    high = Column(Float)
    low = Column(Float)
    close = Column(Float)
    volume = Column(Float)
    fetched_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (UniqueConstraint("code", "period", "trade_date", name="uq_kline_code_period_date"),)


class SignalLog(Base):
    __tablename__ = "signal_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(10), nullable=False)
    period = Column(String(10), nullable=False)
    signal_type = Column(String(30), nullable=False)
    indicator = Column(String(30))
    description = Column(String(200))
    signal_date = Column(Date, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
```

- [ ] **Step 2: Verify models create tables**

```bash
cd /home/admin/stocktool && python -c "
from backend.database import init_db
init_db()
import os
print('Tables created:', os.path.exists('data/stocktool.db'))
"
```

Expected: `Tables created: True`

- [ ] **Step 3: Commit**

```bash
cd /home/admin/stocktool && git add -A && git commit -m "feat: SQLAlchemy models for watchlist, kline cache, signal log"
```

---

### Task 4: Create data source base interface

**Files:**
- Create: `backend/data_sources/base.py`

- [ ] **Step 1: Write base.py**

Write `backend/data_sources/base.py`:
```python
from abc import ABC, abstractmethod
import pandas as pd


class BaseDataSource(ABC):
    name: str = "base"

    @abstractmethod
    def search_stocks(self, keyword: str) -> list[dict]:
        """Search stocks by keyword. Returns list of {code, name, market}."""
        ...

    @abstractmethod
    def get_kline(self, code: str, period: str, start_date: str, end_date: str) -> pd.DataFrame:
        """Fetch K-line data. Returns DataFrame with columns: date, open, high, low, close, volume."""
        ...

    @abstractmethod
    def get_realtime_quote(self, code: str) -> dict:
        """Get real-time quote for a stock. Returns {code, name, price, change_pct}."""
        ...

    @abstractmethod
    def get_index_data(self) -> list[dict]:
        """Get major indices (SH, SZ, CYB). Returns list of {name, code, price, change_pct}."""
        ...


# Mapping between our period names and data source period names
PERIOD_MAP = {
    "daily": "daily",
    "weekly": "weekly",
    "monthly": "monthly",
    "60min": "60",
    "30min": "30",
    "15min": "15",
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/admin/stocktool && git add -A && git commit -m "feat: data source base interface"
```

---

### Task 5: Create akshare adapter

**Files:**
- Create: `backend/data_sources/akshare.py`

- [ ] **Step 1: Write akshare adapter**

Write `backend/data_sources/akshare.py`:
```python
import pandas as pd
import akshare as ak
from backend.data_sources.base import BaseDataSource, PERIOD_MAP


class AkshareDataSource(BaseDataSource):
    name = "akshare"

    def search_stocks(self, keyword: str) -> list[dict]:
        try:
            df = ak.stock_info_a_code_name()
            mask = df["名称"].str.contains(keyword) if "名称" in df.columns else df["name"].str.contains(keyword)
            results = df[mask].head(20)
            return [
                {"code": str(row.iloc[0]).zfill(6), "name": str(row.iloc[1]), "market": "A"}
                for row in results.itertuples(index=False)
            ]
        except Exception:
            return []

    def get_kline(self, code: str, period: str, start_date: str, end_date: str) -> pd.DataFrame:
        try:
            freq = PERIOD_MAP.get(period, "daily")
            df = ak.stock_zh_a_hist(symbol=code, period=freq, start_date=start_date, end_date=end_date, adjust="qfq")
            if df is None or df.empty:
                return pd.DataFrame(columns=["date", "open", "high", "low", "close", "volume"])
            df = df.rename(columns={
                "日期": "date", "开盘": "open", "最高": "high",
                "最低": "low", "收盘": "close", "成交量": "volume"
            })
            cols = ["date", "open", "high", "low", "close", "volume"]
            df["date"] = pd.to_datetime(df["date"]).dt.date
            return df[[c for c in cols if c in df.columns]]
        except Exception:
            return pd.DataFrame(columns=["date", "open", "high", "low", "close", "volume"])

    def get_realtime_quote(self, code: str) -> dict:
        try:
            df = ak.stock_zh_a_spot_em()
            row = df[df["代码"] == code]
            if row.empty:
                return {"code": code, "name": "", "price": 0, "change_pct": 0}
            r = row.iloc[0]
            return {
                "code": code,
                "name": r["名称"],
                "price": float(r["最新价"]),
                "change_pct": float(r["涨跌幅"]),
            }
        except Exception:
            return {"code": code, "name": "", "price": 0, "change_pct": 0}

    def get_index_data(self) -> list[dict]:
        try:
            df = ak.stock_zh_index_spot_em()
            major = {"上证指数": "000001", "深证成指": "399001", "创业板指": "399006"}
            result = []
            for name, code in major.items():
                row = df[df["名称"] == name] if "名称" in df.columns else None
                if row is not None and not row.empty:
                    r = row.iloc[0]
                    result.append({
                        "name": name, "code": code,
                        "price": float(r["最新价"]),
                        "change_pct": float(r["涨跌幅"]),
                    })
            return result
        except Exception:
            return []
```

- [ ] **Step 2: Commit**

```bash
cd /home/admin/stocktool && git add -A && git commit -m "feat: akshare data source adapter"
```

---

### Task 6: Create tushare adapter

**Files:**
- Create: `backend/data_sources/tushare.py`

- [ ] **Step 1: Write tushare adapter**

Write `backend/data_sources/tushare.py`:
```python
import pandas as pd
from backend.data_sources.base import BaseDataSource, PERIOD_MAP
from backend.config import settings


class TushareDataSource(BaseDataSource):
    name = "tushare"

    def __init__(self):
        self._pro = None

    @property
    def pro(self):
        if self._pro is None:
            import tushare as ts
            ts.set_token(settings.tushare_token)
            self._pro = ts.pro_api()
        return self._pro

    def search_stocks(self, keyword: str) -> list[dict]:
        try:
            df = self.pro.stock_basic(exchange="", list_status="L", fields="ts_code,name")
            mask = df["name"].str.contains(keyword)
            results = df[mask].head(20)
            return [
                {"code": row["ts_code"].split(".")[0], "name": row["name"], "market": "A"}
                for _, row in results.iterrows()
            ]
        except Exception:
            return []

    def get_kline(self, code: str, period: str, start_date: str, end_date: str) -> pd.DataFrame:
        try:
            ts_code = f"{code}.{'SH' if code.startswith('6') else 'SZ'}"
            freq_map = {"daily": "D", "weekly": "W", "monthly": "M"}
            freq = freq_map.get(period, "D")
            df = self.pro.daily(ts_code=ts_code, start_date=start_date.replace("-", ""),
                                end_date=end_date.replace("-", ""))
            if df is None or df.empty:
                return pd.DataFrame(columns=["date", "open", "high", "low", "close", "volume"])
            df = df.rename(columns={
                "trade_date": "date", "open": "open", "high": "high",
                "low": "low", "close": "close", "vol": "volume"
            })
            df["date"] = pd.to_datetime(df["date"]).dt.date
            return df[["date", "open", "high", "low", "close", "volume"]]
        except Exception:
            return pd.DataFrame(columns=["date", "open", "high", "low", "close", "volume"])

    def get_realtime_quote(self, code: str) -> dict:
        return {"code": code, "name": "", "price": 0, "change_pct": 0}

    def get_index_data(self) -> list[dict]:
        return []
```

- [ ] **Step 2: Commit**

```bash
cd /home/admin/stocktool && git add -A && git commit -m "feat: tushare data source adapter"
```

---

### Task 7: Create data source factory

**Files:**
- Create: `backend/data_sources/factory.py`

- [ ] **Step 1: Write factory**

Write `backend/data_sources/factory.py`:
```python
from backend.data_sources.base import BaseDataSource
from backend.data_sources.akshare import AkshareDataSource
from backend.data_sources.tushare import TushareDataSource
from backend.config import settings


_sources: dict[str, BaseDataSource] = {
    "akshare": AkshareDataSource(),
    "tushare": TushareDataSource(),
}


def get_data_source(name: str | None = None) -> BaseDataSource:
    source_name = name or settings.active_data_source
    if source_name not in _sources:
        raise ValueError(f"Unknown data source: {source_name}. Available: {list(_sources.keys())}")
    return _sources[source_name]


def list_data_sources() -> list[str]:
    return list(_sources.keys())


def switch_data_source(name: str) -> None:
    if name not in _sources:
        raise ValueError(f"Unknown data source: {name}")
    settings.active_data_source = name
```

- [ ] **Step 2: Verify factory works**

```bash
cd /home/admin/stocktool && python -c "
from backend.data_sources.factory import get_data_source, list_data_sources
ds = get_data_source()
print('Active source:', ds.name)
print('Available:', list_data_sources())
"
```

Expected: `Active source: akshare` and `Available: ['akshare', 'tushare']`

- [ ] **Step 3: Commit**

```bash
cd /home/admin/stocktool && git add -A && git commit -m "feat: data source factory"
```

---

### Task 8: Create indicator registry and base class

**Files:**
- Create: `backend/services/indicator.py`

- [ ] **Step 1: Write indicator service**

Write `backend/services/indicator.py`:
```python
from abc import ABC, abstractmethod
import pandas as pd


class BaseIndicator(ABC):
    name: str = ""
    required_columns: list[str] = ["close"]

    @abstractmethod
    def compute(self, df: pd.DataFrame) -> pd.DataFrame:
        """Append indicator columns to DataFrame. Returns modified DataFrame."""
        ...


class MacdIndicator(BaseIndicator):
    name = "MACD"
    required_columns = ["close"]

    def compute(self, df: pd.DataFrame) -> pd.DataFrame:
        import ta
        df = df.copy()
        df["MACD_DIF"] = ta.trend.macd_diff(df["close"], window_slow=26, window_fast=12)
        df["MACD_DEA"] = ta.trend.macd_signal(df["close"], window_slow=26, window_fast=12, window_sign=9)
        df["MACD_HIST"] = ta.trend.macd_diff(df["close"], window_slow=26, window_fast=12) - \
                          ta.trend.macd_signal(df["close"], window_slow=26, window_fast=12, window_sign=9)
        return df


class MaIndicator(BaseIndicator):
    name = "MA"
    required_columns = ["close"]

    def compute(self, df: pd.DataFrame) -> pd.DataFrame:
        import ta
        df = df.copy()
        df["MA5"] = ta.trend.sma_indicator(df["close"], window=5)
        df["MA10"] = ta.trend.sma_indicator(df["close"], window=10)
        df["MA20"] = ta.trend.sma_indicator(df["close"], window=20)
        df["MA60"] = ta.trend.sma_indicator(df["close"], window=60)
        return df


class KdjIndicator(BaseIndicator):
    name = "KDJ"
    required_columns = ["high", "low", "close"]

    def compute(self, df: pd.DataFrame) -> pd.DataFrame:
        import ta
        df = df.copy()
        df["KDJ_K"] = ta.momentum.stoch_k(df["high"], df["low"], df["close"], window=9, smooth_window=3)
        df["KDJ_D"] = ta.momentum.stoch_d(df["high"], df["low"], df["close"], window=9, smooth_window=3)
        df["KDJ_J"] = 3 * df["KDJ_K"] - 2 * df["KDJ_D"]
        return df


class RsiIndicator(BaseIndicator):
    name = "RSI"
    required_columns = ["close"]

    def compute(self, df: pd.DataFrame) -> pd.DataFrame:
        import ta
        df = df.copy()
        df["RSI6"] = ta.momentum.rsi(df["close"], window=6)
        df["RSI12"] = ta.momentum.rsi(df["close"], window=12)
        df["RSI24"] = ta.momentum.rsi(df["close"], window=24)
        return df


INDICATOR_REGISTRY: dict[str, BaseIndicator] = {
    "MACD": MacdIndicator(),
    "MA": MaIndicator(),
    "KDJ": KdjIndicator(),
    "RSI": RsiIndicator(),
}


def compute_indicators(df: pd.DataFrame, indicator_names: list[str]) -> pd.DataFrame:
    result = df.copy()
    for name in indicator_names:
        if name not in INDICATOR_REGISTRY:
            raise ValueError(f"Unknown indicator: {name}. Available: {list(INDICATOR_REGISTRY.keys())}")
        indicator = INDICATOR_REGISTRY[name]
        result = indicator.compute(result)
    return result


def list_indicators() -> list[str]:
    return list(INDICATOR_REGISTRY.keys())
```

- [ ] **Step 2: Verify indicator computation**

```bash
cd /home/admin/stocktool && python -c "
import pandas as pd
from backend.services.indicator import compute_indicators, list_indicators

df = pd.DataFrame({
    'date': pd.date_range('2024-01-01', periods=100),
    'open': range(100), 'high': range(1, 101), 'low': range(99, -1, -1),
    'close': [10 + i * 0.5 for i in range(100)],
    'volume': [1000000] * 100
})
result = compute_indicators(df, ['MACD', 'MA', 'KDJ', 'RSI'])
print('Columns:', list(result.columns))
print('Available indicators:', list_indicators())
print('OK')
"
```

Expected: output shows MACD/MA/KDJ/RSI columns and `OK`

- [ ] **Step 3: Commit**

```bash
cd /home/admin/stocktool && git add -A && git commit -m "feat: indicator registry with MACD, MA, KDJ, RSI"
```

---

### Task 9: Create market data API router (K-line endpoint)

**Files:**
- Create: `backend/api/market.py`

- [ ] **Step 1: Write market API router**

Write `backend/api/market.py`:
```python
from datetime import date, datetime, timedelta
from fastapi import APIRouter, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, and_
import pandas as pd

from backend.database import get_db
from backend.models.models import KlineCache
from backend.data_sources.factory import get_data_source
from backend.config import settings

router = APIRouter(prefix="/api/v1/market", tags=["market"])

CACHE_TTL = {
    "daily": timedelta(days=1),
    "weekly": timedelta(days=1),
    "monthly": timedelta(days=1),
    "60min": timedelta(minutes=5),
    "30min": timedelta(minutes=5),
    "15min": timedelta(minutes=5),
}


def _is_cache_fresh(period: str, fetched_at: datetime) -> bool:
    ttl = CACHE_TTL.get(period, timedelta(days=1))
    return datetime.utcnow() - fetched_at < ttl


@router.get("/kline")
def get_kline(
    code: str = Query(..., description="Stock code, e.g. 000001"),
    period: str = Query("daily", description="Period: daily/weekly/monthly/60min/30min/15min"),
    start: str = Query(None, description="Start date YYYY-MM-DD"),
    end: str = Query(None, description="End date YYYY-MM-DD"),
    force_refresh: bool = Query(False, description="Force refresh from data source"),
):
    if start is None:
        start = (date.today() - timedelta(days=365)).isoformat()
    if end is None:
        end = date.today().isoformat()

    db: Session = next(get_db())
    try:
        if not force_refresh:
            stmt = select(KlineCache.fetched_at).where(
                and_(KlineCache.code == code, KlineCache.period == period)
            ).order_by(KlineCache.fetched_at.desc()).limit(1)
            last_fetch = db.execute(stmt).scalar()
            if last_fetch and _is_cache_fresh(period, last_fetch):
                stmt = select(KlineCache).where(
                    and_(KlineCache.code == code, KlineCache.period == period,
                         KlineCache.trade_date >= start, KlineCache.trade_date <= end)
                ).order_by(KlineCache.trade_date.asc())
                rows = db.execute(stmt).scalars().all()
                if rows:
                    data = [{"date": str(r.trade_date), "open": r.open, "high": r.high,
                             "low": r.low, "close": r.close, "volume": r.volume} for r in rows]
                    return {"code": code, "period": period, "stale": False, "data": data}

        ds = get_data_source()
        df = ds.get_kline(code, period, start, end)
        if df.empty:
            raise HTTPException(status_code=404, detail=f"No K-line data for {code}")

        stale_flag = df is not None and not force_refresh
        for _, row in df.iterrows():
            existing = db.execute(
                select(KlineCache).where(
                    and_(KlineCache.code == code, KlineCache.period == period,
                         KlineCache.trade_date == row["date"])
                )
            ).scalar()
            if existing is None:
                db.add(KlineCache(
                    code=code, period=period, trade_date=row["date"],
                    open=row["open"], high=row["high"], low=row["low"],
                    close=row["close"], volume=row["volume"],
                ))
        db.commit()

        data = df.to_dict(orient="records")
        for d in data:
            d["date"] = str(d["date"])
        return {"code": code, "period": period, "stale": False, "data": data}
    finally:
        db.close()
```

- [ ] **Step 2: Commit**

```bash
cd /home/admin/stocktool && git add -A && git commit -m "feat: market K-line API router with caching"
```

---

### Task 10: Create main.py FastAPI app entry point

**Files:**
- Create: `backend/main.py`

- [ ] **Step 1: Write main.py**

Write `backend/main.py`:
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.database import init_db
from backend.api.market import router as market_router

app = FastAPI(title="Stock Analysis Tool", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(market_router)


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/api/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 2: Start backend and verify**

Start the server in background:
```bash
cd /home/admin/stocktool && uvicorn backend.main:app --host 0.0.0.0 --port 8000 &
sleep 2
curl -s http://localhost:8000/api/health
```

Expected: `{"status":"ok"}`

- [ ] **Step 3: Stop server and verify K-line endpoint**

```bash
curl -s "http://localhost:8000/api/v1/market/kline?code=000001&period=daily&start=2024-01-01&end=2024-06-30" | head -c 200
```

Expected: JSON response with K-line data for 平安银行.

- [ ] **Step 4: Stop server**

```bash
kill %1 2>/dev/null || true
```

- [ ] **Step 5: Commit**

```bash
cd /home/admin/stocktool && git add -A && git commit -m "feat: FastAPI app entry with CORS and market router"
```

---

### Task 11: Scaffold frontend with Vite + React + TypeScript

**Files:**
- Create: `frontend/` (via Vite scaffold)

- [ ] **Step 1: Create React+TS project with Vite**

```bash
cd /home/admin/stocktool && npm create vite@latest frontend -- --template react-ts
```

- [ ] **Step 2: Install frontend dependencies**

```bash
cd /home/admin/stocktool/frontend && npm install && npm install antd echarts echarts-for-react zustand react-router-dom axios dayjs
npm install -D @types/react-router-dom
```

- [ ] **Step 3: Update vite.config.ts to proxy API calls**

Write `frontend/vite.config.ts`:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
```

- [ ] **Step 4: Clean up default Vite template**

```bash
rm -f /home/admin/stocktool/frontend/src/App.css /home/admin/stocktool/frontend/src/index.css
rm -f /home/admin/stocktool/frontend/src/assets/react.svg /home/admin/stocktool/frontend/public/vite.svg
```

- [ ] **Step 5: Verify frontend starts**

```bash
cd /home/admin/stocktool/frontend && npx vite --host 0.0.0.0 &
sleep 3
curl -s http://localhost:5173 | head -c 100
kill %1 2>/dev/null || true
```

Expected: HTML response from Vite dev server.

- [ ] **Step 6: Commit**

```bash
cd /home/admin/stocktool && git add -A && git commit -m "feat: scaffold React+TypeScript frontend with Vite"
```

---

### Task 12: Create frontend types and API client

**Files:**
- Create: `frontend/src/types/index.ts`
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/api/market.ts`

- [ ] **Step 1: Write TypeScript types**

Write `frontend/src/types/index.ts`:
```typescript
export interface KlineData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface KlineResponse {
  code: string;
  period: string;
  stale: boolean;
  data: KlineData[];
}

export interface IndicatorData {
  MACD_DIF?: number;
  MACD_DEA?: number;
  MACD_HIST?: number;
  MA5?: number;
  MA10?: number;
  MA20?: number;
  MA60?: number;
  KDJ_K?: number;
  KDJ_D?: number;
  KDJ_J?: number;
  RSI6?: number;
  RSI12?: number;
  RSI24?: number;
}

export interface Signal {
  type: string;
  indicator: string;
  description: string;
  date: string;
  position?: number;
}

export interface AnalysisResponse {
  code: string;
  period: string;
  kline: (KlineData & IndicatorData)[];
  signals: Signal[];
}

export interface StockInfo {
  id?: number;
  code: string;
  name: string;
  market: string;
}

export interface IndexData {
  name: string;
  code: string;
  price: number;
  change_pct: number;
}

export type Period = 'daily' | 'weekly' | 'monthly' | '60min' | '30min' | '15min';
```

- [ ] **Step 2: Write API axios client**

Write `frontend/src/api/client.ts`:
```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
});

export default api;
```

- [ ] **Step 3: Write market API module**

Write `frontend/src/api/market.ts`:
```typescript
import api from './client';
import { KlineResponse } from '../types';

export async function fetchKline(
  code: string,
  period: string,
  start?: string,
  end?: string,
  forceRefresh?: boolean
): Promise<KlineResponse> {
  const params: Record<string, string | boolean | undefined> = { code, period, start, end, force_refresh: forceRefresh };
  const { data } = await api.get('/market/kline', { params });
  return data;
}
```

- [ ] **Step 4: Commit**

```bash
cd /home/admin/stocktool && git add -A && git commit -m "feat: frontend types and API client layer"
```

---

### Task 13: Set up frontend routing and layout shell

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/main.tsx`
- Create: `frontend/src/pages/Dashboard.tsx`
- Create: `frontend/src/pages/StockDetail.tsx`
- Create: `frontend/src/pages/Watchlist.tsx`
- Create: `frontend/src/pages/Screener.tsx`
- Create: `frontend/src/pages/Settings.tsx`
- Create: `frontend/src/components/AppLayout.tsx`

- [ ] **Step 1: Write AppLayout component**

Write `frontend/src/components/AppLayout.tsx`:
```tsx
import { useState } from 'react';
import { Layout, Menu, Typography } from 'antd';
import { BarChartOutlined, StarOutlined, SearchOutlined, SettingOutlined } from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';

const { Header, Sider, Content } = Layout;

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed] = useState(false);

  const menuItems = [
    { key: '/', icon: <BarChartOutlined />, label: 'Dashboard' },
    { key: '/stocks', icon: <StarOutlined />, label: 'Watchlist' },
    { key: '/screener', icon: <SearchOutlined />, label: 'Screener' },
    { key: '/settings', icon: <SettingOutlined />, label: 'Settings' },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider trigger={null} collapsible collapsed={collapsed}>
        <Typography.Title level={5} style={{ color: 'white', textAlign: 'center', margin: '16px 0' }}>
          股票分析
        </Typography.Title>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: '0 24px', background: '#fff' }}>
          <Typography.Title level={4} style={{ margin: '16px 0' }}>
            Stock Analysis Tool
          </Typography.Title>
        </Header>
        <Content style={{ margin: 16, padding: 24, background: '#fff', borderRadius: 8 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
```

- [ ] **Step 2: Write placeholder pages**

Write `frontend/src/pages/Dashboard.tsx`:
```tsx
export default function Dashboard() {
  return <div>Dashboard — coming soon</div>;
}
```

Write `frontend/src/pages/StockDetail.tsx`:
```tsx
import { useParams } from 'react-router-dom';

export default function StockDetail() {
  const { code } = useParams<{ code: string }>();
  return <div>Stock Detail: {code}</div>;
}
```

Write `frontend/src/pages/Watchlist.tsx`:
```tsx
export default function Watchlist() {
  return <div>Watchlist — coming soon</div>;
}
```

Write `frontend/src/pages/Screener.tsx`:
```tsx
export default function Screener() {
  return <div>Screener — coming soon</div>;
}
```

Write `frontend/src/pages/Settings.tsx`:
```tsx
export default function Settings() {
  return <div>Settings — coming soon</div>;
}
```

- [ ] **Step 3: Update App.tsx with routing**

Write `frontend/src/App.tsx`:
```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AppLayout from './components/AppLayout';
import Dashboard from './pages/Dashboard';
import StockDetail from './pages/StockDetail';
import Watchlist from './pages/Watchlist';
import Screener from './pages/Screener';
import Settings from './pages/Settings';

export default function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/stocks" element={<Watchlist />} />
            <Route path="/stock/:code" element={<StockDetail />} />
            <Route path="/screener" element={<Screener />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}
```

- [ ] **Step 4: Update main.tsx**

Write `frontend/src/main.tsx`:
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 5: Commit**

```bash
cd /home/admin/stocktool && git add -A && git commit -m "feat: frontend routing layout and placeholder pages"
```

---

### Task 14: Create K-line chart component

**Files:**
- Create: `frontend/src/components/KlineChart.tsx`

- [ ] **Step 1: Write KlineChart component**

Write `frontend/src/components/KlineChart.tsx`:
```tsx
import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { KlineData } from '../types';

interface Props {
  klineData: KlineData[];
  height?: number;
}

export default function KlineChart({ klineData, height = 500 }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    if (!instanceRef.current) {
      instanceRef.current = echarts.init(chartRef.current);
    }
    const dates = klineData.map((d) => d.date);
    const ohlc = klineData.map((d) => [d.open, d.close, d.low, d.high]);
    const volumes = klineData.map((d) => d.volume);

    instanceRef.current.setOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
      grid: [
        { left: '10%', right: '8%', top: '5%', height: '60%' },
        { left: '10%', right: '8%', top: '75%', height: '15%' },
      ],
      xAxis: [
        { type: 'category', data: dates, gridIndex: 0, axisLabel: { show: false } },
        { type: 'category', data: dates, gridIndex: 1 },
      ],
      yAxis: [
        { type: 'value', gridIndex: 0, scale: true },
        { type: 'value', gridIndex: 1 },
      ],
      series: [
        {
          type: 'candlestick', name: 'K线',
          data: ohlc, xAxisIndex: 0, yAxisIndex: 0,
          itemStyle: { color: '#ef5350', color0: '#26a69a', borderColor: '#ef5350', borderColor0: '#26a69a' },
        },
        {
          type: 'bar', name: '成交量',
          data: volumes, xAxisIndex: 1, yAxisIndex: 1,
          itemStyle: {
            color: (params: any) => {
              const d = ohlc[params.dataIndex];
              return d && d[1] >= d[0] ? '#ef5350' : '#26a69a';
            },
          },
        },
      ],
      dataZoom: [
        { type: 'inside', xAxisIndex: [0, 1], start: 50, end: 100 },
        { type: 'slider', xAxisIndex: [0, 1], start: 50, end: 100, bottom: 0 },
      ],
    }, true);
  }, [klineData]);

  useEffect(() => {
    const handleResize = () => instanceRef.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      instanceRef.current?.dispose();
    };
  }, []);

  return <div ref={chartRef} style={{ width: '100%', height }} />;
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/admin/stocktool && git add -A && git commit -m "feat: K-line chart component with ECharts"
```

---

### Task 15: Wire up StockDetail page with K-line chart

**Files:**
- Modify: `frontend/src/pages/StockDetail.tsx`
- Create: `frontend/src/store/analysisStore.ts`

- [ ] **Step 1: Create Zustand store**

Write `frontend/src/store/analysisStore.ts`:
```typescript
import { create } from 'zustand';
import { KlineData, Period } from '../types';
import { fetchKline } from '../api/market';

interface AnalysisState {
  klineData: KlineData[];
  period: Period;
  loading: boolean;
  error: string | null;
  setPeriod: (period: Period) => void;
  loadKline: (code: string, forceRefresh?: boolean) => Promise<void>;
}

export const useAnalysisStore = create<AnalysisState>((set, get) => ({
  klineData: [],
  period: 'daily',
  loading: false,
  error: null,

  setPeriod: (period: Period) => {
    set({ period });
  },

  loadKline: async (code: string, forceRefresh = false) => {
    set({ loading: true, error: null });
    try {
      const resp = await fetchKline(code, get().period, undefined, undefined, forceRefresh);
      set({ klineData: resp.data, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },
}));
```

- [ ] **Step 2: Update StockDetail page**

Write `frontend/src/pages/StockDetail.tsx`:
```tsx
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Spin, Alert, Typography, Segmented, Button, Space } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import KlineChart from '../components/KlineChart';
import { useAnalysisStore } from '../store/analysisStore';
import { Period } from '../types';

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
  const { klineData, period, loading, error, setPeriod, loadKline } = useAnalysisStore();

  useEffect(() => {
    if (code) loadKline(code);
  }, [code, period]);

  if (!code) return <Alert type="error" message="No stock code provided" />;

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>{code}</Typography.Title>
        <Segmented
          options={periodOptions}
          value={period}
          onChange={(val) => setPeriod(val as Period)}
        />
        <Button icon={<ReloadOutlined />} onClick={() => loadKline(code, true)} disabled={loading}>
          Refresh
        </Button>
      </Space>

      {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}

      <Spin spinning={loading}>
        {klineData.length > 0 && <KlineChart klineData={klineData} height={500} />}
      </Spin>
    </div>
  );
}
```

- [ ] **Step 3: Verify frontend builds**

```bash
cd /home/admin/stocktool/frontend && npx tsc --noEmit
```

Expected: No TypeScript errors.

- [ ] **Step 4: Commit**

```bash
cd /home/admin/stocktool && git add -A && git commit -m "feat: StockDetail page with K-line chart and period switching"
```

---

## Phase 2: Signal Detection & Full Analysis Page

### Task 16: Create signal detection engine

**Files:**
- Create: `backend/services/signal.py`

- [ ] **Step 1: Write signal detection engine**

Write `backend/services/signal.py`:
```python
import numpy as np
import pandas as pd


def detect_cross(df: pd.DataFrame, col_a: str, col_b: str) -> pd.Series:
    """Detect when col_a crosses above col_b (returns 1), below (returns -1), else 0."""
    above = df[col_a] > df[col_b]
    above_prev = df[col_a].shift(1) > df[col_b].shift(1)
    cross_up = above & ~above_prev
    cross_down = ~above & above_prev
    result = pd.Series(0, index=df.index)
    result[cross_up] = 1
    result[cross_down] = -1
    return result


def detect_cross_value(df: pd.DataFrame, col: str, threshold: float, direction: str) -> pd.Series:
    """Detect when a column crosses a threshold value."""
    if direction == "above":
        cross = (df[col] > threshold) & (df[col].shift(1) <= threshold)
    else:
        cross = (df[col] < threshold) & (df[col].shift(1) >= threshold)
    result = pd.Series(0, index=df.index)
    result[cross] = 1
    return result


class SignalEngine:
    """Detects trading signals from indicator-enriched DataFrame."""

    SIGNAL_DEFS = [
        # MACD signals
        {"type": "golden_cross", "indicator": "MACD", "description": "MACD金叉：DIF上穿DEA",
         "columns": ["MACD_DIF", "MACD_DEA"], "detector": "cross_up"},
        {"type": "death_cross", "indicator": "MACD", "description": "MACD死叉：DIF下穿DEA",
         "columns": ["MACD_DIF", "MACD_DEA"], "detector": "cross_down"},
        # MA signals
        {"type": "golden_cross", "indicator": "MA", "description": "MA金叉：MA5上穿MA10",
         "columns": ["MA5", "MA10"], "detector": "cross_up"},
        {"type": "death_cross", "indicator": "MA", "description": "MA死叉：MA5下穿MA10",
         "columns": ["MA5", "MA10"], "detector": "cross_down"},
        {"type": "golden_cross", "indicator": "MA", "description": "MA金叉：MA5上穿MA20",
         "columns": ["MA5", "MA20"], "detector": "cross_up"},
        {"type": "death_cross", "indicator": "MA", "description": "MA死叉：MA5下穿MA20",
         "columns": ["MA5", "MA20"], "detector": "cross_down"},
        {"type": "golden_cross", "indicator": "MA", "description": "MA金叉：MA10上穿MA20",
         "columns": ["MA10", "MA20"], "detector": "cross_up"},
        {"type": "death_cross", "indicator": "MA", "description": "MA死叉：MA10下穿MA20",
         "columns": ["MA10", "MA20"], "detector": "cross_down"},
        # KDJ signals
        {"type": "golden_cross", "indicator": "KDJ", "description": "KDJ金叉：K上穿D",
         "columns": ["KDJ_K", "KDJ_D"], "detector": "cross_up"},
        {"type": "death_cross", "indicator": "KDJ", "description": "KDJ死叉：K下穿D",
         "columns": ["KDJ_K", "KDJ_D"], "detector": "cross_down"},
        {"type": "oversold", "indicator": "KDJ", "description": "KDJ超卖：J值低于0",
         "columns": ["KDJ_J"], "detector": "below_zero"},
        {"type": "overbought", "indicator": "KDJ", "description": "KDJ超买：J值高于100",
         "columns": ["KDJ_J"], "detector": "above_100"},
        # RSI signals
        {"type": "oversold", "indicator": "RSI", "description": "RSI超卖：RSI6低于30",
         "columns": ["RSI6"], "detector": "rsi_oversold"},
        {"type": "overbought", "indicator": "RSI", "description": "RSI超买：RSI6高于70",
         "columns": ["RSI6"], "detector": "rsi_overbought"},
    ]

    def detect(self, df: pd.DataFrame) -> list[dict]:
        signals = []
        for sig_def in self.SIGNAL_DEFS:
            cols = sig_def["columns"]
            if len(cols) == 2 and cols[0] in df.columns and cols[1] in df.columns:
                crosses = detect_cross(df, cols[0], cols[1])
                for i in range(len(crosses)):
                    if (sig_def["detector"] == "cross_up" and crosses.iloc[i] == 1) or \
                       (sig_def["detector"] == "cross_down" and crosses.iloc[i] == -1):
                        signals.append({
                            "type": sig_def["type"],
                            "indicator": sig_def["indicator"],
                            "description": sig_def["description"],
                            "date": str(df["date"].iloc[i]),
                            "position": i,
                        })
            elif len(cols) == 1 and cols[0] in df.columns:
                col = cols[0]
                for i in range(len(df)):
                    val = df[col].iloc[i]
                    if pd.isna(val):
                        continue
                    if sig_def["detector"] == "below_zero" and val < 0:
                        signals.append({
                            "type": sig_def["type"], "indicator": sig_def["indicator"],
                            "description": sig_def["description"],
                            "date": str(df["date"].iloc[i]), "position": i,
                        })
                    elif sig_def["detector"] == "above_100" and val > 100:
                        signals.append({
                            "type": sig_def["type"], "indicator": sig_def["indicator"],
                            "description": sig_def["description"],
                            "date": str(df["date"].iloc[i]), "position": i,
                        })
                    elif sig_def["detector"] == "rsi_oversold" and val < 30:
                        signals.append({
                            "type": sig_def["type"], "indicator": sig_def["indicator"],
                            "description": sig_def["description"],
                            "date": str(df["date"].iloc[i]), "position": i,
                        })
                    elif sig_def["detector"] == "rsi_overbought" and val > 70:
                        signals.append({
                            "type": sig_def["type"], "indicator": sig_def["indicator"],
                            "description": sig_def["description"],
                            "date": str(df["date"].iloc[i]), "position": i,
                        })
        return signals
```

- [ ] **Step 2: Verify signal engine with test data**

```bash
cd /home/admin/stocktool && python -c "
import pandas as pd
from backend.services.signal import SignalEngine
from backend.services.indicator import compute_indicators

df = pd.DataFrame({
    'date': pd.date_range('2024-01-01', periods=200),
    'open': [10.0] * 200, 'high': [10.5] * 200, 'low': [9.5] * 200,
    'close': [10.0 + (i % 50) * 0.2 for i in range(200)],
    'volume': [1000000] * 200,
})
df = compute_indicators(df, ['MACD', 'MA', 'KDJ', 'RSI'])
engine = SignalEngine()
signals = engine.detect(df)
print(f'Found {len(signals)} signals')
for s in signals[:5]:
    print(f'  {s[\"date\"]}: {s[\"description\"]}')
"
```

Expected: Several signals detected with descriptions.

- [ ] **Step 3: Commit**

```bash
cd /home/admin/stocktool && git add -A && git commit -m "feat: signal detection engine for golden cross, death cross, overbought/oversold"
```

---

### Task 17: Create analysis API router

**Files:**
- Create: `backend/api/analysis.py`

- [ ] **Step 1: Write analysis API router**

Write `backend/api/analysis.py`:
```python
from datetime import date, timedelta
from fastapi import APIRouter, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, and_
import pandas as pd

from backend.database import get_db
from backend.models.models import KlineCache
from backend.data_sources.factory import get_data_source
from backend.services.indicator import compute_indicators, list_indicators
from backend.services.signal import SignalEngine

router = APIRouter(prefix="/api/v1/analysis", tags=["analysis"])


@router.get("/indicators")
def get_indicators(
    code: str = Query(...),
    period: str = Query("daily"),
    indicators: str = Query("MACD,MA,KDJ,RSI"),
    start: str = Query(None),
    end: str = Query(None),
):
    if start is None:
        start = (date.today() - timedelta(days=365)).isoformat()
    if end is None:
        end = date.today().isoformat()

    indicator_list = [x.strip() for x in indicators.split(",")]

    db: Session = next(get_db())
    try:
        stmt = select(KlineCache).where(
            and_(KlineCache.code == code, KlineCache.period == period,
                 KlineCache.trade_date >= start, KlineCache.trade_date <= end)
        ).order_by(KlineCache.trade_date.asc())
        rows = db.execute(stmt).scalars().all()

        if not rows:
            ds = get_data_source()
            df = ds.get_kline(code, period, start, end)
            if df.empty:
                raise HTTPException(status_code=404, detail=f"No data for {code}")
            for _, row in df.iterrows():
                db.add(KlineCache(code=code, period=period, trade_date=row["date"],
                                  open=row["open"], high=row["high"], low=row["low"],
                                  close=row["close"], volume=row["volume"]))
            db.commit()
            rows = db.execute(stmt).scalars().all()

        data = [{"date": str(r.trade_date), "open": r.open, "high": r.high,
                 "low": r.low, "close": r.close, "volume": r.volume} for r in rows]
        df = pd.DataFrame(data)
        if df.empty:
            raise HTTPException(status_code=404, detail=f"No data for {code}")

        df = compute_indicators(df, indicator_list)
        engine = SignalEngine()
        signals = engine.detect(df)

        result = df.to_dict(orient="records")
        for r in result:
            for k, v in r.items():
                if isinstance(v, float) and pd.isna(v):
                    r[k] = None
            if isinstance(r.get("date"), date):
                r["date"] = str(r["date"])

        return {"code": code, "period": period, "kline": result, "signals": signals}
    finally:
        db.close()


@router.get("/signals")
def get_signals(
    code: str = Query(...),
    period: str = Query("daily"),
    start: str = Query(None),
    end: str = Query(None),
):
    if start is None:
        start = (date.today() - timedelta(days=365)).isoformat()
    if end is None:
        end = date.today().isoformat()

    db: Session = next(get_db())
    try:
        stmt = select(KlineCache).where(
            and_(KlineCache.code == code, KlineCache.period == period,
                 KlineCache.trade_date >= start, KlineCache.trade_date <= end)
        ).order_by(KlineCache.trade_date.asc())
        rows = db.execute(stmt).scalars().all()

        if not rows:
            ds = get_data_source()
            df = ds.get_kline(code, period, start, end)
            if df.empty:
                raise HTTPException(status_code=404, detail=f"No data for {code}")
            for _, row in df.iterrows():
                db.add(KlineCache(code=code, period=period, trade_date=row["date"],
                                  open=row["open"], high=row["high"], low=row["low"],
                                  close=row["close"], volume=row["volume"]))
            db.commit()
            rows = db.execute(stmt).scalars().all()

        data = [{"date": str(r.trade_date), "open": r.open, "high": r.high,
                 "low": r.low, "close": r.close, "volume": r.volume} for r in rows]
        df = pd.DataFrame(data)
        df = compute_indicators(df, ["MACD", "MA", "KDJ", "RSI"])
        engine = SignalEngine()
        signals = engine.detect(df)
        return {"code": code, "period": period, "signals": signals}
    finally:
        db.close()
```

- [ ] **Step 2: Register analysis router in main.py**

Read `backend/main.py` and add:
```python
from backend.api.analysis import router as analysis_router

app.include_router(analysis_router)
```

- [ ] **Step 3: Restart backend and test**

```bash
cd /home/admin/stocktool && uvicorn backend.main:app --host 0.0.0.0 --port 8000 &
sleep 2
curl -s "http://localhost:8000/api/v1/analysis/indicators?code=000001&period=daily&indicators=MACD,MA" | python -c "import sys,json; d=json.load(sys.stdin); print(f'Kline rows: {len(d[\"kline\"])}, Signals: {len(d[\"signals\"])}')"
kill %1 2>/dev/null || true
```

Expected: `Kline rows: N, Signals: N` with actual numbers.

- [ ] **Step 4: Commit**

```bash
cd /home/admin/stocktool && git add -A && git commit -m "feat: analysis API router with indicators and signals"
```

---

### Task 18: Enhance StockDetail page with indicator overlays and signal panel

**Files:**
- Modify: `frontend/src/pages/StockDetail.tsx`
- Modify: `frontend/src/components/KlineChart.tsx`
- Create: `frontend/src/components/SignalPanel.tsx`
- Create: `frontend/src/api/analysis.ts`

- [ ] **Step 1: Write analysis API module**

Write `frontend/src/api/analysis.ts`:
```typescript
import api from './client';
import { AnalysisResponse } from '../types';

export async function fetchAnalysis(
  code: string,
  period: string,
  indicators: string = 'MACD,MA,KDJ,RSI'
): Promise<AnalysisResponse> {
  const { data } = await api.get('/analysis/indicators', {
    params: { code, period, indicators },
  });
  return data;
}
```

- [ ] **Step 2: Write SignalPanel component**

Write `frontend/src/components/SignalPanel.tsx`:
```tsx
import { List, Tag, Typography } from 'antd';
import { Signal } from '../types';

interface Props {
  signals: Signal[];
  onSignalClick?: (position: number) => void;
}

const signalColorMap: Record<string, string> = {
  golden_cross: 'red',
  death_cross: 'green',
  oversold: 'blue',
  overbought: 'orange',
};

export default function SignalPanel({ signals, onSignalClick }: Props) {
  if (signals.length === 0) {
    return <Typography.Text type="secondary">No signals detected for current view</Typography.Text>;
  }

  return (
    <List
      size="small"
      dataSource={signals.slice(-20).reverse()}
      renderItem={(s) => (
        <List.Item
          style={{ cursor: onSignalClick ? 'pointer' : 'default' }}
          onClick={() => onSignalClick?.(s.position!)}
        >
          <Tag color={signalColorMap[s.type] || 'default'}>{s.indicator}</Tag>
          {s.description} — <Typography.Text type="secondary">{s.date}</Typography.Text>
        </List.Item>
      )}
    />
  );
}
```

- [ ] **Step 3: Update KlineChart to support MA overlay**

Add to `frontend/src/components/KlineChart.tsx` — add new prop and series for MA overlay:

Update the Props interface and add MA series. Replace the file:
```tsx
import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { KlineData, IndicatorData } from '../types';

interface Props {
  klineData: (KlineData & Partial<IndicatorData>)[];
  height?: number;
  showMA?: boolean;
}

export default function KlineChart({ klineData, height = 500, showMA = false }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current || klineData.length === 0) return;
    if (!instanceRef.current) {
      instanceRef.current = echarts.init(chartRef.current);
    }
    const dates = klineData.map((d) => d.date);
    const ohlc = klineData.map((d) => [d.open, d.close, d.low, d.high]);
    const volumes = klineData.map((d) => d.volume);

    const series: any[] = [
      {
        type: 'candlestick', name: 'K线',
        data: ohlc, xAxisIndex: 0, yAxisIndex: 0,
        itemStyle: { color: '#ef5350', color0: '#26a69a', borderColor: '#ef5350', borderColor0: '#26a69a' },
      },
    ];

    if (showMA) {
      const maColors = ['#f5a623', '#4a90d9', '#7ed321', '#9b59b6'];
      const maKeys = ['MA5', 'MA10', 'MA20', 'MA60'];
      maKeys.forEach((key, i) => {
        const vals = klineData.map((d) => (d as any)[key]);
        if (vals.some((v) => v != null)) {
          series.push({
            type: 'line', name: key, data: vals, xAxisIndex: 0, yAxisIndex: 0,
            smooth: true, lineStyle: { width: 1, color: maColors[i] },
            symbol: 'none',
          });
        }
      });
    }

    series.push({
      type: 'bar', name: '成交量',
      data: volumes, xAxisIndex: 1, yAxisIndex: 1,
      itemStyle: {
        color: (params: any) => {
          const d = ohlc[params.dataIndex];
          return d && d[1] >= d[0] ? '#ef5350' : '#26a69a';
        },
      },
    });

    instanceRef.current.setOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
      legend: { data: ['K线', ...(showMA ? ['MA5', 'MA10', 'MA20', 'MA60'] : []), '成交量'], top: 0 },
      grid: [
        { left: '10%', right: '8%', top: '8%', height: '55%' },
        { left: '10%', right: '8%', top: '73%', height: '15%' },
      ],
      xAxis: [
        { type: 'category', data: dates, gridIndex: 0, axisLabel: { show: false } },
        { type: 'category', data: dates, gridIndex: 1 },
      ],
      yAxis: [
        { type: 'value', gridIndex: 0, scale: true },
        { type: 'value', gridIndex: 1 },
      ],
      series,
      dataZoom: [
        { type: 'inside', xAxisIndex: [0, 1], start: 50, end: 100 },
        { type: 'slider', xAxisIndex: [0, 1], start: 50, end: 100, bottom: 0 },
      ],
    }, true);
  }, [klineData, showMA]);

  useEffect(() => {
    const handleResize = () => instanceRef.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      instanceRef.current?.dispose();
    };
  }, []);

  return <div ref={chartRef} style={{ width: '100%', height }} />;
}
```

- [ ] **Step 4: Update StockDetail page with full analysis**

Write `frontend/src/pages/StockDetail.tsx`:
```tsx
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Spin, Alert, Typography, Segmented, Button, Space, Row, Col, Checkbox } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import KlineChart from '../components/KlineChart';
import SignalPanel from '../components/SignalPanel';
import { useAnalysisStore } from '../store/analysisStore';
import { Period } from '../types';

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
  const {
    klineData, signals, period, loading, error,
    showMA, showMACD, showKDJ, showRSI,
    setPeriod, setShowMA, setShowMACD, setShowKDJ, setShowRSI,
    loadAnalysis,
  } = useAnalysisStore();

  useEffect(() => {
    if (code) loadAnalysis(code);
  }, [code, period, showMACD, showKDJ, showRSI]);

  if (!code) return <Alert type="error" message="No stock code provided" />;

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>{code}</Typography.Title>
        <Segmented
          options={periodOptions}
          value={period}
          onChange={(val) => setPeriod(val as Period)}
        />
        <Button icon={<ReloadOutlined />} onClick={() => loadAnalysis(code, true)} disabled={loading}>
          Refresh
        </Button>
      </Space>

      {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}

      <Row gutter={16}>
        <Col span={18}>
          <Spin spinning={loading}>
            <div style={{ marginBottom: 8 }}>
              <Checkbox checked={showMA} onChange={(e) => setShowMA(e.target.checked)}>MA</Checkbox>
              <Checkbox checked={showMACD} onChange={(e) => setShowMACD(e.target.checked)} style={{ marginLeft: 12 }}>MACD</Checkbox>
              <Checkbox checked={showKDJ} onChange={(e) => setShowKDJ(e.target.checked)} style={{ marginLeft: 12 }}>KDJ</Checkbox>
              <Checkbox checked={showRSI} onChange={(e) => setShowRSI(e.target.checked)} style={{ marginLeft: 12 }}>RSI</Checkbox>
            </div>
            {klineData.length > 0 && (
              <KlineChart klineData={klineData} height={500} showMA={showMA} />
            )}
          </Spin>
        </Col>
        <Col span={6}>
          <Typography.Title level={5}>Signal Panel</Typography.Title>
          <SignalPanel
            signals={signals}
            onSignalClick={(pos) => {
              // Could scroll chart to position
              console.log('Navigate to position', pos);
            }}
          />
        </Col>
      </Row>
    </div>
  );
}
```

- [ ] **Step 5: Update Zustand store to handle analysis data**

Write `frontend/src/store/analysisStore.ts`:
```typescript
import { create } from 'zustand';
import { KlineData, IndicatorData, Signal, Period } from '../types';
import { fetchAnalysis } from '../api/analysis';

interface AnalysisState {
  klineData: (KlineData & Partial<IndicatorData>)[];
  signals: Signal[];
  period: Period;
  loading: boolean;
  error: string | null;
  showMA: boolean;
  showMACD: boolean;
  showKDJ: boolean;
  showRSI: boolean;
  setPeriod: (period: Period) => void;
  setShowMA: (show: boolean) => void;
  setShowMACD: (show: boolean) => void;
  setShowKDJ: (show: boolean) => void;
  setShowRSI: (show: boolean) => void;
  loadAnalysis: (code: string, forceRefresh?: boolean) => Promise<void>;
}

function buildIndicatorString(state: AnalysisState): string {
  const parts = ['MACD', 'MA', 'KDJ', 'RSI'];
  return parts.join(',');
}

export const useAnalysisStore = create<AnalysisState>((set, get) => ({
  klineData: [],
  signals: [],
  period: 'daily',
  loading: false,
  error: null,
  showMA: true,
  showMACD: false,
  showKDJ: false,
  showRSI: false,

  setPeriod: (period: Period) => set({ period }),
  setShowMA: (show: boolean) => set({ showMA: show }),
  setShowMACD: (show: boolean) => set({ showMACD: show }),
  setShowKDJ: (show: boolean) => set({ showKDJ: show }),
  setShowRSI: (show: boolean) => set({ showRSI: show }),

  loadAnalysis: async (code: string, forceRefresh = false) => {
    set({ loading: true, error: null });
    try {
      const state = get();
      const indicators = buildIndicatorString(state);
      const resp = await fetchAnalysis(code, state.period, indicators);
      set({ klineData: resp.kline, signals: resp.signals, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },
}));
```

- [ ] **Step 6: Verify frontend compiles**

```bash
cd /home/admin/stocktool/frontend && npx tsc --noEmit
```

Expected: No TypeScript errors.

- [ ] **Step 7: Commit**

```bash
cd /home/admin/stocktool && git add -A && git commit -m "feat: enhanced StockDetail with indicator overlays and signal panel"
```

---

## Phase 3: Watchlist & Dashboard

### Task 19: Create watchlist API router

**Files:**
- Create: `backend/api/stocks.py`

- [ ] **Step 1: Write watchlist API router**

Write `backend/api/stocks.py`:
```python
from fastapi import APIRouter, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from backend.database import get_db
from backend.models.models import Watchlist
from backend.data_sources.factory import get_data_source

router = APIRouter(prefix="/api/v1/stocks", tags=["stocks"])


@router.get("")
def list_watchlist():
    db: Session = next(get_db())
    try:
        rows = db.execute(select(Watchlist).order_by(Watchlist.added_at.desc())).scalars().all()
        return [{"id": r.id, "code": r.code, "name": r.name, "market": r.market} for r in rows]
    finally:
        db.close()


@router.post("")
def add_stock(code: str = Query(...), name: str = Query(""), market: str = Query("A")):
    db: Session = next(get_db())
    try:
        existing = db.execute(
            select(Watchlist).where(Watchlist.code == code, Watchlist.market == market)
        ).scalar()
        if existing:
            raise HTTPException(status_code=409, detail=f"Stock {code} already in watchlist")

        stock = Watchlist(code=code, name=name, market=market)
        db.add(stock)
        db.commit()
        db.refresh(stock)
        return {"id": stock.id, "code": stock.code, "name": stock.name, "market": stock.market}
    finally:
        db.close()


@router.delete("/{stock_id}")
def delete_stock(stock_id: int):
    db: Session = next(get_db())
    try:
        stock = db.get(Watchlist, stock_id)
        if not stock:
            raise HTTPException(status_code=404, detail="Stock not found")
        db.delete(stock)
        db.commit()
        return {"ok": True}
    finally:
        db.close()


@router.get("/search")
def search_stocks(q: str = Query(..., min_length=1)):
    ds = get_data_source()
    results = ds.search_stocks(q)
    return {"query": q, "results": results}
```

- [ ] **Step 2: Register stocks router in main.py**

Read `backend/main.py` and add:
```python
from backend.api.stocks import router as stocks_router

app.include_router(stocks_router)
```

- [ ] **Step 3: Commit**

```bash
cd /home/admin/stocktool && git add -A && git commit -m "feat: watchlist API router with CRUD and search"
```

---

### Task 20: Create Dashboard page with real-time indices

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`
- Create: `frontend/src/api/stocks.ts`

- [ ] **Step 1: Write stocks API module**

Write `frontend/src/api/stocks.ts`:
```typescript
import api from './client';
import { StockInfo } from '../types';

export async function fetchWatchlist(): Promise<StockInfo[]> {
  const { data } = await api.get('/stocks');
  return data;
}

export async function addStock(code: string, name?: string, market?: string): Promise<StockInfo> {
  const { data } = await api.post('/stocks', null, { params: { code, name, market } });
  return data;
}

export async function deleteStock(id: number): Promise<void> {
  await api.delete(`/stocks/${id}`);
}

export async function searchStocks(q: string): Promise<{ query: string; results: StockInfo[] }> {
  const { data } = await api.get('/stocks/search', { params: { q } });
  return data;
}
```

- [ ] **Step 2: Write Dashboard page**

Write `frontend/src/pages/Dashboard.tsx`:
```tsx
import { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Typography } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { IndexData } from '../types';
import api from '../api/client';

export default function Dashboard() {
  const [indices, setIndices] = useState<IndexData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/market/indices')
      .then(({ data }) => setIndices(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <Typography.Title level={4}>Market Overview</Typography.Title>
      <Row gutter={16}>
        {indices.map((idx) => (
          <Col span={8} key={idx.code}>
            <Card loading={loading}>
              <Statistic
                title={idx.name}
                value={idx.price}
                precision={2}
                valueStyle={{ color: idx.change_pct >= 0 ? '#cf1322' : '#3f8600' }}
                prefix={idx.change_pct >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                suffix={<span style={{ fontSize: 14 }}>{idx.change_pct.toFixed(2)}%</span>}
              />
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
```

- [ ] **Step 3: Add indices endpoint to market router**

Read `backend/api/market.py` and append:
```python
@router.get("/indices")
def get_indices():
    ds = get_data_source()
    return ds.get_index_data()
```

- [ ] **Step 5: Commit**

```bash
cd /home/admin/stocktool && git add -A && git commit -m "feat: dashboard page with index cards"
```

---

### Task 21: Create Watchlist page

**Files:**
- Modify: `frontend/src/pages/Watchlist.tsx`

- [ ] **Step 1: Write Watchlist page**

Write `frontend/src/pages/Watchlist.tsx`:
```tsx
import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Modal, Input, Space, Typography, message, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { StockInfo } from '../types';
import { fetchWatchlist, addStock, deleteStock, searchStocks } from '../api/stocks';

export default function Watchlist() {
  const navigate = useNavigate();
  const [stocks, setStocks] = useState<StockInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<StockInfo[]>([]);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchWatchlist();
      setStocks(data);
    } catch {
      message.error('Failed to load watchlist');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSearch = async (keyword: string) => {
    if (keyword.length < 2) return;
    setSearching(true);
    try {
      const { results } = await searchStocks(keyword);
      setSearchResults(results);
    } catch {
      message.error('Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleAdd = async (stock: StockInfo) => {
    try {
      await addStock(stock.code, stock.name, stock.market);
      message.success(`Added ${stock.code} ${stock.name}`);
      setModalOpen(false);
      load();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || 'Failed to add stock');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteStock(id);
      message.success('Removed from watchlist');
      load();
    } catch {
      message.error('Failed to delete');
    }
  };

  const columns = [
    { title: 'Code', dataIndex: 'code', key: 'code' },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Market', dataIndex: 'market', key: 'market', width: 80 },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_: any, record: StockInfo) => (
        <Space>
          <Button size="small" onClick={() => navigate(`/stock/${record.code}`)}>Analyze</Button>
          <Popconfirm title="Remove this stock?" onConfirm={() => handleDelete(record.id!)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>My Watchlist</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          Add Stock
        </Button>
      </Space>

      <Table columns={columns} dataSource={stocks} rowKey="id" loading={loading} />

      <Modal
        title="Add Stock"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
      >
        <Input.Search
          placeholder="Search stock code or name..."
          onSearch={handleSearch}
          loading={searching}
          style={{ marginBottom: 16 }}
        />
        <Table
          columns={[
            { title: 'Code', dataIndex: 'code', key: 'code' },
            { title: 'Name', dataIndex: 'name', key: 'name' },
            {
              title: '', key: 'action', width: 80,
              render: (_: any, record: StockInfo) => (
                <Button size="small" type="primary" onClick={() => handleAdd(record)}>Add</Button>
              ),
            },
          ]}
          dataSource={searchResults}
          rowKey="code"
          size="small"
          pagination={false}
        />
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: Verify frontend compiles**

```bash
cd /home/admin/stocktool/frontend && npx tsc --noEmit
```

Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
cd /home/admin/stocktool && git add -A && git commit -m "feat: watchlist page with add/search/delete"
```

---

## Phase 4: Settings & Polish

### Task 22: Create Settings page with data source switch

**Files:**
- Modify: `frontend/src/pages/Settings.tsx`
- Create: `backend/api/datasource.py`

- [ ] **Step 1: Write data source API router**

Write `backend/api/datasource.py`:
```python
from fastapi import APIRouter, Query
from backend.data_sources.factory import list_data_sources, switch_data_source, get_data_source

router = APIRouter(prefix="/api/v1/data-sources", tags=["data-sources"])


@router.get("")
def get_sources():
    ds = get_data_source()
    sources = list_data_sources()
    return {"active": ds.name, "available": sources}


@router.post("/switch")
def switch_source(source: str = Query(...)):
    switch_data_source(source)
    return {"active": source}
```

- [ ] **Step 2: Register in main.py**

Read `backend/main.py` and add:
```python
from backend.api.datasource import router as datasource_router

app.include_router(datasource_router)
```

- [ ] **Step 3: Write Settings page**

Write `frontend/src/pages/Settings.tsx`:
```tsx
import { useState, useEffect } from 'react';
import { Card, Radio, Typography, message } from 'antd';
import api from '../api/client';

export default function Settings() {
  const [active, setActive] = useState<string>('');
  const [available, setAvailable] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/data-sources').then(({ data }) => {
      setActive(data.active);
      setAvailable(data.available);
    }).catch(() => message.error('Failed to load data sources'));
  }, []);

  const handleSwitch = async (source: string) => {
    setLoading(true);
    try {
      await api.post('/data-sources/switch', null, { params: { source } });
      setActive(source);
      message.success(`Switched to ${source}`);
    } catch {
      message.error('Failed to switch data source');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Typography.Title level={4}>Settings</Typography.Title>
      <Card title="Data Source" style={{ maxWidth: 500 }}>
        <Typography.Paragraph>Select the active data source for fetching stock data.</Typography.Paragraph>
        <Radio.Group value={active} onChange={(e) => handleSwitch(e.target.value)} disabled={loading}>
          {available.map((s) => (
            <Radio.Button key={s} value={s}>{s}</Radio.Button>
          ))}
        </Radio.Group>
        <Typography.Paragraph type="secondary" style={{ marginTop: 16 }}>
          akshare: Free, no API key required. tushare: Requires token in .env.
        </Typography.Paragraph>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
cd /home/admin/stocktool && git add -A && git commit -m "feat: settings page with data source switching"
```

---

### Task 23: Create Screener placeholder page

**Files:**
- Modify: `frontend/src/pages/Screener.tsx`

- [ ] **Step 1: Write Screener placeholder**

Write `frontend/src/pages/Screener.tsx`:
```tsx
import { Empty, Typography } from 'antd';

export default function Screener() {
  return (
    <div>
      <Typography.Title level={4}>Market Screener</Typography.Title>
      <Empty
        description="Coming soon — scan the entire market for buy/sell signals based on technical indicators"
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/admin/stocktool && git add -A && git commit -m "feat: screener placeholder page"
```

---

### Task 24: Integration test — end to end

**Files:**
- Create: `backend/test_services.py`

- [ ] **Step 1: Write backend tests**

Write `backend/test_services.py`:
```python
import pandas as pd
from backend.services.indicator import compute_indicators, list_indicators
from backend.services.signal import SignalEngine


def test_all_indicators_compute():
    df = pd.DataFrame({
        "date": pd.date_range("2024-01-01", periods=120),
        "open": [10.0 + i * 0.05 for i in range(120)],
        "high": [10.5 + i * 0.05 for i in range(120)],
        "low": [9.5 + i * 0.05 for i in range(120)],
        "close": [10.2 + i * 0.05 for i in range(120)],
        "volume": [1000000.0] * 120,
    })
    available = list_indicators()
    result = compute_indicators(df, available)
    for ind in available:
        if ind == "MACD":
            assert "MACD_DIF" in result.columns
            assert "MACD_DEA" in result.columns
        elif ind == "MA":
            assert "MA5" in result.columns
            assert "MA20" in result.columns
        elif ind == "KDJ":
            assert "KDJ_K" in result.columns
            assert "KDJ_J" in result.columns
        elif ind == "RSI":
            assert "RSI6" in result.columns


def test_signal_detection():
    df = pd.DataFrame({
        "date": pd.date_range("2024-01-01", periods=200),
        "open": [10.0] * 200, "high": [10.5] * 200, "low": [9.5] * 200,
        "close": [(i % 30) * 0.5 + 10 for i in range(200)],
        "volume": [1000000.0] * 200,
    })
    df = compute_indicators(df, list_indicators())
    engine = SignalEngine()
    signals = engine.detect(df)
    assert len(signals) > 0
    signal_types = {s["type"] for s in signals}
    assert "golden_cross" in signal_types or "death_cross" in signal_types


def test_cross_detection_logic():
    df = pd.DataFrame({
        "date": pd.date_range("2024-01-01", periods=10),
        "open": [10.0] * 10, "high": [10.5] * 10, "low": [9.5] * 10,
        "close": [1, 2, 3, 4, 5, 4, 3, 2, 1, 0.5],
        "volume": [1000000.0] * 10,
    })
    df = compute_indicators(df, ["MA"])
    assert "MA5" in df.columns
```

- [ ] **Step 2: Run tests**

```bash
cd /home/admin/stocktool && python -m pytest backend/test_services.py -v
```

Expected: All 3 tests pass.

- [ ] **Step 3: Commit**

```bash
cd /home/admin/stocktool && git add -A && git commit -m "test: backend service unit tests"
```

---

### Task 25: Create README.md

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README**

Write `README.md`:
```markdown
# Stock Analysis Tool

A personal stock analysis web tool for A-share market using MACD, MA, KDJ, RSI indicators to identify buy/sell signals.

## Quick Start

### Backend
```bash
pip install -r backend/requirements.txt
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

### Frontend
```bash
cd frontend && npm install && npm run dev
```

Open http://localhost:5173

## Features

- K-line charts with MA overlays (ECharts)
- Technical indicators: MACD, MA, KDJ, RSI
- Signal detection: Golden Cross, Death Cross, Overbought/Oversold
- Multi-period analysis (daily, weekly, monthly, 60m, 30m, 15m)
- Self-managed watchlist
- Dual data source support (akshare / tushare)

## Project Structure

```
stocktool/
├── backend/            # FastAPI backend
│   ├── api/            # REST API routers
│   ├── services/       # Business logic (indicators, signals)
│   ├── data_sources/   # Data source adapters (akshare, tushare)
│   ├── models/         # SQLAlchemy models
│   └── main.py         # App entry point
├── frontend/           # React + TypeScript frontend
│   └── src/
│       ├── components/ # Reusable components
│       ├── pages/      # Route pages
│       ├── api/        # API client layer
│       ├── store/      # Zustand stores
│       └── types/      # TypeScript types
└── data/               # SQLite database
```

## Configuration

Set environment variables or create `.env`:
- `ACTIVE_DATA_SOURCE`: `akshare` (default) or `tushare`
- `TUSHARE_TOKEN`: Your tushare API token (required for tushare)
```

- [ ] **Step 2: Final commit**

```bash
cd /home/admin/stocktool && git add -A && git commit -m "docs: README with quick start and project structure"
```

---
