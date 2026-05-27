from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.database import init_db
from backend.api.market import router as market_router
from backend.api.analysis import router as analysis_router
from backend.api.stocks import router as stocks_router
from backend.api.datasource import router as datasource_router

app = FastAPI(title="Stock Analysis Tool", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(market_router)
app.include_router(analysis_router)
app.include_router(stocks_router)
app.include_router(datasource_router)


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/api/health")
def health():
    return {"status": "ok"}
