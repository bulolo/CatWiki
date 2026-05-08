# 向量数据库对接架构

## 概览

CatWiki 的向量存储层采用 **Template Method + Abstract Factory** 双模式设计：

- `BaseVectorStoreManager`（抽象基类）统一管理 Embedding 生命周期与公共契约，驱动只需实现 Hook 和操作方法。
- `factory.py` 根据 `VECTOR_STORE_TYPE` 环境变量在运行时决定使用哪个驱动，对上层完全透明。
- 目前支持两个驱动：**PostgreSQL（pgvector）** 和 **Elasticsearch**。

---

## 目录结构

```
backend/app/core/vector/
├── __init__.py             # 对外入口，暴露 VectorStoreManager
├── factory.py              # 工厂：单例创建与生命周期管理
├── base.py                 # 抽象基类：公共类型、Embedding 缓存、DCL、用量信号
├── postgres_store.py       # PostgreSQL 驱动（langchain-postgres / pgvector）
└── elasticsearch_store.py  # Elasticsearch 驱动（直调 AsyncElasticsearch API）

backend/app/core/ai/
└── message_utils.py        # LangChain 消息工具函数（格式转换、引用提取）
```

---

## 层次架构

```
调用方（document_service / rag_service / crud / lifecycle）
        │
        ▼
VectorStoreManager.get_instance()          ← __init__.py（公共入口）
        │
        ▼
get_vector_store()                         ← factory.py（单例工厂，DCL）
        │
        ├─ VECTOR_STORE_TYPE=postgres  ──▶ PostgresVectorStoreManager
        └─ VECTOR_STORE_TYPE=elasticsearch ▶ ElasticsearchVectorStoreManager
                │
                ▼
        BaseVectorStoreManager（ABC）
        │
        ├── 公共常量 / 类型
        │   ├── ALLOWED_VECTOR_FILTER_KEYS   ← 元数据过滤字段白名单（所有驱动共用）
        │   ├── VectorChunk                  ← get_chunks_by_metadata 返回类型
        │   └── VectorSearchResult           ← search 返回类型
        │
        ├── 公共方法（驱动无需覆盖）
        │   ├── _get_embeddings()            ← 统一 Embedding 解析（Double-check locking）
        │   ├── _build_embeddings()          ← 创建 OpenAICompatibleEmbeddings，调用 Hook
        │   ├── reload_credentials()         ← 热更新（force=True 重走初始化）
        │   ├── validate_config()            ← 读取并校验租户 embedding 配置
        │   ├── _emit_usage()               ← 发送 AI 用量信号（缓存命中/未命中）
        │   ├── _clear_cache()              ← close() 辅助，清空 embedding 缓存
        │   ├── last_resolved_model         ← 当前任务最后解析的 embedding 模型名（ContextVar）
        │   └── last_resolved_hash          ← 当前任务最后解析的配置哈希（ContextVar）
        │
        └── 抽象方法（驱动必须实现）
            ├── _ensure_backend()             ← 纯连接就绪，不依赖 embedding 配置
            ├── _on_embedding_config_changed() ← Schema 初始化 Hook（已持锁）
            ├── supports_score_threshold     ← score 是否可与绝对阈值比较
            ├── ping()                       ← 后端连通性探测
            ├── add_documents()
            ├── delete_documents()
            ├── delete_by_metadata()
            ├── get_chunks_by_metadata()
            ├── close()
            └── search()
```

---

## 公共类型与常量（base.py）

所有驱动共享以下定义，接入新引擎直接 import 使用，无需重复声明：

### `ALLOWED_VECTOR_FILTER_KEYS`

```python
ALLOWED_VECTOR_FILTER_KEYS: frozenset[str] = frozenset(
    ["source", "id", "site_id", "collection_id", "tenant_id", "chunk_index"]
)
```

所有驱动的过滤 key 白名单均引用此常量。非法 key 在各驱动的过滤构建方法中 `raise ValueError`，防止任意字符串注入 SQL 或 ES DSL。

### `VectorChunk`

```python
class VectorChunk(TypedDict):
    id: str
    content: str
    metadata: dict
```

`get_chunks_by_metadata()` 的返回元素类型。

### `VectorSearchResult`

```python
class VectorSearchResult(TypedDict):
    doc: LangChainDocument
    score: float
```

`search()` 的返回元素类型。`score` 的语义由 `supports_score_threshold` 决定（见下文）。

---

## Embedding 生命周期（Double-check Locking）

所有驱动共用基类同一套 Embedding 解析逻辑，保证：

