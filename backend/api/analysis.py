from datetime import date, timedelta
import math
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


def _load_kline_df(db: Session, code: str, period: str, start: str, end: str) -> pd.DataFrame:
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
            db.add(KlineCache(
                code=code, period=period, trade_date=row["date"],
                open=row["open"], high=row["high"], low=row["low"],
                close=row["close"], volume=row["volume"],
            ))
        db.commit()
        rows = db.execute(stmt).scalars().all()

    data = [{"date": str(r.trade_date), "open": r.open, "high": r.high,
             "low": r.low, "close": r.close, "volume": r.volume} for r in rows]
    df = pd.DataFrame(data)
    if df.empty:
        raise HTTPException(status_code=404, detail=f"No data for {code}")
    return df


def _sanitize_records(df: pd.DataFrame) -> list[dict]:
    records = df.to_dict(orient="records")
    for r in records:
        for k, v in list(r.items()):
            if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                r[k] = None
            elif isinstance(v, date):
                r[k] = str(v)
    return records


@router.get("/indicators")
def get_indicators(
    code: str = Query(...),
    period: str = Query("daily"),
    indicators: str = Query("MACD,MA,KDJ,RSI"),
    start: str | None = Query(None),
    end: str | None = Query(None),
):
    if start is None:
        start = (date.today() - timedelta(days=365)).isoformat()
    if end is None:
        end = date.today().isoformat()

    indicator_list = [x.strip() for x in indicators.split(",") if x.strip()]
    available = list_indicators()
    for ind in indicator_list:
        if ind not in available:
            raise HTTPException(status_code=400, detail=f"Unknown indicator: {ind}")

    db: Session = next(get_db())
    try:
        df = _load_kline_df(db, code, period, start, end)
        df = compute_indicators(df, indicator_list)
        signals = SignalEngine().detect(df)
        return {
            "code": code,
            "period": period,
            "kline": _sanitize_records(df),
            "signals": signals,
        }
    finally:
        db.close()


@router.get("/signals")
def get_signals(
    code: str = Query(...),
    period: str = Query("daily"),
    start: str | None = Query(None),
    end: str | None = Query(None),
):
    if start is None:
        start = (date.today() - timedelta(days=365)).isoformat()
    if end is None:
        end = date.today().isoformat()

    db: Session = next(get_db())
    try:
        df = _load_kline_df(db, code, period, start, end)
        df = compute_indicators(df, ["MACD", "MA", "KDJ", "RSI"])
        signals = SignalEngine().detect(df)
        return {"code": code, "period": period, "signals": signals}
    finally:
        db.close()


@router.get("/available-indicators")
def get_available():
    return {"indicators": list_indicators()}
