from abc import ABC, abstractmethod
import pandas as pd


class BaseDataSource(ABC):
    name: str = "base"

    @abstractmethod
    def search_stocks(self, keyword: str) -> list[dict]:
        ...

    @abstractmethod
    def get_kline(self, code: str, period: str, start_date: str, end_date: str) -> pd.DataFrame:
        ...

    @abstractmethod
    def get_realtime_quote(self, code: str) -> dict:
        ...

    @abstractmethod
    def get_index_data(self) -> list[dict]:
        ...


PERIOD_MAP = {
    "daily": "daily",
    "weekly": "weekly",
    "monthly": "monthly",
    "60min": "60",
    "30min": "30",
    "15min": "15",
}
