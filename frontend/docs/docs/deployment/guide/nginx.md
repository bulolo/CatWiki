# Nginx 反向代理配置指南

在生产环境中，我们强烈建议即使使用 Docker，也要在宿主机（或独立的 Nginx 容器）中使用 Nginx 作为统一的反向代理入口，以处理 SSL 卸载、Gzip 压缩和跨域头。

## 📋 快速开始

项目提供了一个标准模板：`deploy/nginx/catwiki.conf`。

1.  **准备证书**：将 SSL 证书 (pem/key) 放置在服务器的 `/etc/nginx/ssl/` 目录下。
2.  **配置域名**：修改配置文件中的 `server_name` 为您自己的二级域名。
3.  **应用配置**：
    ```bash
    cp deploy/nginx/catwiki.conf /etc/nginx/conf.d/
    nginx -t
    systemctl reload nginx
    ```

## 📝 配置示例

以下是推荐的 Nginx 完整配置示例（同步自 `deploy/nginx/catwiki.conf`），涵盖了管理后台、展示端、API、文档及对象存储：

```nginx
# ==============================================================================
# CatWiki Nginx 生产环境主配置文件 (优化版)
# ==============================================================================

# 1. 全局基础配置
# ------------------------------------------------------------------------------
# 通用代理头
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Port $server_port;

# 安全响应头
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;

# Gzip 压缩优化
gzip on;
gzip_proxied any;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
gzip_comp_level 6;

# 2. 统一 HTTP (80) 强制跳转 HTTPS
# ------------------------------------------------------------------------------
server {
    listen 80;
    server_name admin.catwiki.cn catwiki.cn docs.catwiki.cn api.catwiki.cn files.catwiki.cn;
    return 301 https://$host$request_uri;
}

# 3. SSL 共享配置模板 (通常在 nginx.conf 中定义，这里为了演示直接写在 block 中)
# ------------------------------------------------------------------------------
# 如果是多个 server 共用证书，建议抽取。这里假设各子域名共用通配符证书。

# 4. 各服务配置块
# ------------------------------------------------------------------------------

# [Admin Dashboard]
server {
    listen 443 ssl http2;
    server_name admin.catwiki.cn;

    ssl_certificate     /etc/nginx/ssl/fullchain.pem; # 需替换为实际证书路径
    ssl_certificate_key /etc/nginx/ssl/privkey.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://127.0.0.1:8001;
    }
}

# [Client App / Demo]
server {
    listen 443 ssl http2;
    server_name catwiki.cn;

    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.key;

    location / {
        proxy_pass http://127.0.0.1:8002;
    }
}

# [Documentation]
server {
    listen 443 ssl http2;
    server_name docs.catwiki.cn;

    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.key;

    location / {
        proxy_pass http://127.0.0.1:8003;
    }
}

# [Backend API]
server {
    listen 443 ssl http2;
    server_name api.catwiki.cn;

    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.key;

    # AI 生成长连接响应优化
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
    
    # 对 API 响应禁用缓冲，支持 SSE (Server-Sent Events)
    proxy_buffering off;

    location / {
        proxy_pass http://127.0.0.1:3000;
        
        # 兼容旧配置中的遥测包含 (如有)
        # include /home/docker/catWiki/telemetry-backend/nginx/telemetry.conf;
    }
}

# [OSS / RustFS Storage]
server {
    listen 443 ssl http2;
    server_name files.catwiki.cn;

    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.key;

    # 允许上传 100MB 以内的文件
    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:9000;
        
        # 存储专属优化：完全禁用缓冲以提升大文件吞吐，并减少本地磁盘 IO
        proxy_buffering off;
        proxy_request_buffering off;
        
        # 超时设置
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
}

```

## 🏗️ 核心配置解析

### 1. SSL 与 安全加固
- **HSTS**: 启用了 `Strict-Transport-Security`，强制浏览器在接下来一年内仅通过 HTTPS 访问。
- **安全头**: 增加了 `X-Frame-Options`, `X-Content-Type-Options` 等标准安全头，防范点击劫持和 MIME 类型探测攻击。

### 2. 性能优化
- **Gzip 压缩**: 对 JS, CSS, JSON 等文本资源开启了 Gzip 压缩，大幅减少传输体积。
- **SSE (AI 流式响应) 支持**: 针对 API 服务禁用了 `proxy_buffering`，并调大超时时间，确保 AI 的打字机效果能实时、不间断地传达给前端。

### 3. 对象存储 (RustFS) 优化
- **`proxy_request_buffering off`**: 配合 `client_max_body_size`，支持大文档在上传过程中直接流向存储后端，不占用 Nginx 临时磁盘空间。

## ❓ 常见问题

### 1. 出现 413 Request Entity Too Large
请检查 `catwiki.conf` 中的 `client_max_body_size` 是否设置得足够大，并确保没有被 Nginx 全局配置 (`nginx.conf`) 中的更小数值覆盖。

### 2. S3 签名校验失败
RustFS 是 S3 兼容的，如果您在前端使用 AWS SDK 时报错，请确保 `X-Forwarded-Port` 已正确传递给后端。

### 3. 查看实时访问日志
```bash
tail -f /var/log/nginx/access.log
```
