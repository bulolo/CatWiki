# 更新日志 (Changelog)

CatWiki 始终保持快速演进。在这里，您可以了解到项目的每一个重大改进。

## 2026-05-19 ⚡ 全面打磨:对话更快、架构更清晰 (v1.1.4)

这一版没有新增重大功能,核心是**全面打磨内功**——后端架构、性能、可观测性、前端 SDK 一起升级。改动涉及 ~30 个 commit,几个用户能直接感受到的:

- **对话开始更快**:每次对话的初始化阶段从 271ms 降到 51ms
- **多人并发不再串行**:之前一个对话独占一根数据库连接 10-60 秒,现在毫秒级
- **长对话载入更顺**:50 轮以上的会话载入由 O(n²) 改为 O(n)
- **知识库批量入库快好几倍**:向量化并行了(1000 chunks 入库时间 -60~70%)
- **RAG 故障坦诚**:知识库挂掉时不会"装作没查到",而是明确告诉用户系统有问题
- **改 AI 配置立刻生效**:不用再等缓存过期或重启
- **删除独立 VL 视觉模型配置**:现代 chat 模型本身就支持多模态

### ⚡ 性能改进

**AI 配置读取优化(对话热路径最大头)**

一次对话以前要反复读 DB 拿 AI 配置(chat / embedding / rerank 三种模型的 api_key / base_url / model 等),每个请求里光是**对 PostgreSQL 的配置查询就有 8-12 次**。这一版从 4 个层面协同优化,**warm 状态下 AI 配置不再触达 PostgreSQL**——所有命中都从缓存返回(默认走 Redis 亚毫秒响应,未配置 `REDIS_URL` 时自动回退到进程内存):

- **进程级 30 秒缓存**:三种 AI 模型的配置加 30s TTL 缓存。后续请求只要在 30 秒内,直接从内存返回。
- **三家路径统一**:以前 chat / embedding / rerank 各走各的配置路径(chat 直查、embedding 自建 60 秒缓存、rerank 自己实现),现在统一为「外层 60 秒 + 内层 30 秒」两层结构。Embedding 删除自建的重复缓存,消除"两份缓存不一致"风险。
- **Rerank 返回值带元信息**:以前对话每跑完 rerank,RAG service 还要**再单独查一次 rerank 配置**,只为日志里写一行 model 名。现在 rerank 直接把 model/hash 跟着结果返一份,RAG service 每次对话省下这第 3 次配置查询。
- **高并发防"惊群"**:冷启动 / TTL 过期那一瞬间,如果 50 个请求同时到达同一份配置,以前会一起冲 DB。现在加了"同 key 只让 1 个请求真去 fetch,其他 49 个等结果"的机制(内存用 asyncio 锁,Redis 用分布式锁带 30 秒自释放)。

**附带收益**:
- 坏配置不会被缓存——错误的配置在校验阶段就被拒,缓存层只会装已验证过的数据。后续请求一定拿到的是健康配置。
- 管理后台改了模型配置**立刻生效**:配置更新触发缓存级联失效,不用等过期或重启。
- 每次对话内部的初始化阶段(取配置 / 建模型实例 / 建图状态等):**271ms → 51ms**(快 5 倍)。对应下文 timing 仪表盘里的 `init` 字段。
- 综合以上 + 历史消息批量写、Rerank 元信息复用等优化,**单次对话总 DB 查询数从 17-25 次降到 5-7 次**(剩余的查询都是必须的业务操作:用户认证 / 会话与消息写入 / Checkpointer 状态保存等,不再是配置查询)。

