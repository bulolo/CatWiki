<div align="center">

# <img src="./frontend/docs/docs/public/logo.png" width="36" style="vertical-align: middle;"> CatWiki

**Enterprise-grade Knowledge Base Management System**

**Enterprise-grade full-stack AI knowledge base platform, integrating modern content management, deep AI-powered Q&A, and an ultimate user interaction experience.**

[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-14.0+-000000?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791?logo=postgresql)](https://www.postgresql.org/)


English | [简体中文](./README.md)

<p>
  <a href="https://github.com/bulolo/CatWiki">
    <img src="https://img.shields.io/badge/⭐_Star-Project-yellow?style=for-the-badge&logo=github" alt="Star"/>
  </a>
</p>

**If this project helps you, please click the ⭐ Star in the top right corner to support us. This is the greatest encouragement for the developers!**

</div>

---

### 2026-01-18 ⚡ New Documentation Site
- 🌐 **Documentation Site**: Integrated a brand new [VitePress Documentation Site](http://docs.catwiki.cn) (2026-01-18)
- 📝 **Multi-language Alignment**: Re-aligned Chinese and English README instructions.
- 🔧 **Architecture Cleanup**: Optimized project directory structure and Docker configurations.

---

## 🎯 Highlights

- ✅ **Out-of-the-box**: One-click startup with Docker Compose, automatic database initialization and demo data loading.
- ✅ **Dual-end Architecture**: Independent Admin Dashboard and Client Side with clear responsibilities.
- ✅ **Type Safety**: Full use of TypeScript and Pydantic for robust type safety across frontend and backend.
- ✅ **Modern Tech Stack**: FastAPI + Next.js 14 + SQLAlchemy 2.0, utilizing the latest technologies.
- ✅ **AI Integration**: Built-in intelligent AI Q&A based on Vercel AI SDK.
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
- **Database**: PostgreSQL + SQLAlchemy 2.0
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
- **AI Integration**: Vercel AI SDK (ai + @ai-sdk/react) (Client)
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

## ⚡ Quick Start (5 Minutes)

### One-click Start Full Dev Environment

```bash
# Clone the repository
git clone https://github.com/bulolo/CatWiki.git
cd catWiki

# 1. Initialize configuration
make dev-init

# 2. Configure environment (Important!)
# Edit backend/.env and fill in OpenAI API Key etc.
# vim backend/.env

# 3. Start development environment
make dev-up

# 3. Modify configuration (Optional)
# Edit backend/.env and fill in OpenAI API Key for AI features
# Run `make dev-restart` to apply changes to the backend
```

> [!WARNING]
> **About `make dev-init`**: It will recopy `.env` files from templates, which will overwrite your existing configuration.
> - **First time**: Run `make dev-init` first, then edit your config.
> - **Subsequent**: Use `make dev-up`.

Wait 2-3 minutes for all services to start, then visit:
- 🎯 **Admin Dashboard**: http://localhost:8001 (admin@example.com / admin123)
- 💬 **Client Side**: http://localhost:8002/medical
- 📚 **Docs Site**: http://localhost:8003 (Read this README and other guides offline)
- 🛡️ **API Docs**: http://localhost:3000/docs

As easy as that! 🎉

---

## 🚀 Installation & Configuration

### Prerequisites

- **Docker** >= 20.10
- **Docker Compose** >= 2.0
- **Make** (Pre-installed or via package manager)

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

## 📦 Production Deployment

The project provides a standardized deployment process managed via `make prod-xxx` commands.

#### 1. Initialize Configuration
```bash
# Generate prod config templates (located in deploy/docker/)
make prod-init
```

#### 2. Modify Sensitive Information
Edit the following files to fill in domain names, database passwords, JWT keys, etc.:
- `deploy/docker/.env.backend`
- `deploy/docker/.env.admin`
- `deploy/docker/.env.client`

#### 3. Start Services
```bash
# Start all production containers in background
make prod-up
```

> [!IMPORTANT]
> For detailed security recommendations (SSL, S3, etc.), please refer to:
> **[👉 Full Production Deployment Guide (deploy/docker/README.md)](./deploy/docker/README.md)**

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

---

## 📄 License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

### 📋 License Summary

- ✅ **Free to use**: You can freely use, modify, and distribute this software.
- ✅ **Copyleft**: You must release your modifications under the same license.
- ✅ **Network Service**: Source code must be made available to users over a network.
- ✅ **Commercial use**: Permitted, provided the same copyleft terms are honored.

This means if you:
- 🔧 **Modify the code**: Must open source the modified code.
- 🌐 **Provide SaaS**: Must provide the full source code to your users.
- 💼 **Run commercially**: Yes, but keep it open source.

See [LICENSE](LICENSE) for the full license text.

---

## 📮 Contact

- 💬 **Feedback**: Submit via [GitHub Issues](https://github.com/bulolo/CatWiki/issues)
- 📧 **Business**: 82607314@qq.com / bulolo (WeChat)
- 🌐 **Website**: http://catwiki.cn

---

<div align="center">

**⭐ If this project is helpful to you, please give us a Star!**

Made with ❤️ by CatWiki Team

</div>