1. **首次访问**：加锁 → 创建 `OpenAICompatibleEmbeddings` → 调用驱动 Hook 完成 Schema 初始化 → 写入缓存
2. **后续访问**：缓存命中直接返回，不加锁，零额外开销
3. **配置热更新**（`reload_credentials`）：`force=True` 跳过缓存，强制重走初始化流程。此方法已在基类提供具体实现，驱动无需覆盖
4. **多配置共存**：缓存 key 为 `embedding_conf["_hash"]`，切换 embedding 模型时新旧实例并存，互不干扰

```python
# base.py 核心逻辑（简化）
async def _get_embeddings(self, tenant_id=None, force=False, purpose=None):
    tenant_id, embedding_conf = await self.validate_config(tenant_id)
    conf_hash = embedding_conf["_hash"]

    if not force and conf_hash in self._embeddings_cache:   # 快路径（无锁）
        return self._embeddings_cache[conf_hash], model, conf_hash

    async with self._lock:                                  # 慢路径（持锁）
        if not force and conf_hash in self._embeddings_cache:  # double-check
            return ...
        return await self._build_embeddings(...)            # 初始化并缓存
```

`asyncio.Lock` 和 `_context_metadata: ContextVar` 均在每个驱动实例的 `__init__` 中通过 `super().__init__()` 创建（非类变量），确保绑定到正确的 event loop，并在 asyncio 任务之间安全隔离模型溯源信息。

---

## 两级初始化模式

驱动的初始化分为两个独立层次，各司其职：

| 层次 | 方法 | 触发条件 | 依赖 |
|------|------|---------|------|
| 客户端就绪 | `_ensure_backend()` | delete / get 操作首次调用 | 只需连接配置（settings） |
| Schema 就绪 | `_on_embedding_config_changed()` | add / search 操作首次调用 | 需要 embedding 配置（维度）|

这一设计使"删除/查询"操作在 embedding 配置尚未设置时（如租户刚创建）仍能正常执行，不会因 `validate_config` 失败而级联中断。

### `_ensure_backend()`（抽象）

驱动实现要求：
- 仅初始化后端连接（SA 引擎 / ES 客户端）
- 使用 `self._lock` 做 Double-check locking，保证并发安全
- 不执行任何 Schema 操作

```python
async def _ensure_backend(self) -> None:
    if self._client is not None:
        return
    async with self._lock:
        if self._client is None:
            self._client = self._init_client()
```

### `_on_embedding_config_changed()`（抽象）

在 `_get_embeddings()` 持锁时调用，驱动负责：
1. 初始化后端客户端（若尚未完成）
2. 确保 Schema / 索引与 `embedding_conf['dimension']` 匹配
3. 将任何 per-config 状态以 `embedding_conf['_hash']` 为 key 缓存

| 职责 | PostgreSQL | Elasticsearch |
|------|-----------|---------------|
| 初始化后端客户端 | `create_async_engine` + `PGEngine` | `AsyncElasticsearch` |
| Schema 确保 | `_ensure_table` → `_ensure_columns` → `_ensure_indexes` | `_ensure_index` |
| 维度一致性校验 | `_check_database_dimension` | `_check_index_dimension` |
| 就绪检测 | — | `_wait_for_shards`（等待 primary shard yellow）|
| 缓存后端实例 | `self._stores[conf_hash] = PGVectorStore` | 无需（直接用 `_es_client`）|

---

## 依赖注入（可测试性）

两个驱动均支持通过构造函数注入后端客户端，生产时留 `None` 由 settings 自动创建：

```python
# 生产（factory.py 调用）
PostgresVectorStoreManager()
ElasticsearchVectorStoreManager()

# 测试（传入 mock/test 实例，绕过真实数据库）
PostgresVectorStoreManager(sa_engine=test_engine)
ElasticsearchVectorStoreManager(es_client=mock_client)
```

---

## PostgreSQL 驱动详解

**依赖**：`langchain-postgres`（`PGVectorStore`、`PGEngine`）、`asyncpg`

### 表结构

单表 `catwiki_documents`，通过列过滤实现逻辑隔离：

| 列名 | 类型 | 用途 |
|------|------|------|
| `langchain_id` | UUID | chunk 主键 |
| `content` | TEXT | 原始文本 |
| `embedding` | `vector(N)` | 向量（pgvector） |
| `langchain_metadata` | JSONB | 通用元数据（兜底存储）|
| `source` | TEXT | 优化列（独立 B-tree 索引）|
| `id` | TEXT | document id（优化列）|
| `site_id` | INTEGER | 站点隔离（优化列）|
| `collection_id` | INTEGER | 目录隔离（优化列）|
| `tenant_id` | INTEGER | 租户隔离（优化列）|

