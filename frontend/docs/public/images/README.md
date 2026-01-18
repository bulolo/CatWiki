# 项目截图和展示图片

此目录用于存放 README 和文档中使用的截图和展示图片。

## 目录结构

```
docs/images/
├── screenshots/          # 应用截图（功能展示、界面演示等）
├── architecture/         # 架构图、流程图等
└── README.md            # 本文件
```

## 命名规范

建议使用描述性的文件名，例如：

**管理后台截图：**
- `admin-login.png` - 登录页面
- `admin-dashboard.png` - 管理后台首页
- `admin-document-editor.png` - 文档编辑器
- `admin-document-list.png` - 文档列表
- `admin-site-management.png` - 站点管理

**客户端截图：**
- `client-homepage.png` - 客户端首页
- `client-document-view.png` - 文档阅读页面
- `client-ai-chat.png` - AI 问答界面
- `client-search.png` - 搜索功能

**其他：**
- `logo.png` - 项目 Logo
- `banner.png` - 项目横幅
- `architecture-diagram.png` - 架构图

## 使用方式

在 README 或其他 Markdown 文档中引用图片：

```markdown
![管理后台首页](./docs/images/screenshots/admin-dashboard.png)
```

或使用 HTML 标签控制大小：

```html
<img src="./docs/images/screenshots/admin-dashboard.png" alt="管理后台首页" width="600">
```