**对话过程其他热路径**
- **Checkpointer 并发解锁**:对话状态保存(LangGraph Checkpointer)以前会"独占数据库连接 10-60 秒",并发对话之间互相串行。现在改为按需借连接(毫秒级),并发上限不再受连接池大小限制。
- **历史消息批量写**:对话结束保存历史改成一次 `add_all` 写所有消息,替换之前循环调单条写入(N 次 SAVEPOINT 消失)。
- **历史消息读单趟扫**:加载会话时本轮引用提取改成单趟 O(n) 扫描,以前是每条 assistant 消息重扫前缀(O(n²))。
- **删全部会话 SQL 批量化**:从 N 次单删改为 4 次 `ANY()` 批量删。
- **Rerank HTTP 长连接**:之前每次 rerank 都新建 / 销毁 httpx 客户端,现在保持长连接,生命周期收敛到 app shutdown。
- **删除人为延迟**:对话流式输出里之前有一段刻意 `asyncio.sleep`(避免某些前端拼接错乱),现在删除——切分本身就提供天然节奏。

**知识库相关**
- **向量化批次并行**:`aembed_documents` 之前串行打 OpenAI(1000 chunks → 100 次顺序请求)。现在用 Semaphore 限流的 fan-out,**1000 个 chunks 的入库时间缩短 60-70%**。可通过 `AI_EMBEDDING_BATCH_CONCURRENCY` 调整并发数(默认 5)。
- **趋势统计 SQL 合并**:管理后台日活/周活趋势从 14 次顺序查询合并成 1 次 `date_trunc GROUP BY`。

### 🐛 关键修复

- **🚨 RAG 失败时不再"装作没结果"**(高优先级 bug):向量库 / Embedding / Reranker 任何一环挂掉时,之前会**返回空数组并被 AI 当作"知识库里没有这个"**,导致 AI 一遍遍换关键词重复检索、最后给用户一个看似自信的"找不到"答案。现在区分"系统故障"与"真的空结果":系统故障会立刻告诉 AI 停止重试,坦诚告知用户系统暂时不可用。
- **Rerank URL 双路径 bug**:管理员粘贴完整 URL(如 DashScope 的特殊路径)时,代码会强制追加 `/rerank` 后缀导致 404。新增 `endpoint_path` 字段作为 escape hatch,可让 admin 的 URL 被原样使用。修复路径同步覆盖了管理后台的"测试连接"按钮,之前测试连接和实际调用走的是两份重复逻辑,容易漂移。
- **会话来源标签丢失**:并发创建同一会话时,IntegrityError 重试路径没传 `source` 字段,导致部分会话 source 莫名为空。
- **机器人会话隔离**:thread_id 删除现在严格校验所属站点(防止跨站点删除)。

### 🗑️ 删除独立 VL(视觉语言)模型类型

现代 chat 模型本身就是多模态,独立的 VL 模型配置没有实际价值——之前的 VL 端点从未被运行时调用,只是配置 UI 里多了一项让人困惑。

- 后端删除 `AI_VL_API_KEY/BASE/MODEL` 环境变量和 `AI_VL_CONFIG_KEY` 常量
- 新增 Alembic 迁移 `ce_drop_ai_vl_config`,自动清理已有租户的 `system_configs.config_key='ai_vl'` 旧数据
- 管理后台「AI 模型设置」中 VL Tab 移除,只保留 Chat / Embedding / Rerank 三种
- 想用多模态能力的用户:直接配置一个支持视觉的 chat 模型即可

### 🏗️ 后端架构大规模重构(对二开者友好)

这一版集中清理了多个"过大单体文件"和"命名漂移",对终端用户透明,但显著降低了二开门槛。

**单体文件拆分**(都按 `chat/` 子包约定切成多模块):
- `document_service.py` **789 行 → 拆成 4 个聚焦模块**(crud / 向量化流水线 / AI 元数据增强 / 文档导入)
- `system_config_service.py` **488 行 → 拆成 5 个文件**(AI 配置 / 文档处理服务 / 共享 secrets 助手)
- `chat_service.py` 拆出独立的 chunks 生成器和历史写入器
- `utils.py` 按主题拆模块(masking / ai_logging / chat_timing / reading_time / 等)
- Responses API 的 SSE 序列化抽出独立模块,chat_service 只负责业务逻辑