优化列（`OPTIMIZED_COLUMN_NAMES`）以独立列存储，过滤效率高于 JSONB 路径查询。`_get_metadata_where_clause()` 根据 key 是否在优化列中，自动选择列过滤或 `langchain_metadata->>'{key}'` JSONB 路径。

### Schema 自动维护

每次 embedding 配置变更时依次执行（幂等）：

1. **`_ensure_table`**：表不存在则建表（`ainit_vectorstore_table`）
2. **`_check_database_dimension`**：校验 `pg_attribute` 中 `vector(N)` 的 N 与配置一致，不一致则 CRITICAL 并阻止启动
3. **`_ensure_columns`**：检测 `collection_id`、`tenant_id` 等列是否存在，缺失则 `ALTER TABLE ADD COLUMN`（支持存量数据库平滑迁移）
4. **`_ensure_indexes`**：为 `id`、`site_id`、`collection_id`、`tenant_id` 创建 B-tree 索引

所有 `information_schema` / `pg_indexes` 查询均加 `table_schema = 'public'` 过滤，避免多 Schema 环境误匹配。

### 文档操作

- **`add_documents`**：通过 `PGVectorStore.aadd_documents` 分批写入，embedding 由 langchain-postgres 内部调用
- **`delete_documents`**：原生 SQL `DELETE FROM ... WHERE langchain_id::text = ANY(:ids)`，不经过 PGVectorStore（与 embedding 解耦）
- **`delete_by_metadata` / `get_chunks_by_metadata`**：原生 SQL，只需 SA 引擎，不依赖 embedding 配置

### 搜索

使用 `PGVectorStore.asimilarity_search_with_score`，返回 `(document, cosine_distance)`。

`score = 1.0 - cosine_distance`，值域 `[0, 1]`，`supports_score_threshold = True`，可与 `RAG_RECALL_THRESHOLD` 直接比较。

### SQL 注入防御

- **key 白名单**：`_ALLOWED_METADATA_KEYS = ALLOWED_VECTOR_FILTER_KEYS`（引用 base 常量），非法 key 直接 `raise ValueError`
- **值参数化**：所有 SQL 值通过 `:param` 绑定，不拼接字符串
- **Schema 过滤**：`information_schema.tables`、`information_schema.columns`、`pg_indexes` 均加 `table_schema / schemaname = 'public'`

---

## Elasticsearch 驱动详解

**依赖**：`elasticsearch-py`（`AsyncElasticsearch`）直调，不经过 langchain vectorstore 封装

### 索引结构

单索引 `catwiki_documents`，通过 `metadata.tenant_id` 实现逻辑隔离。

| 字段 | 类型 | 说明 |
|------|------|------|
| `text` | `text`（IK 双分词：`ik_max_word` 写入 / `ik_smart` 搜索）| 原始文本，支持 BM25 全文检索 |
| `vector` | `dense_vector(N, cosine)` | 向量字段 |
| `chunk_index` | `integer` | **顶层字段**，支持数值排序 |
| `metadata` | `flattened` | 所有元数据，叶子值以 keyword string 存储 |

**`chunk_index` 必须提升为顶层字段**：`flattened` 类型内部不支持数值排序。

**`flattened` 类型约束**：`_build_es_filter()` 对 `metadata.*` 的所有值统一 `str()` 转换，否则 term 匹配失败。`chunk_index` 作为顶层 integer 字段，保留原始数值类型。

### 过滤 key 白名单

`_build_es_filter()` 在构建 DSL 前校验所有 key：

```python
_ALLOWED_FILTER_KEYS = ALLOWED_VECTOR_FILTER_KEYS  # 引用 base 常量

def _build_es_filter(self, criteria: dict) -> list[dict]:
    for k in criteria:
        if k not in _ALLOWED_FILTER_KEYS:
            raise ValueError(f"不允许的过滤 key: {k!r}")
    ...
```

### 搜索策略：Python-level RRF

ES 服务端 RRF / Linear Retriever 均需 Platinum License，Basic License 不可用。驱动在 Python 侧实现：

```
1. 并行执行 KNN 查询（向量检索）和 BM25 查询（全文检索），各取 fetch_k = min(k×3, 100) 条
2. Python 侧 RRF 合并：score(doc) = Σ 1 / (60 + rank + 1)
3. 取 top-k 返回，score 统一为哨兵值 1.0
```

`score` 无绝对语义，`supports_score_threshold = False`，上层不得用于阈值过滤。

### 可靠性机制

