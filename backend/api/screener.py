from fastapi import APIRouter, Query
from sqlalchemy.orm import Session
from sqlalchemy import select

from backend.database import get_db
from backend.models.models import Watchlist
from backend.services.screener import run_screener

router = APIRouter(prefix="/api/v1/screener", tags=["screener"])


@router.get("")
def screen_stocks(
    signal_types: str | None = Query(None),
    signal_categories: str | None = Query(None),
    signal_levels: str | None = Query(None),
    period: str = Query("daily"),
    days: int = Query(120),
    recent_days: int = Query(3),
    codes: str | None = Query(None),
):
    signal_types_list = [x.strip() for x in signal_types.split(",") if x.strip()] if signal_types else None
    signal_categories_list = [x.strip() for x in signal_categories.split(",") if x.strip()] if signal_categories else None
    signal_levels_list = [x.strip() for x in signal_levels.split(",") if x.strip()] if signal_levels else None

    db: Session = next(get_db())
    try:
        if codes:
            stocks = []
            for c in [x.strip() for x in codes.split(",") if x.strip()]:
                row = db.execute(
                    select(Watchlist).where(Watchlist.code == c, Watchlist.market == "A")
                ).scalar()
                if row:
                    stocks.append({"code": row.code, "name": row.name, "market": row.market})
                else:
                    stocks.append({"code": c, "name": c, "market": "A"})
        else:
            rows = db.execute(select(Watchlist)).scalars().all()
            stocks = [{"code": r.code, "name": r.name, "market": r.market} for r in rows]

        result = run_screener(
            db,
            stocks,
            period,
            days,
            recent_days,
            signal_types_list,
            signal_categories_list,
            signal_levels_list,
        )
        return result
    finally:
        db.close()
