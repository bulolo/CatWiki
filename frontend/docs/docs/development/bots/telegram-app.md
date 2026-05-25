# Telegram 机器人(应用)

> [!NOTE]
> **本集成属于「应用类机器人」**。在 Telegram 生态中，所有机器人都由 **BotFather** 创建并由 Bot Token 鉴权。你需要通过 BotFather 拿到 Token，再把它填入 CatWiki，即可让 CatWiki 充当 Telegram 上这只 Bot 的"大脑"。

Telegram 机器人采用 **长轮询 (Long Polling)** 模式与 CatWiki 通信，**无需公网 IP / 域名 / HTTPS**，只要 CatWiki 服务器能访问 `api.telegram.org` 即可。

## 推荐场景
- **海外团队 / 社区问答**：Telegram 是非中文用户首选 IM，适合做面向海外的 Q&A 机器人。
- **跨平台移动办公**：用户可在手机端 Telegram 直接咨询，回复以增量编辑形式呈现"打字机"效果。
- **个人知识助手**：把 Bot 拉进私聊或自己创建的群，作为随时唤起的私人助理。

## 1. 在 Telegram 上创建 Bot

### 1.1 通过 BotFather 创建机器人
1. 打开 Telegram，搜索并打开 [**@BotFather**](https://t.me/BotFather)。
2. 发送 `/newbot`，按提示输入：
   - 显示名（任意）
   - 机器人用户名（必须以 `bot` 结尾，如 `catwiki_demo_bot`）
3. 创建成功后，BotFather 会返回一段类似 `123456789:ABCdefGHIjklMNOpqrSTUvwxYZ-1234567890` 的字符串，这就是 **Bot Token**。请妥善保存，**任何人拿到 Token 都能完全控制这只 Bot**。

> [!TIP]
> 如果 Token 不慎泄露（例如提交到 GitHub），可向 BotFather 发送 `/revoke` 立即吊销并签发新 Token。

### 1.2（可选）调整 Bot 形象
回到 BotFather，按需配置：
- `/setdescription` — 简介，用户首次打开会话时看到
- `/setabouttext` — 个人资料页的"关于"
- `/setuserpic` — 头像
- `/setcommands` — 命令补全列表，推荐填：
  ```
  start - 显示欢迎信息
  clear - 重置当前对话上下文
  ```

### 1.3 让 Bot 能识别群里的普通消息（群聊场景必做）

Telegram Bot 默认开启 **Group Privacy**，在群里只能收到"@机器人"的消息和回复机器人的消息。**这是绝大部分新手踩的坑**——配好之后在群里发消息没反应，往往就是因为这个。

如果你只想在 **私聊** 使用 Bot，**跳过本节**即可。

如果要在群里 @机器人 问答，按以下步骤关闭 Privacy：

1. 回到 BotFather，发送 `/setprivacy`。
2. 选择你刚创建的 Bot。
3. 选择 **Disable**。
4. **重新把 Bot 移出再加回群**——已经在群里的 Bot 不会自动应用新策略。

## 2. CatWiki 后台配置

1. 登录 CatWiki 管理后台，进入 **"站点设置" → "AI 机器人"**。
2. 找到 **Telegram 机器人** 卡片，打开开关。
3. 把上一步从 BotFather 获取的 **Bot Token** 粘贴进去。
4. **（可选）API 反代地址**：如果你的服务器位于无法直连 `api.telegram.org` 的网络环境（例如中国大陆），需要在这里填入自建的反向代理地址。详见 [3. 网络要求](#_3-网络要求)。
5. **（可选）用户白名单**：填入允许与 Bot 对话的 Telegram **数字 user_id**，多个用逗号分隔。留空则任何人都能使用。
   - 如何拿到自己的 user_id？在 Telegram 中搜索 `@userinfobot` 并 `/start`，它会返回你的 numeric ID。
6. 点击 **保存**。后端会立刻启动 worker，几秒内即可在 Telegram 给 Bot 发消息试用。

> [!TIP]
> 配置变更（包括停用 / 修改 Token / 调整白名单）会即时生效，无需重启后端。

## 3. 网络要求

CatWiki 的 Telegram worker 会主动调用 `https://api.telegram.org/bot{TOKEN}/getUpdates` 拉取消息。所以：

- **能直连 api.telegram.org（绝大部分海外服务器、公有云）**：什么都不用填，开箱即用。
- **不能直连（中国大陆 IDC / 受限内网）**：
  - 方案 A：自建反向代理（最常见做法是用 Cloudflare Worker 反代 `api.telegram.org`），把代理域名（如 `https://tg-api.your-domain.workers.dev`）填入 **API 反代地址**。
  - 方案 B：给后端容器/进程注入 `HTTPS_PROXY` 环境变量。

> [!WARNING]
> 同一个 **Bot Token 在 Telegram 侧只允许一个客户端拉取消息**。因此：
> - 不要把同一个 Token 同时配置到多个 CatWiki 站点。
> - 如果你做了 CatWiki **多副本部署**（如 K8s 多实例），需要确保只有一个副本启动 Telegram worker；否则副本之间会互相抢更新出现 `409 Conflict`。

## 4. 用户视角的使用

### 4.1 私聊
1. 在 Telegram 搜索你的 Bot 用户名（@catwiki_demo_bot）。
2. 点击 **Start**（首次会发送 `/start`）。
3. 直接发送问题即可。Bot 会先回一条"正在思考..."占位消息，随后以**增量编辑同一条消息**的方式呈现 AI 回答。

### 4.2 群聊
1. 把 Bot 拉进群（确保前面 [1.3](#_1-3-让-bot-能识别群里的普通消息-群聊场景必做) 已正确配置）。
2. 在群里 **@你的Bot 问题内容**，例如 `@catwiki_demo_bot 介绍一下产品`。
3. Bot 会 reply 到这条原消息上，随后流式编辑。

### 4.3 控制指令
- `/clear` 或 `重置` / `清空对话` — 清空当前 Telegram 会话的上下文，下一句重新开始问答
- 群聊里上述指令同样需要 @机器人 才能触发（Privacy 关闭后则可直接发送）

## 5. 技术特性
- **流式回复**：✅ 通过 `editMessageText` 持续更新同一条消息，实现"打字机"效果
- **同步频率**：约 **1.5 秒 / 次**，匹配 Telegram 同一 chat 的 ~1 msg/s 限频策略，避免触发 429
- **消息长度**：单条上限 **4096 字符**（CatWiki 在 4080 处自动截断并提示"内容过长，已截断"）
- **会话隔离**：私聊以用户 ID 为单位、群聊以群 ID 为单位维护独立上下文
- **会话去重**：进程内缓存最近 600 秒的 `message_id`，防止网络抖动导致同一消息被重复推理
- **连接方式**：HTTP 长轮询（25s 超时），无需公网入站
- **降级体验**：用户 block 机器人 / Bot 被踢出群等情况会被静默忽略，不打断后台日志

## 6. 常见问题

**Q：群里 @机器人 没反应？**
→ 99% 是 Group Privacy 没关或关了之后没重新拉群。回到 [1.3](#_1-3-让-bot-能识别群里的普通消息-群聊场景必做)。

**Q：保存配置后日志里反复出现 `Conflict: terminated by other getUpdates request`？**
→ 同一 Bot Token 被多个客户端拉取。检查是否：
1. 把同一 Token 配到了两个 CatWiki 站点；
2. CatWiki 部署了多个副本而每个都启动了 Telegram worker；
3. 你本地还在跑 [@BotFather](https://t.me/BotFather) 之外的脚本/其他 Bot 框架抢同一 Token。

**Q：Markdown 显示成原始字符（如 `**加粗**`）？**
→ 当前版本为了最大化稳定性，Telegram 出口固定为纯文本模式，不解析 Markdown / HTML。Telegram 客户端仍会自动把 URL 渲染为可点链接。后续版本会评估开放富文本模式。

**Q：消息超长被截断了，怎么办？**
→ 提示 Bot 分段回答，或者把问题拆细。Telegram 单条消息硬上限就是 4096，无法绕过。

**Q：如何完全停用 Bot？**
→ 在 CatWiki 后台关闭开关即可（worker 会立刻停掉）。如果想从 Telegram 上彻底删除 Bot，去 BotFather `/deletebot`。