**AI Provider 统一基类**:
- chat / embedding / rerank 三家以前各写各的缓存、各打各的 usage signal、各自处理冷启动锁。现在统一在 `BaseAIProvider[T]` 基类下,共享 fast-path 命中 + slow-path double-check + 单一 usage 信号入口。子类只需实现 `_fetch_config` + `_build_instance`。
- 类重命名对齐业界(`LLMManager` → `ChatProvider`,`EmbeddingResolver` → `EmbeddingProvider`),不再用项目内自造的 `Resolver` / `Manager` 不一致词。

**Robot 集成模块清理**:
- 子目录从 **13 个减到 7 个**:删除空的 `contexts/` / `crypto/` / `registry/`,删除冗余的 `plugins/` 插件系统(4 个文件就为了注册 2 个 resolver,过度设计)
- WeCom 三种接入(智能机器人 / 客服 / 应用)的 HTTP 客户端统一到共享 `WeComClient`,不再每种各自管理 token
- WeCom 长连接 starter 命名与飞书 / 钉钉对齐
- `base.py` 顶部新增架构总览注释,新人能从一个文件了解全局

**命名 / 约定统一**:
- `app/services/` 下 chat / config / rag / robot / stats / document 全部采用同一种子包约定(`chat/__init__.py` 暴露公共面,内部模块用 bare names)
- `ai_fields` 重命名为 `enrichment`(语义更准确:这是"内容增强",不是"AI 字段"业务模块)
- 三处零散的命名漂移统一(其中包括之前发现的两处 service class docstring 错放在 `__init__` 之后,导致 `__doc__` 为 `None` 的 bug)

### 🎨 前端 SDK 整体换栈

**openapi-typescript-codegen → orval + TanStack Query**:之前手写 `useQuery` 调用 SDK 函数,每个端点都要重复 `useQuery({ queryKey: ['xxx'], queryFn: () => sdk.xxx() })`。现在 orval 按 OpenAPI tag 自动生成 React Query hooks:

```typescript
// 之前
const { data } = useQuery({ queryKey: ['sites'], queryFn: () => sdk.sites.list({ page: 1 }) })

// 现在
const { data } = useListAdminSites({ page: 1 })
```

附带改进:
- `customFetch` mutator 统一收口 token 注入 / 401 跳转 / ApiResponse envelope 解包,业务侧不再嗅探 `data.data.list` 这种三层嵌套
- OpenAPI 层把 `ApiResponse_X_` envelope 展平,**类型和运行时完全对齐**
- 删除中间 barrel(`@/lib/api-client`),业务直 import `@/lib/sdk/<tag>`——新增后端 tag 时业务侧零维护,IDE 跳转直达定义文件
- 重写 4 份过期开发文档(SDK 使用指南 / Admin API / Client API / 前端开发指南),从旧时代 codegen 的 `apiClient.xxx.yyy()` 风格抢救到 orval 实际风格

升级 react-query 到 `^5.100.11`,顺手清理了 7 个前端零引用依赖(`date-fns` / `@radix-ui/react-{label,select,separator}` / `uuid` 等)。

### 📊 新增对话耗时仪表盘

每次对话结束时,后端日志会打一行结构化耗时数据,方便排查"为什么这次慢":

```
⏱️ [Timing] thread=thread-xyz init=51ms ttfb=85ms tool_1_start=754ms
            tool_1_end=1229ms first_token=1832ms graph_done=3002ms total=3006ms
```

字段含义:`init`(后端准备)/ `ttfb`(首个数据包送出)/ `tool_N_start/end`(第 N 次检索)/ `first_token`(AI 开始打字)/ `graph_done`(LangGraph 推理结束)/ `total`(总耗时)。对话异常时也会打这条日志(带 `error` 标记)。

