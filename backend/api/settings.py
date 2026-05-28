"""AI 配置等通用设置 kv 读写。

设计：单条 AppSetting 行 key="ai_config"，value 为 JSON 字符串。
返回给前端时把 *_api_key 脱敏为 "****abcd"（仅显示末 4 位）；
写入时若收到的 *_api_key 为 "" 或脱敏占位符，则保留原值（避免误清空）。
"""
from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.models import AppSetting

router = APIRouter(prefix="/api/v1/settings", tags=["settings"])

AI_KEY = "ai_config"
SECRET_FIELDS = ("openai_api_key", "anthropic_api_key", "tavily_api_key")
DEFAULT_AI: dict[str, Any] = {
    "provider": "openai",
    "openai_base_url": "https://api.openai.com/v1",
    "openai_api_key": "",
    "openai_model": "gpt-4o-mini",
    "anthropic_api_key": "",
    "anthropic_model": "claude-sonnet-4-6",
    "search_provider": "none",
    "tavily_api_key": "",
}


def _load_raw() -> dict[str, Any]:
    db: Session = next(get_db())
    try:
        row = db.get(AppSetting, AI_KEY)
        if row is None or not row.value:
            return dict(DEFAULT_AI)
        try:
            cfg = json.loads(row.value)
        except Exception:
            cfg = {}
        merged = dict(DEFAULT_AI)
        merged.update({k: v for k, v in cfg.items() if v is not None})
        return merged
    finally:
        db.close()


def _mask(secret: str) -> str:
    if not secret:
        return ""
    if len(secret) <= 4:
        return "****"
    return "****" + secret[-4:]


def get_ai_settings_dict() -> dict[str, Any]:
    """供 summary router / scheduler 使用：返回明文 dict（含 api_key 原值）。"""
    return _load_raw()


class AiSettingsIn(BaseModel):
    provider: str
    openai_base_url: str | None = None
    openai_api_key: str | None = None
    openai_model: str | None = None
    anthropic_api_key: str | None = None
    anthropic_model: str | None = None
    search_provider: str | None = None
    tavily_api_key: str | None = None


@router.get("/ai")
def get_ai_settings():
    cfg = _load_raw()
    out = dict(cfg)
    for k in SECRET_FIELDS:
        out[k] = _mask(cfg.get(k) or "")
    return out


@router.put("/ai")
def put_ai_settings(payload: AiSettingsIn):
    if payload.provider not in ("openai", "anthropic"):
        raise HTTPException(status_code=400, detail="provider must be openai or anthropic")
    if payload.search_provider and payload.search_provider not in ("none", "tavily"):
        raise HTTPException(status_code=400, detail="search_provider must be none or tavily")
    current = _load_raw()
    incoming = payload.model_dump(exclude_none=True)
    for k in SECRET_FIELDS:
        v = incoming.get(k)
        if v is None:
            continue
        if v == "" or v.startswith("****"):
            incoming.pop(k)
    current.update(incoming)
    db: Session = next(get_db())
    try:
        row = db.get(AppSetting, AI_KEY)
        if row is None:
            row = AppSetting(key=AI_KEY, value=json.dumps(current, ensure_ascii=False))
            db.add(row)
        else:
            row.value = json.dumps(current, ensure_ascii=False)
        db.commit()
    finally:
        db.close()
    return get_ai_settings()
