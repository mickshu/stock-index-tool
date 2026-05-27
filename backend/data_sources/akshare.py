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

    @staticmethod
    def _exchange_prefix(code: str) -> str:
        """推断交易所前缀：60xxxx/68xxxx → sh，00xxxx/30xxxx → sz"""
        if code.startswith(("60", "68")):
            return "sh"
        return "sz"

    def _get_kline_daily_fallback(self, code: str, start_date: str, end_date: str) -> pd.DataFrame:
        """使用 stock_zh_a_daily 作为日线数据的后备接口"""
        symbol = f"{self._exchange_prefix(code)}{code}"
        try:
            df = ak.stock_zh_a_daily(symbol=symbol, start_date=start_date, end_date=end_date, adjust="qfq")
            if df is None or df.empty:
                return pd.DataFrame(columns=["date", "open", "high", "low", "close", "volume"])
            df = df.rename(columns={
                "成交量": "volume",
            })
            cols = ["date", "open", "high", "low", "close", "volume"]
            df["date"] = pd.to_datetime(df["date"]).dt.date
            return df[[c for c in cols if c in df.columns]]
        except Exception:
            logger.exception("akshare daily fallback failed for code=%s", code)
            return pd.DataFrame(columns=["date", "open", "high", "low", "close", "volume"])

    def get_kline(self, code: str, period: str, start_date: str, end_date: str) -> pd.DataFrame:
        try:
            freq = PERIOD_MAP.get(period, "daily")
            # akshare 要求 YYYYMMDD 格式，调用方传入的是 ISO YYYY-MM-DD
            ak_start = start_date.replace("-", "")
            ak_end = end_date.replace("-", "")
            df = ak.stock_zh_a_hist(symbol=code, period=freq, start_date=ak_start, end_date=ak_end, adjust="qfq")
            if df is None or df.empty:
                logger.warning("akshare get_kline empty for code=%s period=%s %s~%s", code, period, ak_start, ak_end)
                if period == "daily":
                    return self._get_kline_daily_fallback(code, start_date, end_date)
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
            if period == "daily":
                return self._get_kline_daily_fallback(code, start_date, end_date)
            return pd.DataFrame(columns=["date", "open", "high", "low", "close", "volume"])

    def get_realtime_quote(self, code: str) -> dict:
        try:
            df = ak.stock_zh_a_spot_em()
            row = df[df["代码"] == code]
            if row.empty:
                return self._fallback_quote(code)
            r = row.iloc[0]
            return {
                "code": code,
                "name": r["名称"],
                "price": float(r["最新价"]),
                "change_pct": float(r["涨跌幅"]),
            }
        except Exception:
            return self._fallback_quote(code)

    def _fallback_quote(self, code: str) -> dict:
        try:
            df = ak.stock_info_a_code_name()
            if "名称" in df.columns:
                code_col, name_col = "代码", "名称"
            else:
                code_col, name_col = "code", "name"
            code_series = df[code_col].astype(str).str.zfill(6)
            row = df[code_series == code]
            if row.empty:
                return {"code": code, "name": "", "price": 0, "change_pct": 0}
            return {
                "code": code,
                "name": str(row.iloc[0][name_col]),
                "price": 0,
                "change_pct": 0,
            }
        except Exception:
            logger.exception("Fallback quote lookup failed for %s", code)
            return {"code": code, "name": "", "price": 0, "change_pct": 0}

    def get_index_data(self) -> list[dict]:
        # 先尝试实时行情接口，失败则回退到日线历史最后一条
        major = [
            ("上证指数", "000001", "sh000001"),
            ("深证成指", "399001", "sz399001"),
            ("创业板指", "399006", "sz399006"),
            ("科创50", "000688", "sh000688"),
        ]
        frames: list[pd.DataFrame] = []
        for symbol in ("上证系列指数", "深证系列指数"):
            try:
                df = ak.stock_zh_index_spot_em(symbol=symbol)
                if df is not None and not df.empty:
                    frames.append(df)
            except Exception:
                logger.exception("akshare index spot fetch failed for symbol=%r", symbol)

        if frames:
            merged = pd.concat(frames, ignore_index=True)
            if "名称" in merged.columns:
                result: list[dict] = []
                for name, code, _ in major:
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
                if result:
                    return result

        # 实时行情失败 — 用日线历史作为后备
        result = []
        for name, code, daily_symbol in major:
            try:
                df = ak.stock_zh_index_daily(symbol=daily_symbol)
                if df is not None and not df.empty:
                    last = df.iloc[-1]
                    prev = df.iloc[-2] if len(df) > 1 else last
                    price = float(last["close"])
                    prev_close = float(prev["close"])
                    change_pct = (price - prev_close) / prev_close * 100 if prev_close != 0 else 0
                    result.append({
                        "name": name,
                        "code": code,
                        "price": price,
                        "change_pct": round(change_pct, 2),
                    })
            except Exception:
                logger.exception("akshare index daily fetch failed for %s", name)

        return result