典型基线(本地测试环境,warm 状态):`init ~50ms / ttfb ~85ms / 检索 ~500ms / 总 ~3s`——大头在上游 LLM 生成 token,符合预期。实际值取决于上游模型 / 网络状况 / 召回深度,差异可能很大。

### 🔇 日志大瘦身

- **单次对话日志:~110 行 → ~50 行**(dev 模式)
- **生产模式只剩 ~20 行关键业务日志**

具体瘦身:
- AI 模型缓存命中提示从 6 行卡片改成 1 行:`💬 chat HIT | gpt-4o-mini | hash=56ce98d8 | tenant=1 | purpose=分析意图`
- 每 60 秒刷一次的整段配置 JSON dump 降级到 DEBUG 级(生产 INFO 模式看不到,改为单行简讯)
- ReAct 推理循环的多行卡片改为单行进度
- 工具调用 start/end 高频日志降到 DEBUG 级
- `/v1/health` 健康检查访问日志彻底过滤(之前每 30 秒刷两行)

容器日志:Redis 默认改为 `warning` 级,RustFS `RUST_LOG=warn`,屏蔽常规 IO 流水。

### 🌐 Responses API usage 字段

对接 OpenAI Responses API 的客户端可以拿到 token 用量了:`input_tokens` / `output_tokens` / `total_tokens` 跟随 `response.completed` event 一起返回,多轮 ReAct 工具调用的多次 LLM 调用 usage 自动聚合。

### 🧹 代码注释审计

经过 5 轮系统扫描,修复 **11 处可证伪的注释/代码不一致**:
- 注释指向已被重命名 / 删除的函数(`_resolve_url` 实际叫 `resolve_rerank_url` 等)
- 两处 Service 类的 docstring 被错放在 `__init__` 之后,导致 `__doc__` 为 `None`(同源 copy-paste bug)
- 文档里残留的"使用 PostgreSQL ARRAY"等误导性实现暗示(实际用逗号分隔 String)
- 步骤编号断号(两处:1→2→4 / 1→3→4)
- 死代码 `RetrieveInput` / `GenerateInput` 上一代 graph 架构残留
- `scripts/version.py` 长期 silent no-op 的 4 条同步路径(指向 codegen 时代已不存在的文件)

### 🔧 其他

- README 新增"Agentic RAG"标签(更准确地描述 ReAct + 知识库的产品形态)
- Backend ruff 顺手清理(import 排序 / `isinstance` 联合类型)
- 多行语句压缩到单行(可读性)
- `make gen-sdk` 末尾示例 import 路径修正(之前指向 `mode=tags-split` 嵌套路径,实际是 `tags` 扁平)

---

## 2026-05-17 🗂️ S3 数据源与导入流程升级 (v1.1.3)

### 🗂️ S3 数据源管理（核心新功能）
- **统一接入两类存储**：系统设置新增「S3 数据源」模块，支持两种类型——**系统内置**（与平台共用 RustFS）和**外部 S3 兼容**（AWS S3 / MinIO / Cloudflare R2 等）。
- **UI 内文件管理**：管理员无需另开对象存储控制台，可在 admin 内直接浏览数据源目录、上传文件、删除文件，路径浏览支持子目录进入/返回。
- **`root_prefix` 隔离**：每个数据源可设置访问根路径，浏览/上传/删除操作严格限定在该前缀范围内，避免污染或越权访问。
- **默认系统内置**：新增数据源时默认选「系统内置」，填个名字即可使用；切换到外部 S3 才需填写 endpoint/keys 等连接信息。
- **内联编辑布局**：采用 admin 通用的内联编辑模式（与文档解析器一致），无需弹窗打断浏览节奏。

