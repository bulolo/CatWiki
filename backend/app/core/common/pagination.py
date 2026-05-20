# Copyright 2026 CatWiki Authors
#
# Licensed under the CatWiki Open Source License (Modified Apache 2.0);
# you may not use this file except in compliance with the License.

"""通用分页器 —— 与 PaginationInfo schema 配对使用。"""

from typing import Any


class Paginator:
    """分页器。

    ``is_pager=0`` 表示禁用分页（一次性返回全部），此时 ``size`` 置为 ``None``，
    ``skip`` 恒为 0，``has_next`` / ``has_prev`` 恒为 False。
    """

    def __init__(self, page: int = 1, size: int = 10, total: int = 0, is_pager: int = 1):
        self.is_pager = is_pager
        if is_pager == 0:
            self.page = 1
            self.size = None
        else:
            self.page = max(1, page)
            self.size = max(1, size)
        self.total = max(0, total)

    @property
    def skip(self) -> int:
        """跳过的记录数。"""
        if self.is_pager == 0:
            return 0
        return (self.page - 1) * self.size

    @property
    def total_pages(self) -> int:
        """总页数。"""
        if self.is_pager == 0:
            return 1
        return (self.total + self.size - 1) // self.size if self.total > 0 else 0

    @property
    def has_next(self) -> bool:
        if self.is_pager == 0:
            return False
        return self.page < self.total_pages

    @property
    def has_prev(self) -> bool:
        if self.is_pager == 0:
            return False
        return self.page > 1

    def to_dict(self) -> dict[str, Any]:
        return {
            "page": self.page,
            "size": self.size if self.size is not None else self.total,
            "total": self.total,
            "total_pages": self.total_pages,
            "has_next": self.has_next,
            "has_prev": self.has_prev,
        }

    def to_pagination_info(self):
        """转换为 ``PaginationInfo`` 响应模型。"""
        from app.schemas.response import PaginationInfo

        if self.is_pager == 0:
            return PaginationInfo(is_pager=0, page=1, size=self.total, total=self.total)
        return PaginationInfo(
            is_pager=1,
            page=self.page,
            size=self.size,
            total=self.total,
        )
