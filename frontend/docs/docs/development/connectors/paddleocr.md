# PaddleOCR 连接器

PaddleOCR 是百度开源的 OCR 引擎，提供强大的文字识别能力。它支持多种语言，特别在中文识别方面表现优异。

## 功能特性

- ✅ 业界领先的中文 OCR 识别率
- ✅ 支持 80+ 语言识别
- ✅ 手写体识别
- ✅ 表格结构识别
- ✅ 版面分析能力
- ✅ 轻量级模型可选

## 部署方式

### Docker Compose 部署（推荐）

创建 `docker-compose.yml`：

```yaml
version: '3.8'
services:
  paddleocr:
    image: paddlecloud/paddleocr:latest
    ports:
      - "8868:8868"
    environment:
      - LANG=C.UTF-8
    volumes:
      - ./models:/root/.paddleocr
    restart: unless-stopped
    # GPU 支持
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

### PaddleOCR-VL 版本

如需更强的版面分析能力，可使用 VL 版本：

```yaml
services:
  paddleocr-vl:
    image: paddlecloud/paddleocr-vl:latest
    ports:
      - "8868:8868"
    # ...
```

## 配置连接器

1. 进入 **设置** → **文档解析**
2. 点击 **添加解析器**
3. 填写配置：
   - **名称**：`PaddleOCR`
   - **类型**：选择 `PaddleOCR`
   - **API 端点**：`http://localhost:8868`
4. 点击 **测试连接**
5. 启用并保存

## API 接口说明

```bash
# 图片 OCR
curl -X POST http://localhost:8868/predict/ocr_system \
  -F "image=@image.png"

# 文档解析
curl -X POST http://localhost:8868/predict/layout_analysis \
  -F "file=@document.pdf"
```

### 识别模式

| 模式 | API 路径 | 说明 |
|------|----------|------|
| 通用 OCR | `/predict/ocr_system` | 纯文字识别 |
| 版面分析 | `/predict/layout_analysis` | 文档结构分析 |
| 表格识别 | `/predict/table_recognition` | 表格提取 |

## 语言支持

PaddleOCR 支持多种语言，常用语言代码：

| 语言 | 代码 |
|------|------|
| 简体中文 | `ch` |
| 繁体中文 | `chinese_cht` |
| 英语 | `en` |
| 日语 | `japan` |
| 韩语 | `korean` |

使用方式：
```bash
curl -X POST http://localhost:8868/predict/ocr_system \
  -F "image=@image.png" \
  -F "lang=ch"
```

## 适用场景

PaddleOCR 特别适合以下场景：

- 📷 **扫描件识别**：老旧文档、历史档案
- 🖼️ **图片文字提取**：截图、照片中的文字
- 📝 **手写体识别**：手写笔记、表单
- 🌏 **多语言文档**：中英混排、多语种内容

## 模型选择

PaddleOCR 提供多种模型规格：

| 模型 | 大小 | 精度 | 速度 | 适用场景 |
|------|------|------|------|----------|
| PP-OCRv4 | 小 | 高 | 快 | 通用场景 |
| PP-OCRv3 | 中 | 中 | 中 | 平衡方案 |
| PP-Structure | 大 | 最高 | 慢 | 复杂版面 |

## 常见问题

### Q: 识别率不够高？

尝试以下方案：
- 提高图片分辨率（建议 DPI ≥ 200）
- 调整图片对比度
- 使用预处理去噪

### Q: 中英文混排识别问题？

使用多语言模型：
```bash
-F "lang=ch,en"
```

### Q: 竖排文字识别不正确？

启用方向检测：
```bash
-F "use_angle_cls=true"
```

## 相关链接

- [PaddleOCR 官方文档](https://www.paddleocr.ai/)
- [PaddleOCR GitHub](https://github.com/PaddlePaddle/PaddleOCR)
