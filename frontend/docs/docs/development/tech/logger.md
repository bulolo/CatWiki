# 日志系统

CatWiki 使用结构化日志系统，提供统一的日志记录和管理。

## 📋 日志配置

### 环境变量

```bash
# 日志级别
LOG_LEVEL=INFO  # DEBUG, INFO, WARNING, ERROR, CRITICAL

# 是否输出 SQL 日志
DB_ECHO=false
```

---

## 🔧 后端日志

### Python 日志

后端使用 Python 标准库的 `logging` 模块：

```python
import logging

logger = logging.getLogger(__name__)

# 不同级别的日志
logger.debug("调试信息")
logger.info("普通信息")
logger.warning("警告信息")
logger.error("错误信息")
logger.critical("严重错误")
```

### 查看日志

```bash
# 开发环境
make logs

# 或直接查看容器日志
docker compose -f docker-compose.dev.yml logs -f backend

# 生产环境
make prod-logs
```

---

## 🎨 前端日志

### Admin 前端日志

Admin 前端提供了统一的日志工具，位于 `src/lib/logger.ts`。

#### 使用方法

```typescript
import { logger } from '@/lib/logger'

// 不同级别的日志
logger.debug('调试信息', { data: someData })
logger.info('普通信息')
logger.warn('警告信息')
logger.error('错误信息', error)
```

#### 日志特性

- ✅ 自动添加时间戳
- ✅ 支持结构化数据
- ✅ 开发环境彩色输出
- ✅ 生产环境自动禁用 debug 日志

---

## 📊 日志级别

| 级别 | 用途 | 示例 |
|------|------|------|
| DEBUG | 调试信息 | 变量值、函数调用 |
| INFO | 普通信息 | 操作成功、状态变更 |
| WARNING | 警告信息 | 非致命错误、性能问题 |
| ERROR | 错误信息 | 异常、失败操作 |
| CRITICAL | 严重错误 | 系统崩溃、数据丢失 |

---

## 🔍 日志查询

### Docker 日志

```bash
# 查看最近 100 行日志
docker compose logs --tail 100 backend

# 实时查看日志
docker compose logs -f backend

# 查看特定时间的日志
docker compose logs --since 2024-01-01T00:00:00 backend
```

### 日志过滤

```bash
# 只查看错误日志
docker compose logs backend | grep ERROR

# 查看包含特定关键词的日志
docker compose logs backend | grep "database"
```

---

## 📚 相关文档

- [环境配置](/deployment/config/environment)
- [后端开发](/development/guide/backend)
- [Admin 前端开发](/development/guide/frontend-admin)
