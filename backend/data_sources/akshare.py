import logging
import pandas as pd
import akshare as ak
from backend.data_sources.base import BaseDataSource, PERIOD_MAP

logger = logging.getLogger(__name__)


class AkshareDataSource(BaseDataSource):
    name = "akshare"

    def search_stocks(self, keyword: str) -> list[dict]:
        kw = (keyword or "").strip()
        if not kw:
            return []
        try:
            df = ak.stock_info_a_code_name()
            if "名称" in df.columns:
                code_col, name_col = "代码", "名称"
            else:
                code_col, name_col = "code", "name"
            code_series = df[code_col].astype(str)
            name_series = df[name_col].astype(str)
            mask = (
                name_series.str.contains(kw, na=False, regex=False)
                | code_series.str.contains(kw, na=False, regex=False)
            )
            results = df[mask].head(20)
            return [
                {
                    "code": str(row[code_col]).zfill(6),
                    "name": str(row[name_col]),
                    "market": "A",
                }
                for _, row in results.iterrows()
            ]
        except Exception:
            logger.exception("akshare search_stocks failed for keyword=%r", kw)
            return []

    def get_kline(self, code: str, period: str, start_date: str, end_date: str) -> pd.DataFrame:
        try:
            freq = PERIOD_MAP.get(period, "daily")
            # akshare 要求 YYYYMMDD 格式，调用方传入的是 ISO YYYY-MM-DD
            ak_start = start_date.replace("-", "")
            ak_end = end_date.replace("-", "")
            df = ak.stock_zh_a_hist(symbol=code, period=freq, start_date=ak_start, end_date=ak_end, adjust="qfq")
            if df is None or df.empty:
                logger.warning("akshare get_kline empty for code=%s period=%s %s~%s", code, period, ak_start, ak_end)
                return pd.DataFrame(columns=["date", "open", "high", "low", "close", "volume"])
            df = df.rename(columns={
                "日期": "date", "开盘": "open", "最高": "high",
                "最低": "low", "收盘": "close", "成交量": "volume"
            })
            cols = ["date", "open", "high", "low", "close", "volume"]
            df["date"] = pd.to_datetime(df["date"]).dt.date
            return df[[c for c in cols if c in df.columns]]
        except Exception:
            logger.exception("akshare get_kline failed for code=%s period=%s", code, period)
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
        # 上证系列（含上证指数、科创50）与深证系列（含深证成指、创业板指）
        # 通过 stock_zh_index_spot_em 的不同 symbol 分别获取，再合并查找。
        major = [
            ("上证指数", "000001"),
            ("深证成指", "399001"),
            ("创业板指", "399006"),
            ("科创50", "000688"),
        ]
        frames: list[pd.DataFrame] = []
        for symbol in ("上证系列指数", "深证系列指数"):
            try:
                df = ak.stock_zh_index_spot_em(symbol=symbol)
                if df is not None and not df.empty:
                    frames.append(df)
            except Exception:
                logger.exception("akshare index spot fetch failed for symbol=%r", symbol)

        if not frames:
            return []

        merged = pd.concat(frames, ignore_index=True)
        if "名称" not in merged.columns:
            return []

        result: list[dict] = []
        for name, code in major:
            row = merged[merged["名称"] == name]
            if row.empty:
                continue
            r = row.iloc[0]
            try:
                result.append({
                    "name": name,
                    "code": code,
                    "price": float(r["最新价"]),
                    "change_pct": float(r["涨跌幅"]),
                })
            except (KeyError, ValueError, TypeError):
                logger.exception("akshare index row parse failed for %s", name)
        return result
