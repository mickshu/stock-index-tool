import pandas as pd


def detect_cross(df: pd.DataFrame, col_a: str, col_b: str) -> pd.Series:
    """1 when col_a crosses above col_b on that row, -1 when crosses below, else 0."""
    above = df[col_a] > df[col_b]
    above_prev = df[col_a].shift(1) > df[col_b].shift(1)
    cross_up = above & ~above_prev
    cross_down = ~above & above_prev
    result = pd.Series(0, index=df.index)
    result[cross_up] = 1
    result[cross_down] = -1
    return result


class SignalEngine:
    """Detects trading signals from indicator-enriched DataFrame."""

    SIGNAL_DEFS = [
        {"type": "golden_cross", "indicator": "MACD", "description": "MACD金叉：DIF上穿DEA",
         "columns": ["MACD_DIF", "MACD_DEA"], "detector": "cross_up"},
        {"type": "death_cross", "indicator": "MACD", "description": "MACD死叉：DIF下穿DEA",
         "columns": ["MACD_DIF", "MACD_DEA"], "detector": "cross_down"},
        {"type": "golden_cross", "indicator": "MA", "description": "MA金叉：MA5上穿MA10",
         "columns": ["MA5", "MA10"], "detector": "cross_up"},
        {"type": "death_cross", "indicator": "MA", "description": "MA死叉：MA5下穿MA10",
         "columns": ["MA5", "MA10"], "detector": "cross_down"},
        {"type": "golden_cross", "indicator": "MA", "description": "MA金叉：MA5上穿MA20",
         "columns": ["MA5", "MA20"], "detector": "cross_up"},
        {"type": "death_cross", "indicator": "MA", "description": "MA死叉：MA5下穿MA20",
         "columns": ["MA5", "MA20"], "detector": "cross_down"},
        {"type": "golden_cross", "indicator": "MA", "description": "MA金叉：MA10上穿MA20",
         "columns": ["MA10", "MA20"], "detector": "cross_up"},
        {"type": "death_cross", "indicator": "MA", "description": "MA死叉：MA10下穿MA20",
         "columns": ["MA10", "MA20"], "detector": "cross_down"},
        {"type": "golden_cross", "indicator": "KDJ", "description": "KDJ金叉：K上穿D",
         "columns": ["KDJ_K", "KDJ_D"], "detector": "cross_up"},
        {"type": "death_cross", "indicator": "KDJ", "description": "KDJ死叉：K下穿D",
         "columns": ["KDJ_K", "KDJ_D"], "detector": "cross_down"},
        {"type": "oversold", "indicator": "KDJ", "description": "KDJ超卖：J值低于0",
         "columns": ["KDJ_J"], "detector": "below_zero"},
        {"type": "overbought", "indicator": "KDJ", "description": "KDJ超买：J值高于100",
         "columns": ["KDJ_J"], "detector": "above_100"},
        {"type": "oversold", "indicator": "RSI", "description": "RSI超卖：RSI6低于30",
         "columns": ["RSI6"], "detector": "rsi_oversold"},
        {"type": "overbought", "indicator": "RSI", "description": "RSI超买：RSI6高于70",
         "columns": ["RSI6"], "detector": "rsi_overbought"},
    ]

    def detect(self, df: pd.DataFrame) -> list[dict]:
        signals: list[dict] = []
        for sig_def in self.SIGNAL_DEFS:
            cols = sig_def["columns"]
            if len(cols) == 2 and cols[0] in df.columns and cols[1] in df.columns:
                crosses = detect_cross(df, cols[0], cols[1])
                want_up = sig_def["detector"] == "cross_up"
                for i in range(len(crosses)):
                    val = crosses.iloc[i]
                    if (want_up and val == 1) or (not want_up and val == -1):
                        signals.append({
                            "type": sig_def["type"],
                            "indicator": sig_def["indicator"],
                            "description": sig_def["description"],
                            "date": str(df["date"].iloc[i]),
                            "position": i,
                        })
            elif len(cols) == 1 and cols[0] in df.columns:
                col = cols[0]
                detector = sig_def["detector"]
                for i in range(len(df)):
                    val = df[col].iloc[i]
                    if pd.isna(val):
                        continue
                    triggered = (
                        (detector == "below_zero" and val < 0)
                        or (detector == "above_100" and val > 100)
                        or (detector == "rsi_oversold" and val < 30)
                        or (detector == "rsi_overbought" and val > 70)
                    )
                    if triggered:
                        signals.append({
                            "type": sig_def["type"],
                            "indicator": sig_def["indicator"],
                            "description": sig_def["description"],
                            "date": str(df["date"].iloc[i]),
                            "position": i,
                        })
        return signals