**503 重试**：`delete_documents` / `delete_by_metadata` 通过 `_retry_on_503` 包装，对 shard 未就绪（HTTP 503）最多重试 3 次，退避间隔 5s / 10s / 15s。

**bulk 错误检测**：`add_documents` 和 `delete_documents` 均显式检查 bulk 响应：

```python
if resp.get("errors"):
    raise RuntimeError(f"ES bulk 操作部分失败 ({len(failed)} 条): {failed[:3]}")
```

`result: "not_found"` 不触发（ES 不将其标记为 error）。

**Shard 就绪等待**：首次初始化时调用 `_wait_for_shards()`，等待 primary shard 达到 yellow 状态，防止 ES 刚启动时写入失败。

---

## `supports_score_threshold` 属性

控制 RAG 服务是否对 score 做阈值过滤，屏蔽了上层对引擎类型的感知：

| 驱动 | 值 | score 语义 |
|------|-----|-----------|
| PostgreSQL | `True` | 余弦相似度，值域 `[0, 1]`，可与 `RAG_RECALL_THRESHOLD` 比较 |
| Elasticsearch | `False` | RRF 哨兵值 `1.0`，无绝对意义，跳过阈值过滤 |

RAG 服务通过该属性决策，不做引擎类型字符串判断：

```python
use_score_threshold = vector_store.supports_score_threshold
```

---

## 工厂与单例

`factory.py` 维护全局单例 `_store_instance`，模块级 `asyncio.Lock`（Python 3.10+ 无事件循环绑定问题）防并发重复创建：

```python
VECTOR_STORE_TYPE=postgres        # 默认
VECTOR_STORE_TYPE=elasticsearch
```

- 应用启动：`lifecycle/manager.py` 调用 `ping()` 探测实际连通性（独立于懒加载初始化状态）
- 应用关闭：`close_vector_store()` 优雅释放连接，清空缓存

---

## 调用方汇总

| 文件 | 操作 | 触发场景 |
|------|------|---------|
| `services/rag/rag_service.py` | `search` / `supports_score_threshold` / `last_resolved_model` / `last_resolved_hash` | 用户提问，RAG 召回，模型溯源 |
| `services/document_service.py` | `add_documents` / `delete_by_metadata` / `get_chunks_by_metadata` | 文档上传、更新、删除 |
| `crud/site.py` | `delete_by_metadata("site_id", id)` | 删除站点时级联清理向量 |
| `crud/tenant.py` | `delete_by_metadata("tenant_id", id)` | 删除租户时级联清理向量 |
| `services/system_config_service.py` | `reload_credentials` | AI 配置变更后热更新 |
| `ee/services/tenant_service.py` | `delete_by_metadata("tenant_id", id)` | EE 级联删除租户 |
| `core/lifecycle/manager.py` | `ping` / `validate_config` | 应用健康检查 |

---

## 新增引擎接入指南

### 步骤

**1. 新建驱动文件** `app/core/vector/<engine>_store.py`

**2. 继承 `BaseVectorStoreManager`，实现所有抽象方法**

```python
from __future__ import annotations

from typing import TYPE_CHECKING

from app.core.vector.base import (
    ALLOWED_VECTOR_FILTER_KEYS,
    BaseVectorStoreManager,
    VectorChunk,
    VectorSearchResult,
)

if TYPE_CHECKING:
    from myengine import AsyncMyEngineClient


class MyEngineVectorStoreManager(BaseVectorStoreManager):
    def __init__(self, *, client: AsyncMyEngineClient | None = None):
        super().__init__()              # 必须调用，初始化 _lock / _embeddings_cache
        self._client: AsyncMyEngineClient | None = client

    # ── 客户端就绪（仅初始化连接，不涉及 embedding） ──────────────────────
    async def _ensure_backend(self) -> None:
        if self._client is not None:
            return
        async with self._lock:
            if self._client is None:
                self._client = self._init_client()

    def _init_client(self) -> AsyncMyEngineClient:
        from myengine import AsyncMyEngineClient
        from app.core.infra.config import settings
        return AsyncMyEngineClient(host=settings.MY_ENGINE_URL)

    # ── Schema 初始化 Hook（已持锁，在 _get_embeddings 内调用） ────────────
    async def _on_embedding_config_changed(self, tenant_id, embedding_conf, embeddings) -> None:
        if self._client is None:
            self._client = self._init_client()
        dimension = int(embedding_conf.get("dimension") or 1024)
        await self._ensure_collection(dimension)

    # ── 必须实现的操作接口 ──────────────────────────────────────────────────
    @property
    def supports_score_threshold(self) -> bool:
        return True  # 若 score 为余弦相似度则 True，否则 False

    async def ping(self) -> bool: ...

    async def add_documents(self, documents, ids, storage_batch_size=100) -> list[str]:
        embeddings, _, _ = await self._get_embeddings()   # 需要向量化
        ...

    async def delete_documents(self, ids: list[str]) -> None:
        await self._ensure_backend()                        # 不需要向量化
        ...

    async def delete_by_metadata(self, key: str, value: str | int) -> None:
        if key not in ALLOWED_VECTOR_FILTER_KEYS:          # 必须做 key 校验
            raise ValueError(f"不允许的过滤 key: {key!r}")
        await self._ensure_backend()
        ...

    async def get_chunks_by_metadata(self, key, value) -> list[VectorChunk]:
        await self._ensure_backend()
        ...
        return [{"id": ..., "content": ..., "metadata": ...}]

    async def search(self, query, k=5, metadata_filter=None, purpose=None) -> list[VectorSearchResult]:
        embeddings, _, _ = await self._get_embeddings(purpose=purpose)
        ...
        return [{"doc": doc, "score": score}]

    async def close(self) -> None:
        if self._client:
            await self._client.close()
            self._client = None
            self._clear_cache()   # 必须调用，清空 embedding 缓存
```

