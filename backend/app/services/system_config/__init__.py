# Copyright 2026 CatWiki Authors
#
# Licensed under the CatWiki Open Source License (Modified Apache 2.0);
# you may not use this file except in compliance with the License.

"""system_config 子包 —— 平台 / 租户级系统配置服务。

外部调用方应只从本包顶层 import：

    from app.services.system_config import SystemConfigService, get_system_config_service

子模块结构：

| 文件 | 内容 |
|---|---|
| ``service``       | ``SystemConfigService`` —— DI 入口类（通过 mixin 组合）|
| ``ai_config``     | AI 模型配置（chat / embedding / rerank）+ 连通性测试 |
| ``doc_processor`` | 文档解析器配置（MinerU / Docling / 等）+ 连通性测试 |
| ``_secrets``      | 内部 helper：掩码识别与恢复（``is_masked`` / ``merge_securely``）|
"""

from app.services.system_config.service import SystemConfigService, get_system_config_service

__all__ = ["SystemConfigService", "get_system_config_service"]
