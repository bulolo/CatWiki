# Copyright 2026 CatWiki Authors
#
# Licensed under the CatWiki Open Source License (Modified Apache 2.0);
# you may not use this file except in compliance with the License.

"""AI provider 观测日志 —— usage signal、配置卡片、进度卡片。

也持有 ``rag_stats_var``：跨层级（RAGService → ChatService）汇总 RAG 检索
统计的 ContextVar，由 chat 流结束时统一打印 Pipeline Summary 卡片。
"""

import json
import logging
from contextvars import ContextVar
from typing import Any

# 用于跨层级收集 RAG 统计信息以便在回合结束时进行汇总打印
rag_stats_var: ContextVar[dict | None] = ContextVar("rag_stats", default=None)


def log_ai_config_card(section: str, config: dict[str, Any], title: str = "Active Config") -> None:
    """统一打印 AI 配置可视化卡片（多行 DEBUG）。"""
    from app.core.common.masking import mask_sensitive_data

    logger = logging.getLogger(f"app.core.ai.config.{section}")
    masked = mask_sensitive_data(config)

    model = masked.get("model", "N/A")
    provider = masked.get("provider", "N/A")
    extra_body = masked.get("extra_body")
    h = config.get("_hash", "N/A")

    try:
        pretty_json = json.dumps(masked, indent=4, ensure_ascii=False)
    except Exception:
        pretty_json = str(masked)

    log_msg = (
        f"\n{'=' * 60}\n"
        f"🔍 [{section.upper()}] -> {title}\n"
        f"   - 哈希指纹: {h}\n"
        f"   - 核心模型: {provider} | {model}\n"
        f"   - 扩展参数 (extra_body): "
        f"{json.dumps(extra_body, ensure_ascii=False) if extra_body else 'None'}\n"
        f"   - 配置快照:\n{pretty_json}\n"
        f"{'=' * 60}"
    )
    logger.debug(log_msg)


def log_ai_usage_signal(
    section: str,
    model: str,
    h: str,
    is_hit: bool = True,
    tenant_id: Any = None,
    extra: dict[str, Any] | None = None,
    purpose: str | None = None,
) -> None:
    """统一打印 AI 模型使用 / 复用信号。

    - ``is_hit=True`` 时输出单行（高频事件，cache hit 每次对话 3-6 次）
    - ``is_hit=False`` 时输出多行卡片（罕见的实例新建，值得详细记录）
    """
    logger = logging.getLogger(f"app.core.ai.usage.{section}")

    section_icons = {"chat": "💬", "embedding": "🧬", "rerank": "🎯"}
    icon = section_icons.get(section) or ("♻️ " if is_hit else "🚀")
    h_brief = h[:8] if h else "N/A"
    tenant_info = f" | tenant={tenant_id}" if tenant_id is not None else ""

    if is_hit:
        # 单行：icon section HIT | model | hash | tenant | purpose [| 关键运行参数]
        # 静态配置（Provider/Base URL/Source/Dimension/Fingerprint）省略——它们和 MISS 卡片重复
        runtime_extras = ""
        if extra:
            for key, value in extra.items():
                if key in {"Base URL", "Source", "Dimension", "Provider", "Fingerprint"}:
                    continue
                if value is not None and value != "":
                    runtime_extras += f" | {key}={value}"
        purpose_part = f" | purpose={purpose}" if purpose else ""
        logger.debug(
            f"{icon} {section} HIT | {model} | {h_brief}{tenant_info}{purpose_part}{runtime_extras}"
        )
        return

    # MISS（新建实例）：保留多行卡片，因为整个进程生命周期里这是稀有事件
    extra_lines = ""
    if extra:
        for key, value in extra.items():
            if value is not None and value != "":
                extra_lines += f"   - {key}: {value}\n"
    purpose_str = f"   - Purpose: {purpose}\n" if purpose else ""
    line = "-" * 80
    logger.debug(
        f"\n{line}\n"
        f"{icon} [{section.upper():9}] NEW LOAD (Initializing)\n"
        f"   - Model: {model}\n"
        f"{purpose_str}"
        f"   - Fingerprint: {h_brief}{tenant_info}\n"
        f"{extra_lines}"
        f"{line}"
    )


def log_process_step_card(
    section: str, title: str, step: int, total: int, details: str | None = None
) -> None:
    """打印过程/进度（如 Graph 迭代）。单行 DEBUG。"""
    logger = logging.getLogger(f"app.core.process.{section}")
    detail_part = f" — {details}" if details else ""
    logger.debug(f"🔄 [{section}] {title} {step}/{total}{detail_part}")