### 📥 文档导入流程增强
- **新增数据源导入**：文档导入对话框新增「从 S3 数据源」Tab，可批量选取已配置数据源里的文件入库；未配置任何数据源时显示空态指引并一键跳转到系统设置完成添加。
- **自动入向量库**：导入选项新增「自动入向量库」开关——解析完成后自动串联向量化任务，跳过手动点击「开始学习」步骤。
- **纯文本直读**：`.md` / `.markdown` / `.mdx` / `.txt` 文件以原文直接入库，跳过 MinerU / Docling / PaddleOCR 等外部解析器，不再被「不支持 txt」类错误拦截；文档 `parse_meta.processor_type` 标记为 `native` 便于审计区分。
- **选项分组**：解析选项（OCR / 提取图片 / 表格识别，按解析器能力动态显示）与导入选项（去重 / 自动入向量库 / AI 摘要 / AI 标签）分组排列，配置归属一目了然。

### 🔒 多租户存储路径隔离
- **基于 slug 的前缀**：企业版下存储路径前缀使用 **tenant slug**（如 `acme-corp/uploads/...`），对象路径与签名 URL 不暴露内部数字 ID；上传、下载、worker 任务、数据源浏览/上传/删除全链路统一。
- **回退机制**：slug 缺失时自动回退到 `tenant_id` 数字前缀，保证已有数据可读。

### 🔍 聊天审计增强
- **会话来源追踪**：`chat_sessions` 表新增 `source` 字段，记录接入来源（`web` / `dingtalk` / `feishu` / `wecom` / `api` 等），admin 审计列表显示来源徽章，支持按来源筛选。
- **视觉对齐**：admin 端审计的消息气泡、工具调用展示、原始 JSON 返回视图与 client 端 AI 对话风格统一，复盘时直接还原用户视角。
- **清空全部历史会话**：新增「清空全部历史会话」操作，方便测试与运维。
- **机器人会话租户隔离修复**：机器人 `thread_id` 删除时严格校验所属站点，防止跨租户/跨站点访问。

### 🐛 关键 Bug 修复
- **保存模型时密钥被脱敏覆盖**：前端编辑已有模型时，若 `api_key` 仍是脱敏占位（`sk-****xxx`），保存前不再强制重测连接（避免发送脱敏值真连失败导致整体失败）；后端 `_merge_securely` 在保存阶段会自动从 DB 恢复真实 key。
- **测试模型连接 NPE**：修复部分模型返回空 `message.content` 时测试连接报错的问题。
- **工具调用展示完整性**：admin 审计加载历史会话时偶发丢失工具调用展示；`mergeToolMessages` 在 `content` 为空时也累计 `tool_calls` 字段，保证工具节点不丢失。

### 🚀 依赖批量升级
统一升级到最新 minor 版本，全部验证通过 134/134 冒烟：

| 包 | 旧 | 新 |
|---|---|---|
| fastapi | 0.126 | **0.136** |
| pydantic | 2.12 | **2.13** |
| sqlalchemy | 2.0.45 | **2.0.49** |
| openai | 2.15 | **2.37** |
| langchain-core | 1.2 | **1.4** |
| langchain-openai | 1.1 | **1.2** |
| langchain-postgres | 0.0.16 | **0.0.17** |
| langgraph | 1.0 | **1.2** |
| langgraph-checkpoint-postgres | 3.0 | **3.1** |
| redis | 7.2 | **7.4** |
| alembic | 1.17 | **1.18** |
| psycopg | 3.3.2 | 3.3.4 |

**保持不变**：`arq 0.25`（0.28 限制 `redis<6` 与 7.4 冲突）；`elasticsearch 8.19`（pyproject 显式锁 `<9`，ES 服务端仍为 8.x）。

### 🧪 质量保障
- **冒烟测试覆盖 +41%**：`make smoke-test` 从 95 项扩展到 **134/134** 全过，新增：
  - S3 数据源全链路（CRUD + 浏览 + 上传/删除 + 从数据源导入 + 原生 .md 直读 + 自动向量化串联）
  - 多租户隔离边界（A 租户管理员不可见 B 租户站点/文档/合集，删除也不可达）
  - JWT 边界（无效 token → 401）
  - **所有启用的解析器**（Docling / MinerU / PaddleOCR）逐个 test-connection
  - **4 个 AI 模型类型**（chat / embedding / rerank / vl）逐个 test-connection

