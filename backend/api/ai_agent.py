"""本地 AI Agent CLI 接口：探测可用 CLI + 触发分析。"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.services.ai_agent import (
    DEFAULT_TIMEOUT,
    build_prompt,
    detect_agents,
    run_agent,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/ai-agent", tags=["ai-agent"])


class AnalyzeRequest(BaseModel):
    agent: str = Field(..., description="CLI 名称，必须在 probe 返回列表里")
    code: str = Field(..., description="股票代码")
    name: str | None = Field(None, description="股票名称（可选）")
    dimension: str = Field("综合", description="用户填写的分析维度")
    timeout: int = Field(DEFAULT_TIMEOUT, ge=10, le=600)


@router.get("/probe")
def probe():
    return {"agents": detect_agents()}


@router.post("/analyze")
def analyze(req: AnalyzeRequest):
    prompt = build_prompt(req.code, req.name or "", req.dimension)
    try:
        result = run_agent(req.agent, prompt, timeout=req.timeout)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        logger.exception("ai-agent analyze failed: agent=%s code=%s", req.agent, req.code)
        raise HTTPException(status_code=500, detail="AI Agent 调用失败")
    return {
        "agent": result["agent"],
        "ok": result["ok"],
        "exit_code": result["exit_code"],
        "duration": round(result["duration"], 2),
        "output": result["output"],
        "stderr": result["stderr"] if not result["ok"] else "",
        "prompt": prompt,
    }
