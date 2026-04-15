# PaddleOCR 解析器

PaddleOCR 是百度开源的 OCR 引擎，提供强大的文字识别能力。它支持多种语言，特别在中文识别方面表现优异。

## 功能特性

- ✅ 业界领先的中文 OCR 识别率
- ✅ 支持 80+ 语言识别
- ✅ 手写体识别
- ✅ 表格结构识别
- ✅ 版面分析能力
- ✅ 轻量级模型可选

## 部署方式

### PaddleOCR-VL NVIDIA GPU 部署（推荐）

> [!IMPORTANT]
> 当前部署的模型版本为 **PaddleOCR-VL-1.5-0.9B**

PaddleOCR-VL 提供更强的视觉语言模型能力，推荐使用 Docker Compose 配合 NVIDIA GPU 部署。

#### 环境变量配置

[.env](https://github.com/PaddlePaddle/PaddleOCR/blob/main/deploy/paddleocr_vl_docker/accelerators/nvidia-gpu/.env)

```bash
API_IMAGE_TAG_SUFFIX=latest-nvidia-gpu-offline
VLM_BACKEND=vllm
VLM_IMAGE_TAG_SUFFIX=latest-nvidia-gpu-offline

# 模型下载源（可选，国内用户推荐使用 BOS）
# PADDLE_PDX_MODEL_SOURCE=bos
```

#### vLLM 配置文件

创建 `vllm_config.yaml`：

```yaml
max-model-len: 8192
gpu-memory-utilization: 0.3
enforce-eager: true
```

| 参数 | 说明 |
|------|------|
| `max-model-len` | 模型最大上下文长度 |
| `gpu-memory-utilization` | GPU 显存使用率（0.3 = 30%） |
| `enforce-eager` | 禁用 CUDA Graph，降低显存占用 |

#### Pipeline 配置文件

[pipeline_config_vllm.yaml](https://github.com/PaddlePaddle/PaddleOCR/blob/main/deploy/paddleocr_vl_docker/pipeline_config_vllm.yaml)

```yaml
pipeline_name: PaddleOCR-VL-1.5

batch_size: 64
use_queues: True
use_doc_preprocessor: False
use_layout_detection: True
use_chart_recognition: False
use_seal_recognition: False
format_block_content: False
merge_layout_blocks: True

markdown_ignore_labels:
  - number
  - footnote
  - header
  - header_image
  - footer
  - footer_image
  - aside_text

SubModules:
  LayoutDetection:
    module_name: layout_detection
    model_name: PP-DocLayoutV3
    batch_size: 8
    threshold: 0.3
    layout_nms: True

  VLRecognition:
    module_name: vl_recognition
    model_name: PaddleOCR-VL-1.5-0.9B
    batch_size: 4096
    genai_config:
      backend: vllm-server
      server_url: http://paddleocr-vlm-server:8080/v1
```

| 参数 | 说明 |
|------|------|
| `use_layout_detection` | 启用版面检测 |
| `use_doc_preprocessor` | 启用文档预处理（方向校正、去畸变） |
| `markdown_ignore_labels` | Markdown 输出时忽略的标签类型 |
| `server_url` | VLM 服务地址，需与 compose 中服务名一致 |

#### Docker Compose 配置

[compose.yaml](https://github.com/PaddlePaddle/PaddleOCR/blob/main/deploy/paddleocr_vl_docker/accelerators/nvidia-gpu/compose.yaml)

```yaml
services:
  paddleocr-vl-api:
    image: ccr-2vdh3abv-pub.cnc.bj.baidubce.com/paddlepaddle/paddleocr-vl:${API_IMAGE_TAG_SUFFIX}
    container_name: paddleocr-vl-api
    ports:
      - 8003:8080
    depends_on:
      paddleocr-vlm-server:
        condition: service_healthy
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              device_ids: ["0"]
              capabilities: [gpu]
    # TODO: Allow using a regular user
    user: root
    restart: unless-stopped
    environment:
      - VLM_BACKEND=${VLM_BACKEND:-vllm}
    command: /bin/bash -c "paddlex --serve --pipeline /home/paddleocr/pipeline_config_${VLM_BACKEND}.yaml"
    volumes:
      - ./pipeline_config_vllm.yaml:/home/paddleocr/pipeline_config_vllm.yaml
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:8080/health || exit 1"]

  paddleocr-vlm-server:
    image: ccr-2vdh3abv-pub.cnc.bj.baidubce.com/paddlepaddle/paddleocr-genai-${VLM_BACKEND}-server:${VLM_IMAGE_TAG_SUFFIX}
    container_name: paddleocr-vlm-server
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              device_ids: ["0"]
              capabilities: [gpu]
    # TODO: Allow using a regular user
    user: root
    restart: unless-stopped
    command:
      - paddlex_genai_server
      - --model_name=PaddleOCR-VL-1.5-0.9B
      - --host=0.0.0.0
      - --port=8080
      - --backend=vllm
      - --backend_config=/opt/vllm_config.yaml
    volumes:
      # - ./.paddlex:/root/.paddlex
      - ./vllm_config.yaml:/opt/vllm_config.yaml
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:8080/health || exit 1"]
      start_period: 300s
```

#### GPU 配置说明

| 参数 | 说明 | 示例 |
|------|------|------|
| `device_ids` | 指定 GPU 设备 ID | `["0"]` 使用第一张卡，`["0", "1"]` 使用多卡 |
| `capabilities` | GPU 能力 | `[gpu]` 启用 GPU 支持 |
| `count` | GPU 数量 | `all` 使用所有可用 GPU |

#### 启动服务

```bash
# 启动所有服务
docker compose up -d

# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f paddleocr-vl-api
```


> [!TIP]
> **GPU 内存不足？** 可以通过修改 `vllm_config.yaml` 中的 `gpu-memory-utilization` 参数来限制 vLLM 的显存使用率。

## 配置解析器

1. 进入 **设置** → **文档解析**
2. 点击 **添加解析器**
3. 填写配置：
   - **名称**：`PaddleOCR`
   - **类型**：选择 `PaddleOCR`
   - **API 端点**：`http://localhost:8003` (docker-compose 映射端口)
4. 点击 **测试连接**
5. 启用并保存

## API 接口说明

CatWiki 集成使用 `/layout-parsing` 接口，传入 base64 编码的文件内容：

```bash
curl -X POST http://localhost:8003/layout-parsing \
  -H "Content-Type: application/json" \
  -d '{
    "file": "<base64_encoded_content>",
    "fileType": 0,
    "useLayoutDetection": true,
    "prettifyMarkdown": true,
    "mergeTables": true
  }'
```

| `fileType` | 说明 |
|---|---|
| `0` | PDF 文件 |
| `1` | 图片文件 |

## 适用场景

PaddleOCR 特别适合以下场景：

- 📷 **扫描件识别**：老旧文档、历史档案
- 🖼️ **图片文字提取**：截图、照片中的文字
- 📝 **手写体识别**：手写笔记、表单
- 🌏 **多语言文档**：中英混排、多语种内容

## 模型说明

CatWiki 集成使用 **PaddleOCR-VL-1.5-0.9B** 视觉语言模型，基于 vLLM 推理框架，支持中英文及多语言文档的版面分析和内容提取。该模型无需手动指定语言，由 VLM 自动识别。

## 常见问题

### Q: 识别率不够高？

尝试以下方案：
- 提高图片分辨率（建议 DPI ≥ 200）
- 调整图片对比度
- 确保 GPU 显存充足（建议 > 8G）

### Q: 服务启动慢？

PaddleOCR-VL 首次启动需要加载 VLM 模型，通常需要 3-5 分钟。可通过 `docker compose logs -f paddleocr-vlm-server` 查看加载进度。

## 相关链接

- [PaddleOCR 官方文档](https://www.paddleocr.ai/)
- [PaddleOCR-VL Docker Compose 部署](https://www.paddleocr.ai/latest/version3.x/pipeline_usage/PaddleOCR-VL.html#41-docker-compose)
- [PaddleOCR GitHub](https://github.com/PaddlePaddle/PaddleOCR)
