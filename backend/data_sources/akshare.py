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

    @staticmethod
    def _resample_ohlcv(daily_df: pd.DataFrame, rule: str) -> pd.DataFrame:
        """把日线 OHLCV resample 成周/月线"""
        if daily_df is None or daily_df.empty:
            return pd.DataFrame(columns=["date", "open", "high", "low", "close", "volume"])
        df = daily_df.copy()
        df["date"] = pd.to_datetime(df["date"])
        df = df.set_index("date").sort_index()
        agg = {"open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum"}
        out = df.resample(rule).agg(agg).dropna(subset=["close"]).reset_index()
        out["date"] = out["date"].dt.date
        return out[["date", "open", "high", "low", "close", "volume"]]

    def _get_kline_resampled_fallback(self, code: str, period: str, start_date: str, end_date: str) -> pd.DataFrame:
        """周/月线后备：拉日线后 resample"""
        rule = {"weekly": "W-FRI", "monthly": "MS"}.get(period)
        if rule is None:
            return pd.DataFrame(columns=["date", "open", "high", "low", "close", "volume"])
        daily = self._get_kline_daily_fallback(code, start_date, end_date)
        if daily.empty:
            return daily
        return self._resample_ohlcv(daily, rule)

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
                if period in ("weekly", "monthly"):
                    return self._get_kline_resampled_fallback(code, period, start_date, end_date)
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
            if period in ("weekly", "monthly"):
                return self._get_kline_resampled_fallback(code, period, start_date, end_date)
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

    def get_fundamentals(self, code: str) -> dict:
        """组合 stock_individual_info_em + stock_a_indicator_lg + 实时报价。"""
        result: dict = {
            "code": code,
            "name": "",
            "price": None,
            "change_pct": None,
            "pe": None,
            "pe_ttm": None,
            "pb": None,
            "ps_ttm": None,
            "dv_ttm": None,
            "total_market_cap": None,
            "float_market_cap": None,
            "total_shares": None,
            "float_shares": None,
            "industry": "",
            "listing_date": "",
            "as_of": None,
        }

        def _to_float(v) -> float | None:
            try:
                if v is None:
                    return None
                if isinstance(v, str) and not v.strip():
                    return None
                f = float(v)
                if pd.isna(f):
                    return None
                return f
            except (TypeError, ValueError):
                return None

        try:
            info_df = ak.stock_individual_info_em(symbol=code)
            if info_df is not None and not info_df.empty and {"item", "value"}.issubset(info_df.columns):
                kv = dict(zip(info_df["item"].astype(str), info_df["value"]))
                result["industry"] = str(kv.get("行业", "") or "")
                result["total_market_cap"] = _to_float(kv.get("总市值"))
                result["float_market_cap"] = _to_float(kv.get("流通市值"))
                result["total_shares"] = _to_float(kv.get("总股本"))
                result["float_shares"] = _to_float(kv.get("流通股"))
                listing = kv.get("上市时间")
                if listing is not None:
                    s = str(listing).strip()
                    if len(s) == 8 and s.isdigit():
                        result["listing_date"] = f"{s[0:4]}-{s[4:6]}-{s[6:8]}"
                    else:
                        result["listing_date"] = s
                name = kv.get("股票简称")
                if name:
                    result["name"] = str(name)
        except Exception:
            logger.exception("akshare stock_individual_info_em failed for code=%s", code)

        try:
            ind_df = ak.stock_a_indicator_lg(symbol=code)
            if ind_df is not None and not ind_df.empty:
                if "trade_date" in ind_df.columns:
                    ind_df = ind_df.sort_values("trade_date")
                last = ind_df.iloc[-1]
                result["pe"] = _to_float(last.get("pe"))
                result["pe_ttm"] = _to_float(last.get("pe_ttm"))
                result["pb"] = _to_float(last.get("pb"))
                result["ps_ttm"] = _to_float(last.get("ps_ttm"))
                result["dv_ttm"] = _to_float(last.get("dv_ttm"))
                if result["total_market_cap"] is None:
                    mv = _to_float(last.get("total_mv"))
                    if mv is not None:
                        result["total_market_cap"] = mv * 10000
                ts = last.get("trade_date")
                result["as_of"] = str(ts) if ts is not None else None
        except Exception:
            logger.exception("akshare stock_a_indicator_lg failed for code=%s", code)

        try:
            quote = self.get_realtime_quote(code)
            if quote:
                price = _to_float(quote.get("price"))
                if price is not None and price > 0:
                    result["price"] = price
                cp = _to_float(quote.get("change_pct"))
                if cp is not None:
                    result["change_pct"] = cp
                if not result["name"] and quote.get("name"):
                    result["name"] = quote["name"]
        except Exception:
            logger.exception("akshare get_realtime_quote (fundamentals) failed for code=%s", code)

        return result

    def get_index_data(self) -> list[dict]:
        # 东方财富实时 → Sina 实时 → 日线历史最后一条
        major = [
            ("上证指数", "000001", "sh000001"),
            ("深证成指", "399001", "sz399001"),
            ("创业板指", "399006", "sz399006"),
            ("科创50", "000688", "sh000688"),
        ]

        # 1) 东方财富实时
        frames: list[pd.DataFrame] = []
        for symbol in ("上证系列指数", "深证系列指数"):
            try:
                df = ak.stock_zh_index_spot_em(symbol=symbol)
                if df is not None and not df.empty:
                    frames.append(df)
            except Exception:
                logger.exception("akshare index spot (em) fetch failed for symbol=%r", symbol)

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

        # 2) Sina 实时（避免落到日线导致显示昨日收盘）
        try:
            sina = ak.stock_zh_index_spot_sina()
            if sina is not None and not sina.empty and "名称" in sina.columns:
                result = []
                for name, code, _ in major:
                    row = sina[sina["名称"] == name]
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
                        logger.exception("sina index row parse failed for %s", name)
                if result:
                    return result
        except Exception:
            logger.exception("akshare index spot (sina) fetch failed")

        # 3) 日线历史 — 最后兜底（开盘期间可能只有昨日数据）
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