**3. 注册到工厂** `factory.py`

```python
elif settings.VECTOR_STORE_TYPE == "my_engine":
    from app.core.vector.my_engine_store import MyEngineVectorStoreManager
    _store_instance = MyEngineVectorStoreManager()
    logger.info("✅ [Factory] 向量存储引擎：MyEngine")
```

**4. 在 `VECTOR_STORE_TYPE` 的 `pattern` 校验中添加新值**（`config.py`）

```python
VECTOR_STORE_TYPE: str = Field(
    default="postgres",
    pattern="^(postgres|elasticsearch|my_engine)$",
)
```

### 规则清单

| 规则 | 说明 |
|------|------|
| `super().__init__()` 必须调用 | 初始化 `_lock`、`_embeddings_cache`、`_context_metadata` |
| `_ensure_backend()` 用 `_lock` 做 DCL | 保证并发安全，不能省略二次检查 |
| delete / get 操作调 `_ensure_backend()` | 不依赖 embedding 配置，使这些操作在未配 AI 时也可用 |
| add / search 操作调 `_get_embeddings()` | 需要向量化能力时才调用 |
| `reload_credentials()` 无需实现 | base 已提供默认实现 `force=True` 重走初始化 |
| `close()` 末尾调 `_clear_cache()` | 清空 embedding 缓存，保证实例关闭后状态一致 |
| 过滤 key 必须校验 | 使用 `ALLOWED_VECTOR_FILTER_KEYS`，非法 key `raise ValueError` |
| 返回类型遵循 TypedDict | `get_chunks_by_metadata` → `list[VectorChunk]`，`search` → `list[VectorSearchResult]` |

---

## 环境变量参考

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `VECTOR_STORE_TYPE` | `postgres` | 引擎选择：`postgres` / `elasticsearch` |
| `POSTGRES_SERVER` | `localhost` | PostgreSQL 主机（Docker 填服务名 `postgres`）|
| `POSTGRES_PORT` | `5432` | PostgreSQL 端口 |
| `POSTGRES_USER` | `postgres` | PostgreSQL 用户名 |
| `POSTGRES_PASSWORD` | `postgres` | PostgreSQL 密码（生产必改）|
| `POSTGRES_DB` | `catwiki` | PostgreSQL 数据库名 |
| `DB_POOL_SIZE` | `10` | 连接池大小 |
| `DB_MAX_OVERFLOW` | `20` | 连接池最大溢出 |
| `DB_POOL_TIMEOUT` | `30` | 连接池超时（秒）|
| `DB_POOL_RECYCLE` | `3600` | 连接回收周期（秒）|
| `ES_URL` | `http://localhost:9200` | Elasticsearch 地址（Docker 填 `http://elasticsearch:9200`）|
| `ES_USERNAME` | — | ES Basic Auth 用户名 |
| `ES_PASSWORD` | — | ES Basic Auth 密码 |
| `ES_API_KEY` | — | ES API Key（优先于 Basic Auth）|
| `ES_CA_CERTS` | — | ES TLS CA 证书路径 |
| `ES_VERIFY_CERTS` | `True` | 是否验证 ES TLS 证书 |
| `RAG_RECALL_THRESHOLD` | `0.3` | 余弦相似度阈值（仅 postgres 引擎生效）|
| `AI_EMBEDDING_BATCH_SIZE` | `10` | 单次 embedding 请求最大文本块数 |