### 🧹 配置与运维改进
- **`.env.example` 整理**：重排为 13 个清晰分节带横线分隔，独立「文件上传限制」分节，AI 模型/解析器配置加子编号 (7.1-7.4, 11.1-11.3)；删除 6 个未生效的 `VECTORIZE_QUEUE_*` 与 1 个 `WORKER_MODE` 死配置。
- **Worker 配置环境化**：新增 `WORKER_MAX_TRIES` / `WORKER_JOB_TIMEOUT` / `WORKER_MAX_JOBS` 三个 env，可调整重试次数、超时和并发度，不必再改代码。
- **可调参数补齐**：`.env.example` 补 `AGENT_SUMMARY_TRIGGER_MSG_COUNT`（长对话自动摘要触发阈值）、`RAG_RECALL_MAX`（向量召回硬上限）、`UPLOAD_MAX_SIZE`（默认 300MB）、`UPLOAD_ALLOWED_EXTENSIONS`、`AI_VL_*` 等。
- **事务日志降噪**：`@transactional` 装饰器移除 5 条 happy-path debug 日志，保留异常与回调失败的 WARN/ERROR；DEBUG 级别日志不再被高频刷屏。

### 🎨 其他 UX 微调
- 「发布文档」按钮重命名为「**新建文档**」，避免与编辑器内真正的"发布"动作语义重复；左侧栏同步更新。
- 「平台管理中心」标题简化为「平台管理」。
- 客户端 `ToolCallCard` 完成态显示检索到的 chunk 数量徽章。

---

## 2026-05-10 🔧 兼容性修复与构建优化 (v1.1.1)

### 🐛 Bug 修复
- **AI 摘要/标签兼容 DeepSeek**：修复 langchain-openai 1.x 将 `with_structured_output` 默认切换为 `json_schema` 后，DeepSeek 等不支持 strict 模式的模型报 400 错误的问题。主路径改为 `function_calling`，不支持工具调用的模型（如 DeepSeek R1）自动降级为纯文本 + JSON 提取兜底，降级判断基于 openai 异常类型，避免多语言错误消息误判。

---

## 2026-05-09 🔍 Elasticsearch 混合检索 & 全面升级 (v1.1.0)

> 🚨 **Breaking Change**：v1.1.0 不兼容旧版数据库，无法从 v1.0.x 直接升级，需全新部署。

### 🔍 Elasticsearch 混合检索（核心新特性）
- **ES 向量引擎**：新增 `elasticsearch` 作为向量存储后端，与原有 `postgres`（PGVector）引擎并列支持，通过 `VECTOR_STORE_TYPE=elasticsearch` 切换。
- **IK 中文分词**：Elasticsearch 镜像内置 IK 分词插件，无需手动安装，开箱即用。
- **混合检索（Hybrid Search）**：结合向量相似度与 BM25 关键词检索，通过 RRF（Reciprocal Rank Fusion）算法融合排序，显著提升中文语义召回精度。
- **一键启用**：`make dev-up ES=1` 即可同时拉起 Elasticsearch 容器，Makefile 新增 ES 环境变量前置校验，配置不一致时直接报错拦截。
- **向量层工业级重构**：PGVector / ES 共用统一抽象接口，6 项架构改进 + 4 项缺陷修复，业务层完全无感切换；修复并发写入竞态、索引缺失、BM25 权重未生效等实质性问题。

### 💬 Response API 重构聊天
- AI 聊天核心完整迁移至 Response API 模式，摒弃旧版流式拼接方案。
- 流式输出更稳定，减少长文本场景下的断流与乱序问题。
- 并发处理能力大幅提升，多用户同时对话时响应延迟更低。

