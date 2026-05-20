# Copyright 2026 CatWiki Authors
#
# Licensed under the CatWiki Open Source License (Modified Apache 2.0);
# you may not use this file except in compliance with the License.

"""Robot 平台 service 层。

⚠️ 本目录下的 5 个 service **不是同一种东西**，分两类：

**LongConn Service（长跑单例）** —— DingTalk / Feishu / WeComSmart
- 提供 ``get_instance() / startup() / shutdown() / refresh()`` 生命周期
- 进程内维护 ``_workers: dict[site_id, WorkerState]`` 长连接池
- 由 lifecycle 在 app 启动时唤起

**Webhook Handler（无单例的 classmethod 容器）** —— WeComApp / WeComKefu
- 没有 startup / shutdown 生命周期；不持有连接池
- 全部方法是 ``@classmethod``；进程内类变量（``_deduplicator`` / ``_cursors`` / ``_sync_locks``）跨调用复用
- 共享的 HTTP / token 客户端收口在 ``robot/clients/wecom.py``（``WeComClient``）
- 由 api/client/endpoints/bots.py 在 webhook 回调时调用

两者公用 ``Service`` 后缀是历史遗留：webhook 类没有"长跑"意味，命名上更接近
``Handler``。但因为外部调用面较大（api endpoints + 互相 import）暂未重命名，
新代码请按本说明区分两者职责。

未来若 WeCom App / Kefu 需要长跑能力（如出站消息队列），可以升级为真单例。
反之，如果发现 LongConn 类不再需要长跑（如改走 webhook），应拆掉单例机制
而非保留 dead lifecycle。
"""
