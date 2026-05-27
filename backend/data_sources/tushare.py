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
