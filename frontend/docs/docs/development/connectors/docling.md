# Docling 连接器

Docling 是 IBM 开源的文档处理引擎，专为企业级文档解析设计。它支持 PDF、Word、PPT 等多种格式，并能很好地处理表格、公式等复杂元素。

## 功能特性

- ✅ 支持 PDF、DOCX、PPTX、HTML 等格式
- ✅ 智能表格识别与提取
- ✅ 数学公式解析
- ✅ 多语言 OCR 支持
- ✅ 轻量级，易于部署
- ✅ 提供 REST API 接口

## 部署方式

### Docker Compose 部署（推荐）

创建 `docker-compose.yml`：

```yaml
version: '3.8'
services:
  docling-serve:
    image: quay.io/docling-project/docling-serve:latest
    ports:
      - "5000:5000"
    environment:
      - DOCLING_PDF_BACKEND=pdfium
    restart: unless-stopped
```

启动服务：

```bash
docker compose up -d
```

### Docker 直接运行

```bash
docker run -d \
  --name docling-serve \
  -p 5000:5000 \
  quay.io/docling-project/docling-serve:latest
```

## 配置连接器

1. 进入 **设置** → **文档解析**
2. 点击 **添加解析器**
3. 填写配置：
   - **名称**：`本地 Docling`
   - **类型**：选择 `Docling`
   - **API 端点**：`http://localhost:5000`（或实际部署地址）
4. 点击 **测试连接**
5. 启用并保存

## API 接口说明

Docling 提供标准的 REST API：

```bash
# 解析文档
curl -X POST http://localhost:5000/convert \
  -F "file=@document.pdf" \
  -o result.json
```

返回格式：
```json
{
  "document": {
    "pages": [...],
    "texts": [...],
    "tables": [...]
  }
}
```

## 性能调优

### 内存配置

对于大型文档，建议增加容器内存限制：

```yaml
services:
  docling-serve:
    # ...
    deploy:
      resources:
        limits:
          memory: 4G
```

### GPU 加速

如果需要使用 GPU 加速 OCR：

```yaml
services:
  docling-serve:
    # ...
    runtime: nvidia
    environment:
      - NVIDIA_VISIBLE_DEVICES=all
```

## 常见问题

### Q: 解析速度较慢？

可能原因：
- 文档页数过多
- 包含大量图片需要 OCR
- 容器资源不足

建议：
- 增加容器内存
- 启用 GPU 加速
- 对大文档进行分批处理

### Q: 表格识别不准确？

尝试以下方案：
- 确保文档清晰度足够
- 使用高质量扫描件
- 调整 OCR 参数

## 相关链接

- [Docling GitHub](https://github.com/docling-project/docling-serve)
- [Docling 官方文档](https://docling-project.github.io/docling/)
