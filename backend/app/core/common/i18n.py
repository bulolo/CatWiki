# Copyright 2026 CatWiki Authors
#
# Licensed under the CatWiki Open Source License (Modified Apache 2.0);
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://github.com/CatWiki/CatWiki/blob/main/LICENSE
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import contextvars
import logging

logger = logging.getLogger(__name__)

SUPPORTED_LOCALES = ("zh", "en")
DEFAULT_LOCALE = "zh"

# Context for current locale
_locale: contextvars.ContextVar[str] = contextvars.ContextVar("locale", default=DEFAULT_LOCALE)

MESSAGES: dict[str, dict[str, str]] = {
    "zh": {
        # ========== 异常类默认消息 ==========
        "error.base": "服务异常",
        "error.not_found": "资源不存在",
        "error.bad_request": "请求参数错误",
        "error.unauthorized": "未授权访问",
        "error.forbidden": "禁止访问",
        "error.conflict": "资源冲突",
        "error.database": "数据库错误",
        "error.service_unavailable": "服务不可用",
        "error.validation": "参数校验失败",
        "error.internal": "服务器内部错误",
        # ========== 通用 API 响应 ==========
        "api.success.get": "获取成功",
        "api.success.create": "创建成功",
        "api.success.update": "更新成功",
        "api.success.delete": "删除成功",
        "api.success.move": "移动成功",
        "api.success.login": "登录成功",
        "api.success.connect": "连接成功",
        "api.success.save": "保存成功",
        # ========== 文档相关 ==========
        "doc.import_queued": "已加入导入队列",
        "doc.learn_queued": "已加入学习队列",
        "doc.vector_removed": "已移除向量数据",
        "doc.retrieve_success": "检索成功",
        "doc.retrieve_failed": "检索失败: {error}",
        "doc.batch_learn_queued": "已将 {count} 个文档加入学习队列",
        "doc.not_found": "文档 {id} 不存在",
        "doc.import_failed": "导入失败：{error}",
        "doc.site_not_found": "站点 {id} 不存在",
        "doc.unsupported_format": "当前解析器不支持该文件格式",
        "doc.processor_invalid": "处理器 {type} 未配置或无效",
        "doc.storage_unavailable": "云端存储服务不可用，无法处理文档导入",
        "doc.learn_failed": "学习失败：{error}",
        "doc.id_list_empty": "文档ID列表不能为空",
        "doc.cannot_relearn": "文档当前状态为 {status}，无法重新学习",
        # ========== 用户相关 ==========
        "user.created": "用户创建成功",
        "user.password_updated": "密码更新成功",
        "user.password_reset": "密码重置成功",
        "user.not_found": "用户 {id} 不存在",
        "user.email_taken": "邮箱 {email} 已被使用",
        "user.wrong_credentials": "邮箱或密码错误",
        "user.wrong_old_password": "旧密码错误",
        "user.no_permission_action_admin": "无权{action}系统管理员",
        "user.no_permission_action_level": "无权{action}该级别管理员",
        "user.no_permission_action_user": "无权{action}该用户",
        "user.no_permission_view_site_users": "无权查看该站点用户",
        "user.cannot_create_sys_admin": "租户管理员无法创建系统管理员",
        "user.cannot_create_sys_admin_ce": "社区版无法创建系统管理员角色",
        "user.cannot_assign_unmanaged_sites": "无法分配您未管理的站点",
        "user.cannot_invite_sys_admin": "无法邀请系统管理员",
        "user.cannot_invite_sys_admin_ce": "社区版无法邀请系统管理员角色",
        "user.cannot_escalate_to_sys_admin": "无法提权为系统管理员",
        "user.cannot_escalate_to_sys_admin_ce": "社区版无法设置为系统管理员角色",
        # ========== 文件相关 ==========
        "file.upload_success": "文件上传成功",
        "file.batch_upload_done": "批量上传完成，成功 {success} 个，失败 {fail} 个",
        "file.delete_success": "文件删除成功",
        "file.not_found": "文件不存在",
        "file.upload_failed": "文件上传失败",
        "file.download_failed": "文件下载失败",
        "file.delete_failed": "文件删除失败",
        "file.info_failed": "获取文件信息失败",
        "file.presign_failed": "生成预签名 URL 失败",
        "file.storage_unavailable": "对象存储服务不可用",
        # ========== 站点相关 ==========
        "site.not_found": "站点 {id} 不存在",
        "site.name_exists": "站点名称 '{name}' 已存在",
        "site.slug_exists": "标识 '{slug}' 已存在",
        "site.admin_password_required": "提供管理员邮箱时，必须同时提供管理员密码（至少 8 位）。",
        "site.invalid_api_key": "无效的 API 密钥",
        "site.disabled": "该站点已被禁用",
        # ========== 合集相关 ==========
        "collection.not_found": "合集 {id} 不存在",
        "collection.no_tenant_access": "无权访问该租户的合集",
        "collection.parent_must_same_site": "父合集必须属于同一站点",
        "collection.cannot_set_self_child": "不能将合集设置为自己的子合集",
        "collection.has_documents": "无法删除合集，该合集下还有文档。",
        "collection.has_children": "无法删除合集，该合集下还有子合集。",
        "collection.cannot_move_to_self": "不能将合集移动到自己下面",
        "collection.target_must_same_site": "目标父合集必须属于同一站点",
        "collection.cannot_move_to_descendant": "不能将合集移动到自己的后代节点下",
        # ========== 认证相关 ==========
        "auth.invalid_token": "无效的 token",
        "auth.missing_user_info": "token 中缺少用户信息",
        "auth.invalid_user_id": "无效的用户ID",
        "auth.user_not_found": "用户不存在",
        "auth.user_disabled": "用户已被禁用",
        "auth.demo_mode": "当前处于演示模式，暂不支持此操作",
        # ========== 系统配置相关 ==========
        "config.not_found": "配置 {key} 不存在",
        "config.connect_failed": "连接失败: {error}",
        "config.unsupported_test_type": "不支持的测试类型: {type}",
        "config.service_unavailable": "无法连接到服务或服务异常",
        "config.delete_success": "配置删除成功",
        # ========== 缓存相关 ==========
        "cache.stats_success": "获取缓存统计信息成功",
        "cache.clear_success": "清空缓存成功",
        "cache.cleared": "缓存已清空",
        # ========== 租户相关 ==========
        "tenant.not_found": "租户不存在",
        "tenant.identified_not_found": "识别到的租户不存在",
        "tenant.global_view": "当前处于全局视图",
        "tenant.sys_admin_only": "权限不足，仅限系统管理员访问",
        "tenant.sys_or_tenant_admin_only": "权限不足，仅限系统管理员和租户管理员访问",
        "tenant.own_tenant_only": "权限不足，只能访问所属租户信息",
        # ========== 任务相关 ==========
        "task.not_found": "任务未找到",
        # ========== 机器人默认回复 ==========
        "bot.error_reply": "服务暂时繁忙，请稍后再试。",
        "bot.timeout_reply": "服务响应超时，请稍后再试。",
        "bot.empty_reply": "抱歉，我暂时无法回答这个问题。",
        # ========== 机器人配置验证 ==========
        "bot.feishu_missing_config": "启用飞书机器人时，App ID 和 App Secret 均不能为空。",
        "bot.dingtalk_missing_config": "启用钉钉机器人时，Client ID、Client Secret、模板 ID 均不能为空。",
        "bot.wecom_smart_missing_config": "启用企业微信智能机器人时，Bot ID 和 Secret 不能为空。",
        "bot.wecom_kf_missing_config": "启用企业微信客服时，企业 ID、Secret、Token 和 Encoding AES Key 均不能为空。",
        "bot.wecom_app_missing_config": "启用企业微信机器人(应用)时，企业 ID、Secret、Token 和 Encoding AES Key 均不能为空。",
        "bot.unknown_wecom_type": "未知的企业微信机器人类型",
        "bot.site_config_not_found": "未找到对应的站点或配置",
        "bot.unknown_platform": "未知的机器人平台",
        "bot.platform_not_enabled": "机器人平台未启用",
        "bot.invalid_auth_header": "认证头格式无效，须以 'Bearer ' 开头",
        "bot.qa_not_enabled": "该站点的问答机器人功能尚未在后台启用",
        # ========== 会话相关 ==========
        "session.not_found": "会话不存在",
    },
    "en": {
        # ========== Exception defaults ==========
        "error.base": "Service error",
        "error.not_found": "Resource not found",
        "error.bad_request": "Bad request",
        "error.unauthorized": "Unauthorized access",
        "error.forbidden": "Forbidden",
        "error.conflict": "Resource conflict",
        "error.database": "Database error",
        "error.service_unavailable": "Service unavailable",
        "error.validation": "Validation failed",
        "error.internal": "Internal server error",
        # ========== Common API responses ==========
        "api.success.get": "Success",
        "api.success.create": "Created successfully",
        "api.success.update": "Updated successfully",
        "api.success.delete": "Deleted successfully",
        "api.success.move": "Moved successfully",
        "api.success.login": "Login successful",
        "api.success.connect": "Connection successful",
        "api.success.save": "Saved successfully",
        # ========== Documents ==========
        "doc.import_queued": "Added to import queue",
        "doc.learn_queued": "Added to learning queue",
        "doc.vector_removed": "Vector data removed",
        "doc.retrieve_success": "Retrieval successful",
        "doc.retrieve_failed": "Retrieval failed: {error}",
        "doc.batch_learn_queued": "{count} documents added to learning queue",
        "doc.not_found": "Document {id} not found",
        "doc.import_failed": "Import failed: {error}",
        "doc.site_not_found": "Site {id} not found",
        "doc.unsupported_format": "File format not supported by the selected parser",
        "doc.processor_invalid": "Processor {type} is not configured or invalid",
        "doc.storage_unavailable": "Cloud storage unavailable, cannot process document import",
        "doc.learn_failed": "Learning failed: {error}",
        "doc.id_list_empty": "Document ID list cannot be empty",
        "doc.cannot_relearn": "Document status is {status}, cannot re-learn",
        # ========== Users ==========
        "user.created": "User created successfully",
        "user.password_updated": "Password updated successfully",
        "user.password_reset": "Password reset successfully",
        "user.not_found": "User {id} not found",
        "user.email_taken": "Email {email} is already in use",
        "user.wrong_credentials": "Invalid email or password",
        "user.wrong_old_password": "Incorrect old password",
        "user.no_permission_action_admin": "No permission to {action} system administrator",
        "user.no_permission_action_level": "No permission to {action} this level of administrator",
        "user.no_permission_action_user": "No permission to {action} this user",
        "user.no_permission_view_site_users": "No permission to view users of this site",
        "user.cannot_create_sys_admin": "Tenant admin cannot create system administrator",
        "user.cannot_create_sys_admin_ce": "Community edition cannot create system administrator role",
        "user.cannot_assign_unmanaged_sites": "Cannot assign sites you do not manage",
        "user.cannot_invite_sys_admin": "Cannot invite system administrator",
        "user.cannot_invite_sys_admin_ce": "Community edition cannot invite system administrator role",
        "user.cannot_escalate_to_sys_admin": "Cannot escalate to system administrator",
        "user.cannot_escalate_to_sys_admin_ce": "Community edition cannot set system administrator role",
        # ========== Files ==========
        "file.upload_success": "File uploaded successfully",
        "file.batch_upload_done": "Batch upload completed: {success} succeeded, {fail} failed",
        "file.delete_success": "File deleted successfully",
        "file.not_found": "File not found",
        "file.upload_failed": "File upload failed",
        "file.download_failed": "File download failed",
        "file.delete_failed": "File deletion failed",
        "file.info_failed": "Failed to get file info",
        "file.presign_failed": "Failed to generate presigned URL",
        "file.storage_unavailable": "Object storage service unavailable",
        # ========== Sites ==========
        "site.not_found": "Site {id} not found",
        "site.name_exists": "Site name '{name}' already exists",
        "site.slug_exists": "Slug '{slug}' already exists",
        "site.admin_password_required": "Admin password (at least 8 characters) is required when providing admin email.",
        "site.invalid_api_key": "Invalid API key",
        "site.disabled": "This site has been disabled",
        # ========== Collections ==========
        "collection.not_found": "Collection {id} not found",
        "collection.no_tenant_access": "No permission to access collections of this tenant",
        "collection.parent_must_same_site": "Parent collection must belong to the same site",
        "collection.cannot_set_self_child": "Cannot set a collection as its own child",
        "collection.has_documents": "Cannot delete collection: it still contains documents.",
        "collection.has_children": "Cannot delete collection: it still contains sub-collections.",
        "collection.cannot_move_to_self": "Cannot move a collection under itself",
        "collection.target_must_same_site": "Target parent collection must belong to the same site",
        "collection.cannot_move_to_descendant": "Cannot move a collection under its own descendant",
        # ========== Auth ==========
        "auth.invalid_token": "Invalid token",
        "auth.missing_user_info": "Token is missing user information",
        "auth.invalid_user_id": "Invalid user ID",
        "auth.user_not_found": "User not found",
        "auth.user_disabled": "User is disabled",
        "auth.demo_mode": "This operation is not supported in demo mode",
        # ========== System config ==========
        "config.not_found": "Configuration {key} not found",
        "config.connect_failed": "Connection failed: {error}",
        "config.unsupported_test_type": "Unsupported test type: {type}",
        "config.service_unavailable": "Cannot connect to service or service error",
        "config.delete_success": "Configuration deleted successfully",
        # ========== Cache ==========
        "cache.stats_success": "Cache statistics retrieved",
        "cache.clear_success": "Cache cleared successfully",
        "cache.cleared": "Cache cleared",
        # ========== Tenants ==========
        "tenant.not_found": "Tenant not found",
        "tenant.identified_not_found": "Identified tenant not found",
        "tenant.global_view": "Currently in global view",
        "tenant.sys_admin_only": "Insufficient permissions: system administrator only",
        "tenant.sys_or_tenant_admin_only": "Insufficient permissions: system or tenant administrator only",
        "tenant.own_tenant_only": "Insufficient permissions: can only access own tenant",
        # ========== Tasks ==========
        "task.not_found": "Task not found",
        # ========== Bot default replies ==========
        "bot.error_reply": "Service is temporarily busy, please try again later.",
        "bot.timeout_reply": "Service response timed out, please try again later.",
        "bot.empty_reply": "Sorry, I'm unable to answer this question at the moment.",
        # ========== Bot config validation ==========
        "bot.feishu_missing_config": "App ID and App Secret are required when enabling Feishu bot.",
        "bot.dingtalk_missing_config": "Client ID, Client Secret, and Template ID are required when enabling DingTalk bot.",
        "bot.wecom_smart_missing_config": "Bot ID and Secret are required when enabling WeCom smart bot.",
        "bot.wecom_kf_missing_config": "Corp ID, Secret, Token, and Encoding AES Key are required when enabling WeCom customer service.",
        "bot.wecom_app_missing_config": "Corp ID, Secret, Token, and Encoding AES Key are required when enabling WeCom app bot.",
        "bot.unknown_wecom_type": "Unknown WeCom bot type",
        "bot.site_config_not_found": "Site or configuration not found",
        "bot.unknown_platform": "Unknown bot platform",
        "bot.platform_not_enabled": "Bot platform is not enabled",
        "bot.invalid_auth_header": "Invalid authorization header, must start with 'Bearer '",
        "bot.qa_not_enabled": "The Q&A bot feature for this site has not been enabled in the admin panel",
        # ========== Sessions ==========
        "session.not_found": "Session not found",
    },
}


def set_locale(locale: str):
    """Set the locale for the current request context."""
    if locale in MESSAGES:
        _locale.set(locale)


def get_locale() -> str:
    """Get the locale for the current request context."""
    return _locale.get()


def _(key: str, **kwargs) -> str:
    """Translate a message key based on the current locale."""
    locale = get_locale()
    messages = MESSAGES.get(locale, MESSAGES[DEFAULT_LOCALE])
    message = messages.get(key)
    if message is None:
        logger.warning("i18n key miss: '%s' (locale=%s)", key, locale)
        message = key
    if kwargs:
        return message.format(**kwargs)
    return message
