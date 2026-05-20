# Copyright 2026 CatWiki Authors
#
# Licensed under the CatWiki Open Source License (Modified Apache 2.0);
# you may not use this file except in compliance with the License.

"""Masked-credential 恢复 helper —— AI / DocProcessor 配置共用。

Admin 在前端编辑配置时，已存的 API key 会以 ``****`` 占位符返回。提交时若
admin 未改动该字段，新 payload 里仍是 ``****``。本模块负责在持久化或连接
测试前把这些占位符替换回数据库里的真实值。
"""

from typing import Any

MASK_TOKEN = "****"


def is_masked(val: Any) -> bool:
    """``val`` 是字符串且包含掩码占位符则返回 True。"""
    return isinstance(val, str) and MASK_TOKEN in val


def merge_securely(new_dict: dict, old_dict: dict) -> None:
    """原地合并：把 ``new_dict`` 中被掩码 / 缺失的字段从 ``old_dict`` 恢复。

    规则：
    1. 补全：``old`` 有但 ``new`` 缺失的键，直接从 ``old`` 继承（防止偏序提交
       导致的数据丢失）。
    2. 还原：``new`` 是掩码且 ``old`` 是真实值，则回填 ``old``；若 ``old`` 也
       是空 / 掩码，则把该字段置空（说明该字段彻底失效）。
    3. 递归：嵌套 dict（如 ``extra_body``）继续往下合并。
    """
    for k, v in old_dict.items():
        if k not in new_dict:
            new_dict[k] = v
        elif is_masked(new_dict[k]):
            if not is_masked(v) and v:
                new_dict[k] = v
            else:
                new_dict[k] = ""
        elif isinstance(v, dict) and isinstance(new_dict.get(k), dict):
            merge_securely(new_dict[k], v)
