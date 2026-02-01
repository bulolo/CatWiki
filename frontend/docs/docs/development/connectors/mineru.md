# MinerU 连接器

MinerU 是一款高质量的文档解析工具，专注于复杂版面文档的精准解析。它在学术论文、技术手册、扫描件等场景中表现出色。

## 功能特性

- ✅ 高精度版面分析
- ✅ 复杂表格结构识别
- ✅ 公式、图表智能提取
- ✅ 扫描件 OCR 支持
- ✅ 多语言文档处理
- ✅ 支持 GPU 加速

## 部署方式

### Docker Compose 部署（推荐）

创建 `docker-compose.yml`：

```yaml
version: '3.8'
services:
  mineru:
    image: opendatalab/mineru:latest
    ports:
      - "5001:5001"
    volumes:
      - ./data:/data
    environment:
      - CUDA_VISIBLE_DEVICES=0  # GPU 编号，无 GPU 可移除
    restart: unless-stopped
    # 如有 GPU
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
```

启动服务：

```bash
docker compose up -d
```

### CPU 模式部署

如果没有 GPU，可使用 CPU 模式（速度较慢）：

```yaml
services:
  mineru:
    image: opendatalab/mineru:latest-cpu
    ports:
      - "5001:5001"
    volumes:
      - ./data:/data
    restart: unless-stopped
```

## 配置连接器

1. 进入 **设置** → **文档解析**
2. 点击 **添加解析器**
3. 填写配置：
   - **名称**：`MinerU 解析器`
   - **类型**：选择 `MinerU`
   - **API 端点**：`http://localhost:5001`
4. 点击 **测试连接**
5. 启用并保存

## API 接口说明

MinerU 提供标准的 REST API：

```bash
# 解析文档
curl -X POST http://localhost:5001/parse \
  -F "file=@document.pdf" \
  -H "Content-Type: multipart/form-data"
```

### 解析选项

```bash
curl -X POST http://localhost:5001/parse \
  -F "file=@document.pdf" \
  -F "options={\"ocr_lang\": \"chi_sim\", \"layout_analysis\": true}"
```

支持的选项：
| 参数 | 说明 | 默认值 |
|------|------|--------|
| `ocr_lang` | OCR 语言 | `chi_sim+eng` |
| `layout_analysis` | 启用版面分析 | `true` |
| `table_recognition` | 启用表格识别 | `true` |

## 适用场景

MinerU 特别适合以下场景：

- 📚 **学术论文**：复杂版面、多栏排版、公式图表
- 📋 **技术手册**：结构化内容、多层目录
- 🖼️ **扫描件**：需要高精度 OCR
- 📊 **财务报表**：复杂表格解析

## 性能说明

| 配置 | 单页解析时间 | 适用场景 |
|------|-------------|----------|
| CPU | 5-15 秒 | 小批量、低频使用 |
| GPU (RTX 3060) | 1-3 秒 | 中等规模 |
| GPU (RTX 4090) | < 1 秒 | 大批量、高频使用 |

## 常见问题

### Q: 解析结果中表格错位？

可能是版面过于复杂，建议：
- 确保源文档清晰
- 调整 `table_recognition` 参数
- 尝试使用 Docling 作为备选

### Q: GPU 内存不足？

减少并发处理数量，或使用更大显存的 GPU。

### Q: 中文识别不准确？

确保 OCR 语言设置正确：
```json
{"ocr_lang": "chi_sim"}
```

## 相关链接

- [MinerU 官方文档](https://opendatalab.github.io/MinerU/)
- [MinerU GitHub](https://github.com/opendatalab/MinerU)
