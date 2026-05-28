"""本地 AI CLI 探测与调用服务。

通过 subprocess 非交互式调用 Claude Code / Codex / Gemini / Hermes 等本地
AI Agent CLI，把股票上下文 + 用户填写的「分析维度」拼成 prompt 喂进去，
让 CLI 自带的工具与知识完成分析，再把 stdout 原样返回前端渲染。

设计上保持 CLI 中立：白名单里只声明 `argv` 模板和版本探测命令，新加 CLI
只需在 AGENTS 列表里加一条即可。
"""

from __future__ import annotations

import logging
import os
import shutil
import subprocess
import time
from dataclasses import dataclass
from typing import Sequence

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT = 180  # 秒
MAX_OUTPUT_CHARS = 64_000


@dataclass(frozen=True)
class AgentSpec:
    name: str           # 唯一 key，前端透传
    label: str          # 展示名
    binary: str         # 可执行文件名（用于 shutil.which）
    prompt_argv: Sequence[str]  # prompt 拼接前的参数模板，最后一项之后追加 prompt 字符串
    version_argv: Sequence[str] = ("--version",)


AGENTS: list[AgentSpec] = [
    AgentSpec(
        name="claude",
        label="Claude Code",
        binary="claude",
        prompt_argv=("claude", "-p"),
    ),
    AgentSpec(
        name="codex",
        label="Codex CLI",
        binary="codex",
        prompt_argv=("codex", "exec"),
    ),
    AgentSpec(
        name="gemini",
        label="Gemini CLI",
        binary="gemini",
        prompt_argv=("gemini", "-p"),
    ),
    AgentSpec(
        name="hermes",
        label="Hermes",
        binary="hermes",
        # Hermes 的实际非交互参数后续按需调整；占位先按 -p。
        prompt_argv=("hermes", "-p"),
    ),
]


def _resolve_binary(spec: AgentSpec) -> str | None:
    return shutil.which(spec.binary)


def _probe_version(path: str, version_argv: Sequence[str]) -> str:
    try:
        out = subprocess.run(
            [path, *version_argv],
            capture_output=True,
            text=True,
            timeout=8,
        )
        text = (out.stdout or out.stderr or "").strip().splitlines()
        return text[0] if text else ""
    except Exception:
        return ""


def detect_agents() -> list[dict]:
    """返回当前可用的 CLI 列表（按 AGENTS 顺序）。"""
    result: list[dict] = []
    for spec in AGENTS:
        path = _resolve_binary(spec)
        if not path:
            continue
        result.append({
            "name": spec.name,
            "label": spec.label,
            "binary": spec.binary,
            "path": path,
            "version": _probe_version(path, spec.version_argv),
        })
    return result


def get_agent(name: str) -> AgentSpec | None:
    for spec in AGENTS:
        if spec.name == name:
            return spec
    return None


def build_prompt(code: str, stock_name: str, dimension: str) -> str:
    """把用户填写的维度拼成中文分析指令。"""
    name_part = f"{code} {stock_name}".strip() if stock_name else code
    dim = (dimension or "综合").strip()
    return (
        f"你是 A 股投研助手。请针对以下股票给出客观的「{dim}」维度分析，"
        f"用中文 markdown 输出，控制在 600 字以内，必要时附信息来源链接：\n\n"
        f"- 股票：{name_part}\n"
        f"- 分析维度：{dim}\n\n"
        f"如果你具备联网或数据查询能力，请主动获取最近的行情、公告、研报与资金面信息。"
        f"输出请包含：核心结论、关键证据、潜在风险、可关注信号；"
        f"避免提供具体买卖建议。"
    )


def run_agent(
    name: str,
    prompt: str,
    timeout: int = DEFAULT_TIMEOUT,
) -> dict:
    """以非交互模式运行指定 CLI，返回 {ok, agent, output, stderr, duration, exit_code}。

    抛出 ValueError 表示 agent 不在白名单或未安装。
    """
    spec = get_agent(name)
    if spec is None:
        raise ValueError(f"unknown agent: {name}")
    path = _resolve_binary(spec)
    if not path:
        raise ValueError(f"agent not installed: {name}")

    argv = [path, *list(spec.prompt_argv)[1:], prompt]
    started = time.monotonic()
    env = os.environ.copy()
    env.setdefault("NO_COLOR", "1")
    env.setdefault("TERM", "dumb")

    try:
        proc = subprocess.run(
            argv,
            capture_output=True,
            text=True,
            timeout=timeout,
            env=env,
            cwd=os.path.expanduser("~"),
        )
    except subprocess.TimeoutExpired as e:
        return {
            "ok": False,
            "agent": name,
            "output": (e.stdout or "") if isinstance(e.stdout, str) else "",
            "stderr": f"调用超时（>{timeout}s）",
            "duration": time.monotonic() - started,
            "exit_code": None,
        }
    except FileNotFoundError:
        raise ValueError(f"agent binary missing: {spec.binary}")

    output = (proc.stdout or "")
    if len(output) > MAX_OUTPUT_CHARS:
        output = output[:MAX_OUTPUT_CHARS] + "\n\n…[输出截断]"
    return {
        "ok": proc.returncode == 0,
        "agent": name,
        "output": output,
        "stderr": (proc.stderr or "")[-2000:],
        "duration": time.monotonic() - started,
        "exit_code": proc.returncode,
    }