### 🎯 RAG 检索优化
- **首轮检索用原始提问**：第一轮检索不再使用 AI 改写后的问题，直接使用用户原始输入，降低改写偏差对召回的干扰，提升关键词命中率。
- **多轮检索参数**：`AGENT_MAX_ITERATIONS` / `AGENT_MAX_CONSECUTIVE_EMPTY` 支持通过环境变量细粒度控制 ReAct 迭代次数与空结果终止阈值。
- **RAG Pipeline Summary**：检索摘要新增向量后端来源展示，区分「阈值实际生效」与「ES 跳过阈值」两种情况，便于排查召回行为。

### 🤖 AI 自动生成摘要与标签
- 文档编辑器与批量导入均支持一键让 AI 自动生成文章摘要与标签，可配置字数上限和标签数量上限。
- 批量导入时可勾选「AI 自动生成摘要/标签」，无需逐篇手动填写。

### 🔄 向量状态同步优化
- 新增 `OUTDATED`（已过期）向量状态：文档内容或关键字段更新后，状态自动由 `COMPLETED` 变为 `OUTDATED`，提醒用户重新向量化。
- 文档列表新增过期状态标识，支持一键重新学习。
- 修复 BM25 权重未实际生效、向量状态显示不一致等多项问题。

### 📊 对话统计与分析
- 管理后台新增对话详情统计功能，可逐条查看每次会话的完整工具调用链路、检索命中文档与 Token 消耗。
- 数据分析页面新增 EE 专属看板，支持多维度运营指标展示。

### 🔍 客户端检索结果查看
- 客户端对话界面中，点击工具调用记录可直接展开查看 AI 实际命中的文档片段与相关度得分，提升用户对 AI 推理过程的可信度。

### 🔒 公开站点密码保护
- 支持为知识库站点设置访问密码，实现半公开的权限控制。
- 关闭公开访问时自动生成随机强密码，防止意外泄露。

### ⚙️ 模型配置增强
- **extra_body 通用参数**：对话模型配置新增 `extra_body` JSON 输入框，支持透传任意模型特有参数（如关闭思考模式），内置 Qwen3/DeepSeek/Kimi/豆包/混元等主流模型的可点击参考示例。
- **系统引擎信息面板**：平台管理新增「系统引擎」标签页，并发探活数据库、向量存储、缓存、对象存储四大组件，实时展示连接状态与后端信息。

### 🏗️ 基础设施与工程改进
- **Docker 目录重构**：部署目录拆分为 `deploy/docker`（CE）与 `deploy/docker-ee`（EE），开发与生产配置全面对齐。
- **数据库迁移整理**：将所有建表迁移合并至 `initial_schema`，EE 专属表独立为 Alembic 分支，使用 `alembic upgrade heads` 兼容多分支升级。
- **配置强制覆盖控制**：新增 `FORCE_UPDATE_AI_CONFIG` / `FORCE_UPDATE_DOC_PROCESSOR` 环境变量，重启时可选择是否用 `.env` 覆盖数据库中已有的 AI 与解析器配置。
- **EE 功能整合**：企业版站点配置 API 统一，EE 前端组件独立隔离，CE/EE 同步脚本全面加固。

---

## 2026-04-15 🔧 解析器升级与体验优化 (v1.0.9)
- ⚡ **异步解析**：Docling 和 MinerU 改为异步提交+轮询模式，解析大文件不再阻塞 Worker。
- 🆕 **MinerU 3.x 适配**：支持 MinerU 3.0 新异步 API，新增 backend 选择（hybrid-auto-engine / vlm-auto-engine / pipeline 等），标注精度与硬件要求。
- 🔧 **Docling v1.12.0**：新增 OCR 引擎、PDF 解析后端、处理管线配置项，验证版本 `v1.12.0`。
- 🗂️ **解析元数据**：文档导入后记录解析器类型、文件路径、OCR 配置等，可在编辑页折叠查看，方便排查问题。
- 🔑 **API Key 保护**：修复编辑解析器时保存会覆盖真实 API Key 的 bug。
- 📋 **任务队列入口**：导航栏新增任务队列按钮，有进行中任务时显示数量角标，随时可重新打开队列面板。
- 🏢 **组织列表优化**：平台组织列表改用 React Query 缓存，切换 Tab 不再闪烁，支持关键词搜索。
- 🐳 **基础设施修复**：修正 RustFS healthcheck 端点，补充 Worker 对 RustFS 的启动依赖，统一开发/生产环境配置。

