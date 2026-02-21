import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

// https://vitepress.dev/reference/site-config
export default withMermaid(
  defineConfig({
    title: "CatWiki 文档",
    description: "企业级AI知识库平台 - 完整文档",
    lang: 'zh-CN',
    srcDir: 'docs',  // 指定源文件目录
    head: [
      ['link', { rel: 'icon', href: '/favicon.ico?v=2' }]
    ],

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
            text: 'AI 机器人',
            collapsed: false,
            items: [
              { text: '网页挂件机器人', link: '/development/tech/widget-integration' },
              { text: '企业微信智能机器人', link: '/development/tech/wecom-robot' },
              { text: '飞书机器人', link: '/development/tech/feishu-robot' },
              { text: '钉钉机器人', link: '/development/tech/dingtalk-robot' },
            ]
          },
          {
            text: '技术文档',
            items: [
              { text: 'AI对话与知识库检索', link: '/development/tech/ai-chat-architecture' },
              { text: 'RustFS 对象存储', link: '/development/tech/rustfs' },
            ]
          },
          {
            text: '文档解析器',
            items: [
              { text: '解析器概述', link: '/development/parsers/overview' },
              { text: 'MinerU', link: '/development/parsers/mineru' },
              { text: 'Docling', link: '/development/parsers/docling' },
              { text: 'PaddleOCR', link: '/development/parsers/paddleocr' }
            ]
          },
          {
            text: 'API 文档与SDK',
            items: [
              { text: 'API 概览', link: '/development/api/overview' },
              { text: 'Admin API', link: '/development/api/admin' },
              { text: 'Client API', link: '/development/api/client' },
              { text: 'SDK 使用指南', link: '/development/tech/sdk-usage' },
            ]
          }
        ],
        '/deployment/': [
          {
            text: '部署指南',
            items: [
              { text: 'Docker 部署', link: '/deployment/guide/docker' },
              { text: 'Nginx 配置', link: '/deployment/guide/nginx' },
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
              { text: '更新日志', link: '/about/project/changelog' },
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
        message: 'Released under the <a href="/about/team/license">CatWiki Open Source License</a>.',
        copyright: 'Copyright © 2026 <a href="https://catwiki.ai" target="_blank">CatWiki Team</a>'
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
)
