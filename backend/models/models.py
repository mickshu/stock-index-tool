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
