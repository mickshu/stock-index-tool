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
