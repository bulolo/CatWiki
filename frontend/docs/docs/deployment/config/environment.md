# CatWiki 环境变量参考手册

本文档提供 CatWiki 系统中所有环境变量的穷举说明。文档结构与 `backend/.env.example` 完美同步，确保配置与文档的高度一致性。

---

## 1. 基础环境配置 (Global Settings)
| 变量名 | 描述 | 默认/示例值 | 生产建议 |
| :--- | :--- | :--- | :--- |
| `ENVIRONMENT` | 运行环境模式 | `local`, `dev`, `prod` | 必须设为 `prod` |
| `DEBUG` | 是否开启调试模式 | `true`, `false` | 生产必须设为 `false` |
| `LOG_LEVEL` | 日志详细级别 | `INFO` | 可选: `DEBUG`, `WARNING`, `ERROR` |
| `PROJECT_NAME` | 系统显示名称 | `CatWiki API` | - |
| `DESCRIPTION` | 系统详细描述 | `CatWiki 后端服务` | - |
| `VERSION` | 当前 API 版本 | `0.0.4` | - |
| `API_V1_STR` | 客户端 API 路由基地址 | `/v1` | - |
| `ADMIN_API_V1_STR` | 管理后台 API 路由基地址 | `/admin/v1` | - |

---

## 2. 数据库配置 (PostgreSQL / PGVector)
| 变量名 | 描述 | 默认值 | 备注 |
| :--- | :--- | :--- | :--- |
| `POSTGRES_SERVER` | 数据库主机地址 | `postgres` | Docker 部署请填容器名 |
| `POSTGRES_PORT` | 数据库端口 | `5432` | - |
| `POSTGRES_DB` | 数据库名称 | `catwiki` | - |
| `POSTGRES_USER` | 数据库用户名 | `postgres` | - |
| `POSTGRES_PASSWORD` | 数据库密码 | `postgres` | **必须修改** |
| `DB_ECHO` | 输出 SQL 执行记录 | `false` | 调试 SQL 时开启 |
| `DB_POOL_SIZE` | 连接池基础大小 | `20` | 高并发场景可调高 |
| `DB_MAX_OVERFLOW` | 最大溢出连接数 | `50` | - |
| `DB_POOL_TIMEOUT` | 获取连接超时 (秒) | `30` | - |
| `DB_POOL_RECYCLE` | 连接回收周期 (秒) | `3600` | - |

---

## 3. 安全与访问控制 (Security & CORS)
| 变量名 | 描述 | 默认建议 |
| :--- | :--- | :--- |
| `SECRET_KEY` | JWT 令牌签名密钥 | **必须修改** (`openssl rand -hex 32`) |
| `ALGORITHM` | JWT 签名算法 | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | 令牌有效期 (分钟) | `10080` (7 天) |
| `BACKEND_CORS_ORIGINS` | CORS 域名白名单 | 生产严禁使用 `*` |

---

## 4. 对象存储配置 (RustFS / S3)
| 变量名 | 描述 | 示例/默认值 |
| :--- | :--- | :--- |
| `RUSTFS_ENDPOINT` | 后端内部连接地址 | `rustfs:9000` |
| `RUSTFS_ACCESS_KEY` | 存储访问 Key | `rustfsadmin` |
| `RUSTFS_SECRET_KEY` | 存储访问 Secret | **必须修改** |
| `RUSTFS_BUCKET_NAME` | 默认存储桶名称 | `catwiki` |
| `RUSTFS_USE_SSL` | 内部通信是否加密 | `false` |
| `RUSTFS_REGION` | 存储区域标识 | `us-east-1` |
| `RUSTFS_ROOT_USER` | RustFS 初始化管理员名 | `rustfsadmin` |
| `RUSTFS_ROOT_PASSWORD` | RustFS 初始化管理员密码 | `rustfsadmin` |
| `RUSTFS_PUBLIC_URL` | **前端访问文件基准 URL** | `http://localhost:9000` |
| `RUSTFS_PUBLIC_BUCKET`| 桶是否公共可读 | `true` |

---

## 5. AI 模型服务配置 (OpenAI 兼容)
> [!NOTE]
> AI 配置首次启动会同步到数据库。后续修改建议在管理后台进行，或设置 `FORCE_UPDATE_AI_CONFIG=true` 强制同步。

### 5.1 Chat 对话模型
| 变量名 | 描述 | 示例值 |
| :--- | :--- | :--- |
| `AI_CHAT_API_KEY` | 对话服务 API Key | `sk-xxxx` |
| `AI_CHAT_API_BASE` | 对话服务 API 基地址 | `https://api.openai.com/v1` |
| `AI_CHAT_MODEL` | 对话模型名称 | `gpt-4o`, `deepseek-chat` |

### 5.2 Embedding 向量服务
| 变量名 | 描述 | 示例值 |
| :--- | :--- | :--- |
| `AI_EMBEDDING_API_KEY` | 向量服务 API Key | `sk-xxxx` |
| `AI_EMBEDDING_API_BASE` | 向量服务 API 基地址 | `https://api.openai.com/v1` |
| `AI_EMBEDDING_MODEL` | 向量模型名称 | `text-embedding-3-small` |
| `AI_EMBEDDING_DIMENSION` | 向量维度 | `1536`, `1024` |
| `AI_EMBEDDING_BATCH_SIZE` | 批量处理数量 | `10` |

