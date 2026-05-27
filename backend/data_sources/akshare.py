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
