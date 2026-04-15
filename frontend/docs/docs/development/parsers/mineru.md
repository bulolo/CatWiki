# MinerU 解析器

MinerU 是一款高质量的文档解析工具，专注于复杂版面文档的精准解析。它在学术论文、技术手册、扫描件等场景中表现出色。CatWiki 正式集成了 MinerU 作为高性能解析后端。

> [!IMPORTANT]
> **版本要求：MinerU >= 3.0.0**
> CatWiki 依赖 MinerU 3.0 引入的 `/health` 接口和 Word 文档支持。请确保部署的 MinerU 版本 >= 3.0.0。
> 可通过访问 `http://<mineru-ip>:8000/health` 确认，返回 `{"status":"healthy","version":"3.x.x",...}` 即为正确版本。
>
> **当前验证版本：3.0.9**
> CatWiki 当前已在 MinerU **3.0.9** 上完成集成测试，推荐部署此版本。

## 支持的文件格式

| 格式 | 说明 |
|------|------|
| PDF | 原生 PDF 及扫描件 |
| Word (.docx/.doc) | 需要 MinerU >= 3.0.0 |
| Image (.jpg/.jpeg/.png/.webp/.tiff) | 图片直接 OCR 解析 |

## 环境要求

在部署 MinerU Docker 之前，请确保您的设备满足以下条件：

- **硬件**：包含 Volta 及以后架构的 NVIDIA 显卡（如 RTX 20/30/40 系列），且可用显存 > 8G。
- **驱动**：物理机显卡驱动应支持 CUDA 12.8 或更高版本（可通过 `nvidia-smi` 检查）。
- **软件**：已安装 Docker 和 Docker Compose。

## 获取镜像

MinerU 官方推荐通过 Dockerfile 自行构建镜像以确保环境兼容性：

```bash
# 下载 Dockerfile
wget https://raw.githubusercontent.com/opendatalab/MinerU/master/docker/china/Dockerfile
# 构建镜像
docker build -t mineru:latest -f Dockerfile .
```

> [!TIP]
> 默认 Dockerfile 使用 `vllm/vllm-openai` 作为基础镜像。如果您在 Volta、Turing 或 Blackwell 架构显卡上遇到推理加速问题，建议将基础镜像版本更新为 `v0.11.0`。

## 部署服务

### Docker Compose 部署 (推荐)

MinerU 官方提供了包含多个服务配置的 `compose.yaml` 文件，您可以通过指定 `profile` 来启动所需的服务。

1. **获取官方配置文件**：

   ```bash
   wget https://raw.githubusercontent.com/opendatalab/MinerU/master/docker/compose.yaml
   ```

2. **启动 Web API 服务**：
   CatWiki 使用 MinerU 的 Web API 进行集成。执行以下命令启动：

   ```bash
   docker compose -f compose.yaml --profile api up -d
   ```

3. **验证部署**：
   访问 `http://<server-ip>:8000/health`，返回 `{"status":"healthy","version":"3.x.x"}` 说明服务已正常运行。

### Docker Compose 配置参考

以下是完整的 `compose.yaml` 配置示例，包含三种服务模式：

```yaml
services:
  # OpenAI 兼容 API 服务
  mineru-openai-server:
    image: mineru:latest
    container_name: mineru-openai-server
    restart: always
    profiles: ["openai-server"]
    ports:
      - 30000:30000
    environment:
      MINERU_MODEL_SOURCE: local
    entrypoint: mineru-openai-server
    command:
      --host 0.0.0.0
      --port 30000
      # --data-parallel-size 2  # 多 GPU 并行模式
      # --gpu-memory-utilization 0.5  # 显存不足时降低 KV cache
    ulimits:
      memlock: -1
      stack: 67108864
    ipc: host
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:30000/health || exit 1"]
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              device_ids: ["0"]  # 多 GPU: ["0", "1"]
              capabilities: [gpu]

  # Web API 服务 (CatWiki 集成使用)
  mineru-api:
    image: mineru:latest
    container_name: mineru-api
    restart: always
    profiles: ["api"]
    ports:
      - 8001:8000
    environment:
      MINERU_MODEL_SOURCE: local
    entrypoint: mineru-api
    command:
      --host 0.0.0.0
      --port 8000
      # --data-parallel-size 2  # 多 GPU 并行模式
      # --gpu-memory-utilization 0.5  # 显存不足时降低 KV cache
    ulimits:
      memlock: -1
      stack: 67108864
    ipc: host
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              device_ids: ["0"]
              capabilities: [gpu]

  # Gradio Web 界面
  mineru-gradio:
    image: mineru:latest
    container_name: mineru-gradio
    restart: always
    profiles: ["gradio"]
    ports:
      - 7860:7860
    environment:
      MINERU_MODEL_SOURCE: local
    entrypoint: mineru-gradio
    command:
      --server-name 0.0.0.0
      --server-port 7860
      # --enable-api false  # 禁用 API
      # --max-convert-pages 20  # 限制转换页数
      # --data-parallel-size 2  # 多 GPU 并行
      # --gpu-memory-utilization 0.5  # 显存不足时调整
    ulimits:
      memlock: -1
      stack: 67108864
    ipc: host
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              device_ids: ["0"]
              capabilities: [gpu]
```

> [!TIP]
> CatWiki 使用 `api` profile，启动命令为：`docker compose --profile api up -d`


## CatWiki 集成配置

部署完成后，在 CatWiki 管理后台进行如下配置：

1. 进入 **设置** → **文档解析**
2. 点击 **添加解析器**
3. 填写配置：
   - **名称**：`MinerU` (可自定义)
   - **类型**：选择 `MinerU`
   - **API 端点**：`http://<mineru-ip>:8000` (如果同机部署可填 `http://localhost:8000`)
4. 点击 **测试连接**。
5. 启用并保存。

## 适用场景

MinerU 特别适合以下场景：

- 📚 **学术论文**：复杂版面、多栏排版、公式图表精准识别。
- 📋 **技术手册**：保留结构化内容，支持多层目录。
- 🖼️ **图文混排**：支持提取文档图片并生成公开链接，供 AI 直接引用。
- 📊 **复杂表格**：能够保留表格逻辑结构。

## 性能表现

| 配置 | 核心技术 | 适用场景 |
| :--- | :--- | :--- |
| **GPU (RTX 4090)** | vLLM 加速 | 大批量、秒级响应 |
| **GPU (RTX 3060)** | vLLM 加速 | 中等规模、高性能 |
| **CPU 模式** | 基础 OCR | 仅建议测试或小文件处理 |

## 常见问题

### Q: 启动报显存不足？
MinerU 默认使用 vLLM 推理框架，该框架会预分配显存。请确保在启动 `api` 服务时，没有其他大型模型（如本地 LLM）占用过多显存。

### Q: 如何切换 OCR 语言？
在管理后台 **设置** → **文档解析** → 编辑解析器，可在"识别语言"中选择需要的语言（支持中文、英文、日文、韩文等多种语言）。默认已选中中文和英文。

## 相关链接

- [MinerU 官方部署文档](https://opendatalab.github.io/MinerU/zh/quick_start/docker_deployment/)
- [MinerU Docker Compose 部署](https://opendatalab.github.io/MinerU/zh/quick_start/docker_deployment/#docker-compose)
- [MinerU GitHub 仓库](https://github.com/opendatalab/MinerU)

