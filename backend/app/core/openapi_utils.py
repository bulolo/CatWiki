"""
OpenAPI 规范过滤和处理工具
"""
from functools import lru_cache

from fastapi import FastAPI


@lru_cache(maxsize=2)  # 只缓存 admin 和 client 两个规范
def filter_openapi_by_prefix(app: FastAPI, prefix: str) -> dict:
    """根据路径前缀过滤 OpenAPI 规范

    Args:
        app: FastAPI 应用实例
        prefix: 路径前缀，如 "/v1" 或 "/admin/v1"

    Returns:
        过滤后的 OpenAPI 规范字典
    """
    full_spec = app.openapi()

    # 过滤路径（避免深拷贝，直接构建新字典）
    filtered_paths = {
        path: methods
        for path, methods in full_spec.get('paths', {}).items()
        if path.startswith(prefix)
    }

    # 收集相关 tags
    relevant_tags = set()
    for path, methods in filtered_paths.items():
        for method, details in methods.items():
            if isinstance(details, dict) and 'tags' in details:
                relevant_tags.update(details['tags'])

    # 构建过滤后的规范（浅拷贝，避免深拷贝开销）
    filtered_spec = {
        'openapi': full_spec.get('openapi'),
        'info': full_spec.get('info', {}),
        'paths': filtered_paths,
        'components': full_spec.get('components', {}),
        'tags': [
            tag for tag in full_spec.get('tags', [])
            if tag.get('name') in relevant_tags
        ],
    }

    return filtered_spec