### 5.3 Reranker 重排序
| 变量名 | 描述 | 示例值 |
| :--- | :--- | :--- |
| `AI_RERANK_API_KEY` | 重排服务 API Key | `sk-xxxx` |
| `AI_RERANK_API_BASE` | 重排服务 API 基地址 | `https://api.openai.com/v1` |
| `AI_RERANK_MODEL` | 重排模型名称 | `bge-reranker-v2-m3` |

### 5.4 VL 视觉/多模态模型
| 变量名 | 描述 | 示例值 |
| :--- | :--- | :--- |
| `AI_VL_API_KEY` | 视觉服务 API Key | `sk-xxxx` |
| `AI_VL_API_BASE` | 视觉服务 API 基地址 | `https://api.openai.com/v1` |
| `AI_VL_MODEL` | 视觉模型名称 | `gpt-4o` |

---

## 6. RAG 检索与智能 Agent 调优
| 变量名 | 描述 | 默认值 |
| :--- | :--- | :--- |
| `RAG_RECALL_K` | 初始向量召回数量 | `50` |
| `RAG_RECALL_MAX` | 全局召回文档块上限 | `100` |
| `RAG_RECALL_THRESHOLD` | 相似度召回阈值 | `0.3` |
| `RAG_ENABLE_RERANK` | 是否启用重排序精排 | `true` |
| `RAG_RERANK_TOP_K` | 最终呈现给 AI 的段落数 | `5` |
| `AGENT_MAX_ITERATIONS` | AI 思考最大轮次 | `5` |
| `AGENT_MAX_CONSECUTIVE_EMPTY`| 连续空响应终止阈值 | `2` |
| `AGENT_SUMMARY_TRIGGER_MSG_COUNT`| 触发摘要的消息数 | `10` |

---

## 7. 文档解析引擎 (DocProcessor)

### 7.1 MinerU (深度 PDF 解析)
| 变量名 | 描述 | 示例值 |
| :--- | :--- | :--- |
| `MINERU_ENABLED` | 是否启用 MinerU | `true` |
| `MINERU_NAME` | 服务显示名称 | `MinerU` |
| `MINERU_BASE_URL` | MinerU API 基地址 | `http://mineru-service:8888` |
| `MINERU_API_KEY` | MinerU API 访问密钥 | `sk-mineru-key` |

### 7.2 Docling (通用文档解析)
| 变量名 | 描述 | 示例值 |
| :--- | :--- | :--- |
| `DOCLING_ENABLED` | 是否启用 Docling | `true` |
| `DOCLING_NAME` | 服务显示名称 | `Docling` |
| `DOCLING_BASE_URL` | Docling API 基地址 | `http://docling-service:8000` |
| `DOCLING_API_KEY` | Docling API 访问密钥 | `sk-docling-key` |

### 7.3 PaddleOCR (图片/扫描件 OCR)
| 变量名 | 描述 | 示例值 |
| :--- | :--- | :--- |
| `PADDLEOCR_ENABLED` | 是否启用 PaddleOCR | `false` |
| `PADDLEOCR_NAME` | 服务显示名称 | `PaddleOCR` |
| `PADDLEOCR_BASE_URL` | PaddleOCR API 基地址 | `http://paddleocr-service:8080` |
| `PADDLEOCR_API_KEY` | PaddleOCR API 访问密钥 | `NONE` |

---

## 8. 系统限制与运维 (Limits & DevOps)
| 变量名 | 描述 | 默认值 |
| :--- | :--- | :--- |
| `UPLOAD_MAX_SIZE` | 文件上传上限 (字节) | `104857600` (100MB) |
| `UPLOAD_ALLOWED_EXTENSIONS`| 允许上传的后缀列表 | PDF, DOCX, TXT... |
| `FORCE_UPDATE_AI_CONFIG` | 强制同步 AI 配置 | `false` |
| `FORCE_UPDATE_DOC_PROCESSOR`| 强制同步解析配置 | `false` |

### 8.3 部署控制与端口映射 (Infrastructure Only)
> [!IMPORTANT]
> 以下变量仅用于 Docker Compose 容器端口到宿主机的映射，**后端及前端项目代码并不读取这些变量**。它们允许您在不修改 `docker-compose.yml` 的情况下更改对外暴露的端口。

| 变量名 | 描述 | 默认宿主机端口 | 参考作用服务 |
| :--- | :--- | :--- | :--- |
| `BACKEND_PORT` | 后端 API 对外端口 | `3000` | `backend` |
| `ADMIN_PORT` | 管理后台对外端口 | `8001` | `admin-frontend` |
| `CLIENT_PORT` | 演示问答端对外端口 | `8002` | `client-frontend` |
| `DOCS_PORT` | 帮助文档站对外端口 | `8003` | `docs-frontend` |
| `WEBSITE_PORT` | 官网首页对外端口 | `8004` | `website` |
| `RUSTFS_CONSOLE_PORT` | RustFS 后端管理端口 | `9001` | `rustfs` |

---

## 🎯 变量覆盖机制
CatWiki 的配置加载顺序遵循 **“高优先覆盖”** 原则：
1. **Docker environment** (在 Compose 文件的 `environment` 或 `args` 中定义)
2. **环境专有 `.env` 文件** (如 `.env.prod`)
3. **基础 `.env` 文件** (`backend/.env`)
4. **代码硬编码默认值** (最后的退路)
