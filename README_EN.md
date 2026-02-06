<div align="center">

# <img src="./frontend/docs/docs/public/logo.png" width="36" style="vertical-align: middle;"> CatWiki

**Enterprise-grade Knowledge Base Management System**

**Enterprise-grade full-stack AI knowledge base platform, integrating modern content management, deep AI-powered Q&A, and an ultimate user interaction experience.**

[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-14.0+-000000?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791?logo=postgresql)](https://www.postgresql.org/)


English | [简体中文](./README.md)

[Demo Site](https://demo.catwiki.ai) | [Admin Dashboard](https://admin.catwiki.ai) | [Documentation](https://docs.catwiki.ai)

<p>
  <a href="https://github.com/bulolo/CatWiki">
    <img src="https://img.shields.io/badge/⭐_Star-Project-yellow?style=for-the-badge&logo=github" alt="Star"/>
  </a>
</p>

**If this project helps you, please click the ⭐ Star in the top right corner to support us. This is the greatest encouragement for the developers!**

</div>

## 🚀 Recent Updates

> [!IMPORTANT]
> **Official Brand Domain is Live!**
> We have officially launched our flagship portal **[catwiki.ai](https://catwiki.ai)**. All demo, documentation, and management services are now accessible via the new domain. Please update your bookmarks!

### 2026-02-06 🔍 Full PaddleOCR Integration
- 🚀 **PaddleOCR Integration**: Deeply integrated Baidu's PaddleOCR engine, providing industry-leading recognition accuracy, especially for multi-language and complex documents.

### 2026-02-05 🎨 Branding & Visual Standardization
- 🚀 **Official Brand Domain**: Launched [catwiki.ai](https://catwiki.ai) official website and brand domain family.
- 🚀 **Public Document Images**: Automatically extract images during document parsing, upload to object storage, and generate public access links.
- 🖼️ **AI Image Responses**: Knowledge base Q&A supports text-image mixing, allowing AI to directly cite images from documents in answers.

### 2026-02-04 📄 Document Parsing Engine Integration
- 🚀 **MinerU Integration**: Deep integration with MinerU (Magic-PDF) high-quality parser.
- 📦 **Docling Integration**: Integrated IBM Docling parsing engine.
- 🔧 **Dynamic OCR Config**: Admin dashboard supports enabling/disabling OCR recognition per parser.

### 2026-02-01 🤖 LangGraph Agentic AI Transformation
- 🔧 **LangGraph Integration**: Refactored chat functionality using LangGraph 1.x.
- 🛠️ **RAG as Tool**: Encapsulated knowledge base retrieval into the `search_knowledge_base` tool.
- 🚦 **Intelligent Routing**: AI autonomously determines whether knowledge base lookup is required.

> [!TIP]
> **View Full Changelog**: Visit [CatWiki Changelog](https://docs.catwiki.ai/about/project/changelog) for the complete version history.

---

## 🎯 Highlights

- ✅ **Out-of-the-box**: One-click startup with Docker Compose, automatic database initialization and demo data loading.
- ✅ **Dual-end Architecture**: Independent Admin Dashboard and Client Side with clear responsibilities.
- ✅ **Type Safety**: Full use of TypeScript and Pydantic for robust type safety across frontend and backend.
- ✅ **Modern Tech Stack**: FastAPI + Next.js 14 + SQLAlchemy 2.0, utilizing the latest technologies.
- ✅ **AI Integration**: Built-in intelligent AI Q&A, Agentic RAG flow based on **LangGraph**.
- ✅ **Hot Reload**: Supports hot reloading for both frontend and backend in the development environment.
- ✅ **Auto-generated SDK**: Backend API changes automatically trigger TypeScript SDK generation.
- ✅ **Comprehensive Documentation**: Detailed API documentation and usage guides.

---

## 📸 Screenshots

### 🎯 Admin Dashboard

<table>
  <tr>
    <td width="50%">
      <img src="./frontend/docs/docs/public/images/screenshots/1.png" alt="Operational Overview">
      <p align="center"><b>Operational Overview</b><br>Real-time view of site status and key metrics</p>
    </td>
    <td width="50%">
      <img src="./frontend/docs/docs/public/images/screenshots/2.png" alt="Document Management">
      <p align="center"><b>Document Management</b><br>Hierarchical directory structure with batch operation support</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="./frontend/docs/docs/public/images/screenshots/3.png" alt="User Management">
      <p align="center"><b>User Management</b><br>Full user permission and role management</p>
    </td>
    <td width="50%">
      <img src="./frontend/docs/docs/public/images/screenshots/4.png" alt="System Settings">
      <p align="center"><b>System Settings</b><br>Flexible AI model configuration</p>
    </td>
  </tr>
</table>

### 💬 Client Side

<div align="center">
  <img src="./frontend/docs/docs/public/images/screenshots/5.png" alt="AI Intelligent Q&A" width="80%">
  <p><b>AI Intelligent Q&A</b> - Intelligent conversation assistant based on knowledge base content with context awareness</p>
</div>

---

## ✨ Core Features

### 🎯 Admin Dashboard
- **📝 Rich Text Editing**: Markdown-based document editor with real-time preview.
- **🗂️ Document Management**: Hierarchical directory structure with drag-and-drop sorting.
- **👥 User Management**: Comprehensive user permissions and role management.
- **🌐 Multi-site Support**: Manage multiple independent knowledge base sites.
- **🤖 AI Configuration**: Flexible AI model and bot configurations.

### 💬 Client Side
- **🔍 Intelligent Search**: Quickly find documents and content.
- **🤖 AI Q&A**: Intelligent dialogue assistant powered by your knowledge base.
- **📱 Responsive Design**: Perfectly adapted for both desktop and mobile.
- **🎨 Modern UI**: Elegant interface built with shadcn/ui.

---

## 🏗️ Technical Architecture

### Backend Stack
- **Framework**: FastAPI
- **AI Workflow**: LangGraph 1.x + LangChain
- **Database**: PostgreSQL + SQLAlchemy 2.0
- **Vector Search**: pgvector + langchain-postgres
- **Migration**: Alembic
- **Package Manager**: uv (High-performance Python package manager)
- **Auth**: JWT + PassLib
- **Python Version**: >= 3.10

### Frontend Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5.3+
- **Styling**: Tailwind CSS
- **Component Library**: shadcn/ui (based on Radix UI)
- **State Management**: React Hooks
- **Package Manager**: pnpm

### Key Libraries
- **Drag & Drop**: @dnd-kit/core + @dnd-kit/sortable (Admin)
- **Markdown Editor**: md-editor-rt (Admin)
- **Markdown Rendering**: streamdown (Client)
- **Notification**: Sonner (Common)

---

## 📁 Project Structure

```
catWiki/
├── backend/                      # 🐍 FastAPI Backend Service
│   ├── app/
│   │   ├── api/                 # API Routes (Admin/Client)
│   │   ├── core/                # Core Config, Middleware, Utils
│   │   ├── crud/                # Database CRUD Operations
│   │   ├── models/              # SQLAlchemy ORM Models
│   │   ├── schemas/             # Pydantic Validation Schemas
│   │   └── main.py              # Application Entry
│   ├── scripts/                 # Utility Scripts (Sync SDK, Init data)
│   ├── Dockerfile.dev           # Dev Dockerfile
│   └── pyproject.toml           # Dependency Management (uv)
│
├── frontend/
│   ├── admin/                   # 🎯 Admin Dashboard (Next.js, 8001)
│   ├── client/                  # 💬 Client Side (Next.js, 8002)
│   └── docs/                    # 📚 Documentation Site (VitePress, 8003)
│
├── deploy/                      # 🚀 Production Deployment
├── docker-compose.dev.yml       # One-click Dev environment
├── Makefile                      # Project Management Script
└── README.md                    # Project Main Documentation
```

### Core Directory Description

| Directory | Description | Tech Stack |
|------|------|--------|
| `backend/` | Backend API Service | FastAPI + PostgreSQL + SQLAlchemy |
| `frontend/admin/` | Admin Dashboard (Internal) | Next.js 14 + shadcn/ui + Tailwind |
| `frontend/client/` | Client Side (Public) | Next.js 14 + AI Q&A + Search |
| `frontend/docs/` | Documentation Site (Internal) | VitePress + Markdown |

---

---

## 🚀 Installation & Configuration

### Prerequisites

- **Docker** >= 20.10
- **Docker Compose** >= 2.0
- **Make** (Pre-installed or via package manager)

---

## ⚡ Quick Start (5 Minutes)

### 1. Download Project
```bash
# Clone the repository
git clone https://github.com/bulolo/CatWiki.git
cd catWiki
```

### 2. Start Environment (Choose one)

#### 🛠️ Development Environment
Suitable for local testing and code modifications. Supports hot reloading and debug logs.
```bash
# 1. Initialize local environment configuration (Only once)
make dev-init

# 2. Configure: Edit backend/.env and fill in OpenAI API Key etc.

# 3. Start environment
make dev-up
```

> [!WARNING]
> **About `make dev-init`**: It will recopy `.env` files from templates, which will overwrite your existing configuration. For subsequent starts, skip this step and use `make dev-up` directly.
Visit:
- 🎯 **Admin Dashboard**: http://localhost:8001 (admin@example.com / admin123)
- 💬 **Client Side**: http://localhost:8002/medical
- 📚 **Docs Site**: http://localhost:8003
- 🛡️ **API Docs**: http://localhost:3000/docs

#### 🚀 Production Environment
Suitable for formal deployment. All services run in the background with performance optimizations.
```bash
# 1. Generate production configuration templates (in deploy/docker/)
make prod-init

# 2. Modify sensitive information: Edit deploy/docker/.env.backend/admin/client
# Fill in domain names, database passwords, JWT keys, etc.

# 3. Start in background
make prod-up
```

> [!IMPORTANT]
> For detailed security recommendations (SSL, S3, etc.), please refer to:
> **[👉 Full Production Deployment Guide (deploy/docker/README.md)](./deploy/docker/README.md)**

---


## 🏗️ Project Management (Makefile)

The root directory provides a `Makefile` to simplify complex Docker maintenance commands.

### Core Commands

#### Common Commands
| Command | Description |
|------|------|
| `make gen-sdk` | **Generate SDK**: Triggers automatic frontend SDK generation from backend API |
| `make help` | **Show Help**: Display all available commands and their descriptions |

#### Development Environment
| Command | Description |
|------|------|
| `make dev-init` | **Initialize config**: Cleans and recopies `.env.example` files |
| `make dev-up` | **Development start**: Builds images and starts in foreground with logs |
| `make dev-down` | **Graceful stop**: Stops and removes containers, preserves volumes |
| `make dev-restart` | **Quick restart**: Restarts Only the backend container |
| `make dev-logs` | **Real-time logs**: View core backend service logs |
| `make dev-db-migrate m="msg"` | **Generate migration**: Creates new database migration script (needs message `m`) |
| `make dev-db-psql` | **DB Terminal**: Access interactive PostgreSQL terminal |
| `make dev-clean` | **Deep reset**: Stops containers and **deletes all volumes** (⚠️ Destructive) |

---

#### Production Environment

| Command | Description |
|------|------|
| `make prod-init` | **Prod Init**: Initializes production configuration templates |
| `make prod-up` | **Prod Start**: Starts all production services in the background |
| `make prod-down` | **Prod Stop**: Stops and removes production containers |
| `make prod-restart` | **Prod Restart**: Restarts Only the production backend container |
| `make prod-logs` | **Prod Logs**: View production container logs |
| `make prod-clean` | **Deep reset**: Stops containers and **deletes all prod volumes** (⚠️ Destructive) |

---

## 🏗️ Technical Details

### Initialization Mechanism
The project uses a **Standalone Init Container** (`backend-init`) pattern:
- **Self-detection**: Automatically checks database version on startup.
- **Auto-migration**: Automatically executes Alembic scripts.
- **Pre-set Data**: Automatically creates admin account (`admin@example.com` / `admin123`) and medical demo site.

### Automatic SDK Sync
After backend API changes, update the frontend SDK with a single command:
```bash
make gen-sdk
```

---


## ❓ FAQ

> [!TIP]
> Most local environment issues can be resolved with `make dev-clean` followed by `make dev-up`.

### Q: Why do I get "Database not initialized" error?
A: Ensure you've run `make dev-init`. If the database is corrupted, try `make dev-clean`.

**Q: How do I change default service ports?**
A: Modify the `ports` mapping in the root `docker-compose.dev.yml`.

**Q: Client API returns 404?**
A: Ensure your access path includes the site domain suffix, e.g., `http://localhost:8002/medical`.

---

## 📚 Documentation

#### 🚀 Quick Navigation

- 📖 [Env Config Guide](./frontend/docs/docs/deployment/config/environment.md) - Full config instructions for dev/prod
- 🚀 [Quick Start Guide](./frontend/docs/docs/development/start/quick-start.md) - 5 minutes start guide
- 🔌 [API Architecture](./frontend/docs/docs/development/api/overview.md) - Admin vs Client API design principles
- 📦 [RustFS Usage Guide](./frontend/docs/docs/development/tech/rustfs.md) - Upload, download, and Object storage
- 🎯 [SDK Usage Guide](./frontend/docs/docs/development/tech/sdk-usage.md) - Frontend SDK usage and examples
- 🔗 [Document Parsers](./frontend/docs/docs/development/parsers/overview.md) - Document parsing engine integration guide

---

## 🔗 Document Parsers

Parsers are core components in the CatWiki knowledge base platform for **document preprocessing**. Through parsers, you can integrate various document parsing engines to convert unstructured documents like PDF, Word, and images into structured text that AI can understand.

### Parser Features

- **Document Parsing**: Convert PDF, Word, PPT documents into structured text
- **OCR Recognition**: Recognize text content in scanned documents and images
- **Layout Analysis**: Identify document structure (headings, paragraphs, tables, images, etc.)
- **Format Preservation**: Preserve original document formatting and hierarchy as much as possible

### Supported Parsers

| Parser | Description | Features | Status |
|-----------|-------------|----------|--------|
| [MinerU](./frontend/docs/docs/development/parsers/mineru.md) | **(Recommended)** High-quality Document Parsing Tool | High accuracy, complex layout support | ✅ Integrated |
| [Docling](./frontend/docs/docs/development/parsers/docling.md) | IBM Open Source Document Processing Engine | Lightweight, easy deployment | ✅ Integrated |
| [PaddleOCR](./frontend/docs/docs/development/parsers/paddleocr.md) | Baidu OCR Engine | Strong OCR, multi-language support | ✅ Integrated |

> [!TIP]
> **Integration Status**: The above parsers have been officially integrated into the system. We recommend using MinerU and Docling.
> For detailed configuration, please refer to the [Document Parsers Guide](./frontend/docs/docs/development/parsers/overview.md)

---

## 📄 License & Commercial Use

This project is licensed under the **CatWiki Open Source License (Modified Apache 2.0)**. We provide open-source flexibility while protecting the project's brand and commercial rights.

### 📌 Core Principles
1. **Personal/Internal Use**: Completely free, no additional authorization required.
2. **Mandatory Branding**: For all use cases, it is **strictly prohibited** to remove or modify "CatWiki" branding or copyright notices in the UI, console logs, or API headers.
3. **Restricted SaaS Services**: Exploiting this source code to provide multi-tenant SaaS services (e.g., hosted knowledge bases, AI subscription platforms) for profit is prohibited without official written authorization from CatWiki.

### ⚠️ Why these restrictions?
We are committed to contributing core technology to the open-source community while preventing "white-label" commercial exploitation. For commercial licensing or partnerships, please contact us at: [catwiki.ai](https://catwiki.ai).

See [LICENSE](LICENSE) for the full license text.

### 🤔 Why this License?

We've adopted a model similar to Dify.ai to provide better enterprise flexibility than AGPL-3.0, while protecting our core assets and brand through restrictions on multi-tenant SaaS platforms.

---

## 📮 Contact

- 💬 **Feedback**: Submit via [GitHub Issues](https://github.com/bulolo/CatWiki/issues)
- 📧 **Business**: 82607314@qq.com / bulolo (WeChat)
- 🌐 **Website**: https://catwiki.ai

---

<div align="center">

**⭐ If this project is helpful to you, please give us a Star!**

Made with ❤️ by CatWiki Team

</div>
