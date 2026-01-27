---
layout: home

hero:
  name: "CatWiki"
  # text: "万象在握，知几随行"
  tagline: 企业级 AI 知识库平台
  image:
    src: /logo.png
    alt: CatWiki
  actions:
    - theme: brand
      text: 快速开始
      link: /development/start/quick-start
    - theme: alt
      text: GitHub
      link: https://github.com/bulolo/CatWiki

features:
  - icon:
      src: /icons/rocket.svg
    title: 极速启动
    details: 基于 Docker Compose，一条命令即可初始化全套服务，开箱即用。
  
  - icon:
      src: /icons/brain.svg
    title: 智能问答
    details: 内置 RAG 引擎，基于私有知识库进行 AI 对话，准确且可控。
  
  - icon:
      src: /icons/layout.svg
    title: 双端分离
    details: 独立的管理后台与用户端应用，架构清晰，易于扩展和维护。
  
  - icon:
      src: /icons/layers.svg
    title: 现代技术
    details: FastAPI, Next.js 14, SQLAlchemy 2.0 - 全栈类型安全，开发体验极佳。
---

<script setup>
import { ref, onMounted } from 'vue'

const links = ref({
  admin: 'http://admin.catwiki.cn',
  client: 'http://demo.catwiki.cn/medical',
  api: 'http://api.catwiki.cn/docs',
  docs: 'http://docs.catwiki.cn'
})

onMounted(() => {
  // Checks if running on localhost (dev environment)
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    links.value = {
      admin: 'http://localhost:8001',
      client: 'http://localhost:8002/medical',
      api: 'http://localhost:3000/docs',
      docs: 'http://localhost:8003'
    }
  }
})
</script>

<div class="home-content">

## 快速启动

<div class="code-block-wrapper">

::: code-group

```bash [🛠️ 开发环境]
git clone https://github.com/bulolo/CatWiki.git
cd catWiki 

# 1. 初始化配置
make dev-init

# 2. 启动服务 (需先修改 .env 配置)
make dev-up
```

```bash [🚀 生产部署]
git clone https://github.com/bulolo/CatWiki.git
cd catWiki

# 1. 初始化生产配置
make prod-init

# 2. 修改配置 (deploy/docker/.env.*)
# vim deploy/docker/.env.backend

# 3. 后台启动
make prod-up
```

:::

</div>

<div class="service-grid">
  <a :href="links.admin" class="service-item" target="_blank">
    <div class="icon-box">
      <svg class="service-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="m16 15-3-3 3-3"/></svg>
    </div>
    <div class="service-info">
      <strong>管理后台</strong>
      <span>:8001</span>
    </div>
  </a>
  <a :href="links.client" class="service-item" target="_blank">
    <div class="icon-box">
      <svg class="service-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    </div>
    <div class="service-info">
      <strong>用户端</strong>
      <span>:8002</span>
    </div>
  </a>
  <a :href="links.api" class="service-item" target="_blank">
    <div class="icon-box">
      <svg class="service-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 12a1 1 0 0 0-1 1v1a1 1 0 0 1-1 1 1 1 0 0 1 1 1v1a1 1 0 0 0 1 1"/><path d="M14 18a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1 1 1 0 0 1-1-1v-1a1 1 0 0 0-1-1"/></svg>
    </div>
    <div class="service-info">
      <strong>API文档</strong>
      <span>:3000/docs</span>
    </div>
  </a>
  <a :href="links.docs" class="service-item" target="_blank">
    <div class="icon-box">
      <svg class="service-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/></svg>
    </div>
    <div class="service-info">
      <strong>技术文档</strong>
      <span>:8003</span>
    </div>
  </a>
</div>

## 界面预览

<div class="screenshot-grid">
  <figure>
    <div class="img-wrapper">
      <img src="/images/screenshots/1.png" alt="运营概览">
    </div>
    <figcaption>运营概览</figcaption>
  </figure>
  <figure>
    <div class="img-wrapper">
      <img src="/images/screenshots/2.png" alt="文档编辑">
    </div>
    <figcaption>文档编辑</figcaption>
  </figure>
  <figure>
    <div class="img-wrapper">
      <img src="/images/screenshots/3.png" alt="用户管理">
    </div>
    <figcaption>用户管理</figcaption>
  </figure>
  <figure>
    <div class="img-wrapper">
      <img src="/images/screenshots/4.png" alt="系统设置">
    </div>
    <figcaption>系统设置</figcaption>
  </figure>
  <figure>
    <div class="img-wrapper">
      <img src="/images/screenshots/5.png" alt="AI对话">
    </div>
    <figcaption>AI对话</figcaption>
  </figure>
</div>

## 技术栈