## 2026-02-26 🤖 AI 机器人集成
- 🌐 **网页挂件**: 支持一键嵌入任何网页，提供开箱即用的智能客引导流能力。
- 🔌 **问答机器人 API**: 深度兼容 OpenAI 协议接口，可对接 Dify、FastGPT 及各类 AI 客户端。
- 🔗 **钉钉机器人**: 深度对接钉钉 Stream 模式，支持 AI 卡片流式输出与互动卡片交互。
- 💬 **企业微信**: 同时支持 `企业微信客服`** 与 **`企业微信智能机器人`**，覆盖私域流量全场景。
- 🦅 **飞书机器人**: 对接飞书开放平台，支持长连接模式、事件订阅与富文本消息交互。
- 📚 **文档更新**: 同步上线全系列机器人集成指引，涵盖各平台详细配置流程。

## 2026-02-09 🤖 LangGraph Agentic RAG 与多轮自主检索
- **LangGraph 集成**: 采用 LangGraph 1.x 重构聊天功能，支持工具调用模式。
- **RAG 工具化**: 将知识库检索封装为 `search_knowledge_base` 工具，由 AI 自主判断是否需要调用。
- **ReAct 循环架构**: AI 可自主调用知识库进行多轮检索，持续优化答案质量。
- **工具调用展示**: 前端 AI 对话支持展示完整的多轮检索历程，用户可以看到所有搜索尝试。
- **会话持久化**: 集成 PostgreSQL Checkpointer，后端自动管理并行会话及其历史。
- **API 简化**: 前端只需传 `thread_id`，后端自动加载上下文。

## 2026-02-05 🎨 视觉标准化与品牌优化
- 🚀 **全新品牌域名启用**: 正式启用 [catwiki.ai](https://catwiki.ai) 官方网站与全线品牌域名。
- 🚀 **文档图片公开化**: 文档解析过程自动提取图片并上传至对象存储，生成永久公开访问链接。
- 🖼️ **AI 图片回复**: 知识库问答支持图文混排，AI 可直接引用文档中的图片进行回答。

## 2026-02-04 📄 文档解析引擎集成
- **MinerU 集成**: 深度对接 MinerU (Magic-PDF) 高质量解析器，支持复杂版面分析和公式提取。
- **Docling 集成**: 对接 IBM Docling 解析引擎，提供轻量级高性能文档转换。
- **PaddleOCR 集成**: 深度对接百度 PaddleOCR 引擎，提供业界领先的 OCR 识别精度，尤其在多语言和复杂场景下表现卓越。
- **OCR 动态配置**: 管理后台支持按解析器配置开启/关闭 OCR 识别。
- **批量导入优化**: 文档上传弹窗深度适配解析器配置，支持一键批量导入并自动解析。

## 2026-01-18 ⚡ 全新文档站点上线
- **VitePress 驱动**: 基于 VitePress 构建高性能文档中心。
- **多语言对齐**: 重新对齐了中英文 README 说明。
- **架构清理**: 优化了项目目录结构和 Docker 配置。

## 2025-12-30 🚀 CatWiki V0.0.1 发布
- **核心功能**: 实现文档层级管理、向量检索、AI 对话及站点配置。
- **双端架构**: 独立的管理后台 (Admin) 与 客户端 (Client)。
- **全栈类型安全**: 基于 FastAPI + Next.js 14 构建，全链路 TypeScript/Pydantic 支持。