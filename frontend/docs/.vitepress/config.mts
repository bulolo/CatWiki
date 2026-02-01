import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "CatWiki 文档",
  description: "企业级AI知识库平台 - 完整文档",
  lang: 'zh-CN',
  srcDir: 'docs',  // 指定源文件目录

  // 忽略 localhost 链接和相对路径的文件引用（这些是合法的外部资源引用）
  ignoreDeadLinks: [
    /^http:\/\/localhost/,
    /^\.\.?\//,  // 相对路径引用
  ],

  themeConfig: {
    logo: '/logo.png',

    nav: [
      { text: '首页', link: '/' },
      { text: '开发指南', link: '/development/start/quick-start', activeMatch: '/development/' },
      { text: '部署指南', link: '/deployment/guide/docker', activeMatch: '/deployment/' },
      { text: '关于', link: '/about/project/intro', activeMatch: '/about/' }
    ],

    sidebar: {
      '/development/': [
        {
          text: '开始开发',
          items: [
            { text: '快速开始', link: '/development/start/quick-start' }
          ]
        },
        {
          text: '开发指南',
          items: [
            { text: '后端开发', link: '/development/guide/backend' },
            { text: 'Admin 前端', link: '/development/guide/frontend-admin' },
            { text: 'Client 前端', link: '/development/guide/frontend-client' }
          ]
        },
        {
          text: '技术文档',
          items: [
            { text: '网页挂件集成', link: '/development/tech/widget-integration' },
            { text: 'SDK 使用指南', link: '/development/tech/sdk-usage' },
            { text: 'RustFS 对象存储', link: '/development/tech/rustfs' },
            { text: '日志系统', link: '/development/tech/logger' },
            { text: '自动保存', link: '/development/tech/autosave' }
          ]
        },
        {
          text: '连接器',
          items: [
            { text: '连接器概述', link: '/development/connectors/overview' },
            { text: 'Docling', link: '/development/connectors/docling' },
            { text: 'MinerU', link: '/development/connectors/mineru' },
            { text: 'PaddleOCR', link: '/development/connectors/paddleocr' },
            { text: '天枢', link: '/development/connectors/tianshu' }
          ]
        },
        {
          text: 'API 文档',
          items: [
            { text: 'API 概览', link: '/development/api/overview' },
            { text: 'Admin API', link: '/development/api/admin' },
            { text: 'Client API', link: '/development/api/client' }
          ]
        }
      ],
      '/deployment/': [
        {
          text: '部署指南',
          items: [
            { text: 'Docker 部署', link: '/deployment/guide/docker' },
            { text: 'Helm 部署', link: '/deployment/guide/helm' },
          ]
        },
        {
          text: '配置指南',
          items: [
            { text: '环境文件 配置', link: '/deployment/config/environment' },
            { text: 'Docker 配置', link: '/deployment/config/docker' }
          ]
        }
      ],
      '/about/': [
        {
          text: '关于项目',
          items: [
            { text: '项目介绍', link: '/about/project/intro' },
            { text: '常见问题', link: '/about/project/faq' }
          ]
        },
        {
          text: '关于我们',
          items: [
            { text: '联系方式', link: '/about/team/contact' },
            { text: '许可证', link: '/about/team/license' }
          ]
        }
      ]
    },


    socialLinks: [
      { icon: 'github', link: 'https://github.com/bulolo/CatWiki' }
    ],

    footer: {
      message: 'Released under the <a href="/about/team/license">AGPL-3.0 License</a>.',
      copyright: 'Copyright © 2026 <a href="http://catwiki.cn" target="_blank">CatWiki Team</a>'
    },

    search: {
      provider: 'local'
    },

    outline: {
      level: [2, 3],
      label: '目录'
    }
  }
})