<div class="tech-grid">
  <div class="tech-group">
    <div class="tech-header">
      <div class="tech-icon-box">
        <svg class="tech-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/></svg>
      </div>
      <h4>后端服务</h4>
    </div>
    <div class="tags">
      <span>FastAPI</span><span>PostgreSQL</span><span>SQLAlchemy 2.0</span><span>Celery</span>
    </div>
  </div>
  <div class="tech-group">
    <div class="tech-header">
      <div class="tech-icon-box">
        <svg class="tech-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
      </div>
      <h4>前端应用</h4>
    </div>
    <div class="tags">
      <span>Next.js 14</span><span>TypeScript</span><span>Tailwind CSS</span><span>Vercel AI SDK</span>
    </div>
  </div>
  <div class="tech-group">
    <div class="tech-header">
      <div class="tech-icon-box">
        <svg class="tech-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12.5V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h7.5"/><path d="m22 22-1.5-1.5"/><circle cx="19" cy="19" r="3"/><path d="M12 12v.01"/></svg>
      </div>
      <h4>基础设施</h4>
    </div>
    <div class="tags">
      <span>Docker</span><span>MinIO/RustFS</span><span>PGVector</span><span>Nginx</span>
    </div>
  </div>
</div>
</div>

<style>
/* 容器 - 紧凑布局 */
.home-content {
  max-width: 1152px;
  margin: 0 auto;
  padding: 2rem 24px 2rem; /* 减小底部间距 */
}

/* 标题优化 - 减小上方间距 */
.home-content h2 {
  margin-top: 2.5rem;
  margin-bottom: 1.25rem;
  font-size: 1.5rem;
  font-weight: 600;
  border-bottom: 1px solid var(--vp-c-divider);
  padding-bottom: 0.5rem;
  color: var(--vp-c-text-1);
  line-height: 1.4;
}

/* 代码块间距 */
.code-block-wrapper {
  margin-bottom: 1.5rem;
}

/* 服务卡片 - 网格优化 */
.service-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); /* 减小最小宽度，适应更多尺寸 */
  gap: 1rem; /* 减小间距 */
}

.service-item {
  display: flex;
  align-items: center;
  padding: 1rem;
  background: var(--vp-c-bg-soft);
  border: 1px solid transparent; 
  border-radius: 12px;
  text-decoration: none !important;
  transition: all 0.2s ease;
}

.service-item:hover {
  transform: translateY(-2px);
  background: var(--vp-c-bg-elv);
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}

.icon-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: var(--vp-c-brand-soft);
  border-radius: 8px;
  margin-right: 0.75rem;
  color: var(--vp-c-brand-1);
}

.service-icon {
  width: 20px;
  height: 20px;
}

.service-info {
  display: flex;
  flex-direction: column;
}

.service-info strong {
  color: var(--vp-c-text-1);
  font-size: 0.95rem;
  font-weight: 600;
}

.service-info span {
  color: var(--vp-c-text-2);
  font-family: var(--vp-font-family-mono);
  font-size: 0.8rem;
}

/* 截图微调 - 响应式优化 */
.screenshot-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); /* 适配小屏手机 */
  gap: 1.5rem;
}

.img-wrapper {
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  border: 1px solid var(--vp-c-divider);
  transition: border-color 0.3s ease;
  background: var(--vp-c-bg-soft); /* 防止图片未加载时背景突兀 */
}

.img-wrapper:hover {
  border-color: var(--vp-c-brand-1);
}

.screenshot-grid img {
  width: 100%;
  height: auto;
  display: block;
}

.screenshot-grid figcaption {
  margin-top: 0.5rem;
  font-size: 0.9rem;
  color: var(--vp-c-text-2);
  text-align: center;
}

/* 技术栈 - 间距优化 */
.tech-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  padding: 1.5rem 0;
  border-bottom: 1px dashed var(--vp-c-divider);
}

.tech-group {
  padding: 0.25rem;
}

.tech-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.tech-icon-box {
  width: 32px;
  height: 32px;
  background: var(--vp-c-bg-soft);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--vp-c-text-1);
}

.tech-group h4 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tags span {
  font-size: 0.75rem;
  padding: 0.25rem 0.6rem;
  background: var(--vp-c-bg-soft);
  border-radius: 4px; /* 改为微圆角，更现代紧凑 */
  color: var(--vp-c-text-2);
  border: 1px solid transparent;
  transition: all 0.2s;
}

.tags span:hover {
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  border-color: var(--vp-c-brand-1);
}



@media (max-width: 640px) {
  .home-content {
    padding: 1.5rem 1rem 3rem;
  }
  
  .home-content h2 {
    font-size: 1.35rem;
    margin-top: 2rem;
  }
  
  .screenshot-grid {
    grid-template-columns: 1fr; /* 移动端单列 */
    gap: 1rem;
  }
}
</style>
