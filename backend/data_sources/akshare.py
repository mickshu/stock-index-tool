import logging
import time
import requests
import pandas as pd
import akshare as ak
from backend.data_sources.base import BaseDataSource, PERIOD_MAP

logger = logging.getLogger(__name__)


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

    def _get_em_spot_row(self, code: str) -> dict | None:
        """从 EastMoney 实时行情表中取出单只股票的整行（含 PE/PB/总市值等字段）。"""
        try:
            df = ak.stock_zh_a_spot_em()
            if df is None or df.empty or "代码" not in df.columns:
                return None
            row = df[df["代码"] == code]
            if row.empty:
                return None
            return row.iloc[0].to_dict()
        except Exception:
            logger.exception("EastMoney spot fetch failed for %s", code)
            return None

    def get_realtime_quote(self, code: str) -> dict:
        row = self._get_em_spot_row(code)
        if row is None:
            return self._fallback_quote(code)
        try:
            price = _to_float(row.get("最新价"))
            change_pct = _to_float(row.get("涨跌幅"))
            return {
                "code": code,
                "name": str(row.get("名称") or ""),
                "price": price if price is not None else 0,
                "change_pct": change_pct if change_pct is not None else 0,
            }
        except (TypeError, ValueError):
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

    def _fill_baidu_valuation(self, code: str, result: dict) -> None:
        """用百度股市通历史估值时间序列补齐 PE_TTM/PS_TTM/股息率/PB 的最新值。"""
        mapping = [
            ("pe_ttm", "市盈率(TTM)"),
            ("pb", "市净率"),
            ("ps_ttm", "市销率(TTM)"),
            ("dv_ttm", "股息率(TTM)"),
        ]
        for key, indicator in mapping:
            if result.get(key) is not None:
                continue
            try:
                df = ak.stock_zh_valuation_baidu(symbol=code, indicator=indicator, period="近一年")
                if df is None or df.empty or "value" not in df.columns:
                    continue
                if "date" in df.columns:
                    df = df.sort_values("date")
                v = _to_float(df["value"].iloc[-1])
                if v is not None:
                    result[key] = v
                    if not result.get("as_of") and "date" in df.columns:
                        result["as_of"] = str(df["date"].iloc[-1])
            except Exception:
                logger.exception("Baidu valuation fetch failed for %s %s", code, indicator)

    def get_fundamentals(self, code: str) -> dict:
        """合并多源行情/估值/股本数据：
        - 行业/股本/上市日期/市值：东方财富 stock_individual_info_em
        - PE/PB/PS/股息率：优先 stock_a_indicator_lg，缺则 EastMoney spot + Baidu 估值序列
        - 最新价/涨跌幅/PE动/PB/市值：EastMoney spot
        """
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
                if ts is not None:
                    result["as_of"] = str(ts)
        except Exception:
            logger.exception("akshare stock_a_indicator_lg failed for code=%s", code)

        # EastMoney 实时行情：补价格/涨跌幅，并兜底 PE(动)/PB/市值
        spot = self._get_em_spot_row(code)
        if spot:
            if not result["name"]:
                n = spot.get("名称")
                if n:
                    result["name"] = str(n)
            price = _to_float(spot.get("最新价"))
            if price is not None and price > 0 and result["price"] is None:
                result["price"] = price
            cp = _to_float(spot.get("涨跌幅"))
            if cp is not None and result["change_pct"] is None:
                result["change_pct"] = cp
            if result["pe"] is None:
                result["pe"] = _to_float(spot.get("市盈率-动态"))
            if result["pb"] is None:
                result["pb"] = _to_float(spot.get("市净率"))
            if result["total_market_cap"] is None:
                result["total_market_cap"] = _to_float(spot.get("总市值"))
            if result["float_market_cap"] is None:
                result["float_market_cap"] = _to_float(spot.get("流通市值"))

        # 百度估值时间序列：补 PE_TTM/PS_TTM/股息率(TTM)（仅在缺失时调用）
        if any(result.get(k) is None for k in ("pe_ttm", "ps_ttm", "dv_ttm", "pb")):
            self._fill_baidu_valuation(code, result)

        return result

    # 指数行情内存缓存：避免每次请求都打外网；TTL 默认 15 秒，足以覆盖刷新洪峰
    _INDEX_CACHE: dict = {"ts": 0.0, "data": []}
    _INDEX_CACHE_TTL = 15.0

    _INDEX_TARGETS = [
        # (secid, 显示名称, 6 位代码, akshare 日线 symbol)
        ("1.000001", "上证指数", "000001", "sh000001"),
        ("0.399001", "深证成指", "399001", "sz399001"),
        ("0.399006", "创业板指", "399006", "sz399006"),
        ("1.000688", "科创50", "000688", "sh000688"),
    ]

    def _eastmoney_indices_batch(self) -> list[dict]:
        """一次 HTTP 拉取 4 个主要指数的实时行情（push2 批量接口）。"""
        secids = ",".join(t[0] for t in self._INDEX_TARGETS)
        try:
            resp = requests.get(
                "https://push2.eastmoney.com/api/qt/ulist.np/get",
                params={
                    "secids": secids,
                    "fields": "f2,f3,f12,f13,f14",
                    "fltt": "2",  # 返回已按精度处理过的浮点数
                    "invt": "2",
                },
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
                    ),
                    "Referer": "https://quote.eastmoney.com/",
                },
                timeout=4,
            )
            resp.raise_for_status()
            payload = resp.json() or {}
        except Exception:
            logger.exception("EastMoney push2 index batch fetch failed")
            return []

        data = payload.get("data") or {}
        diff = data.get("diff") or []
        if isinstance(diff, dict):  # 偶发返回 {"0": {...}}
            diff = list(diff.values())

        by_secid: dict[str, dict] = {}
        for item in diff:
            if not isinstance(item, dict):
                continue
            market = item.get("f13")
            code = item.get("f12")
            if market is None or code is None:
                continue
            by_secid[f"{market}.{code}"] = item

        result: list[dict] = []
        for secid, name, code, _ in self._INDEX_TARGETS:
            item = by_secid.get(secid)
            if not item:
                continue
            price = _to_float(item.get("f2"))
            change_pct = _to_float(item.get("f3"))
            if price is None or price <= 0:
                continue
            result.append({
                "name": name,
                "code": code,
                "price": price,
                "change_pct": change_pct if change_pct is not None else 0.0,
            })
        return result

    def get_index_data(self) -> list[dict]:
        """指数实时行情：EastMoney 直连 → Sina 兜底 → 日线兜底；带 15s 内存缓存。"""
        now = time.monotonic()
        if (
            self._INDEX_CACHE["data"]
            and now - self._INDEX_CACHE["ts"] < self._INDEX_CACHE_TTL
        ):
            return list(self._INDEX_CACHE["data"])

        # 1) EastMoney 批量直连（最快）
        result = self._eastmoney_indices_batch()
        if result:
            self._INDEX_CACHE.update({"ts": now, "data": result})
            return result

        # 2) Sina 实时兜底
        try:
            sina = ak.stock_zh_index_spot_sina()
            if sina is not None and not sina.empty and "名称" in sina.columns:
                fallback: list[dict] = []
                for _secid, name, code, _ in self._INDEX_TARGETS:
                    row = sina[sina["名称"] == name]
                    if row.empty:
                        continue
                    r = row.iloc[0]
                    price = _to_float(r.get("最新价"))
                    cp = _to_float(r.get("涨跌幅"))
                    if price is None:
                        continue
                    fallback.append({
                        "name": name,
                        "code": code,
                        "price": price,
                        "change_pct": cp if cp is not None else 0.0,
                    })
                if fallback:
                    self._INDEX_CACHE.update({"ts": now, "data": fallback})
                    return fallback
        except Exception:
            logger.exception("Sina index spot fetch failed")

        # 3) 日线历史（最后兜底，可能是昨日收盘）
        daily_result: list[dict] = []
        for _secid, name, code, daily_symbol in self._INDEX_TARGETS:
            try:
                df = ak.stock_zh_index_daily(symbol=daily_symbol)
                if df is None or df.empty:
                    continue
                last = df.iloc[-1]
                prev = df.iloc[-2] if len(df) > 1 else last
                price = float(last["close"])
                prev_close = float(prev["close"])
                change_pct = (price - prev_close) / prev_close * 100 if prev_close != 0 else 0
                daily_result.append({
                    "name": name,
                    "code": code,
                    "price": price,
                    "change_pct": round(change_pct, 2),
                })
            except Exception:
                logger.exception("akshare index daily fetch failed for %s", name)

        if daily_result:
            self._INDEX_CACHE.update({"ts": now, "data": daily_result})
        return daily_result
