import logging

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.common.masking import mask_bot_config_inplace
from app.core.common.utils import Paginator, generate_token
from app.core.infra.cache import cached, get_cache
from app.core.infra.config import settings
from app.core.integration.robot.services.dingtalk_app import DingTalkRobotService
from app.core.integration.robot.services.feishu_app import FeishuRobotService
from app.core.integration.robot.services.wecom_smart import WeComSmartService
from app.core.web.exceptions import BadRequestException, ConflictException, NotFoundException
from app.crud import crud_site, crud_user
from app.db.database import get_db
from app.db.transaction import transactional
from app.models.site import Site as SiteModel
from app.models.user import User, UserRole
from app.schemas.site import SiteCreate, SiteUpdate
from app.schemas.user import UserCreate, UserUpdate

logger = logging.getLogger(__name__)


class SiteService:
    def __init__(self, db: AsyncSession):
        self.db = db

    @transactional()
    async def increment_article_count(self, site_id: int) -> None:
        """增加站点的文章计数"""
        await crud_site.increment_article_count(self.db, site_id=site_id)

    @transactional()
    async def decrement_article_count(self, site_id: int) -> None:
        """减少站点的文章计数"""
        await crud_site.decrement_article_count(self.db, site_id=site_id)

    async def refresh_bot_stream_services(self) -> None:
        """站点机器人配置变更后，刷新飞书/钉钉/企微智能机器人长连接服务。"""
        try:
            await FeishuRobotService.get_instance().refresh()
        except Exception as e:
            logger.warning(f"刷新飞书长连接失败: {e}")
        try:
            await DingTalkRobotService.get_instance().refresh()
        except Exception as e:
            logger.warning(f"刷新钉钉 Stream 失败: {e}")
        try:
            await WeComSmartService.get_instance().refresh()
        except Exception as e:
            logger.warning(f"刷新企微智能机器人长连接失败: {e}")

    def ensure_bot_config_valid(self, bot_config: dict | None) -> None:
        """校验站点机器人配置，避免启用后静默失效。"""
        if not bot_config:
            return

        feishu = bot_config.get("feishu_app") or {}
        if feishu.get("enabled"):
            app_id = (feishu.get("app_id") or "").strip()
            app_secret = (feishu.get("app_secret") or "").strip()
            if not app_id or not app_secret:
                raise BadRequestException(
                    detail="启用飞书机器人时，App ID 和 App Secret 均不能为空。"
                )

        dingtalk = bot_config.get("dingtalk_app") or {}
        if not dingtalk.get("enabled"):
            return
        client_id = (dingtalk.get("client_id") or "").strip()
        client_secret = (dingtalk.get("client_secret") or "").strip()
        template_id = (dingtalk.get("template_id") or "").strip()
        if not client_id or not client_secret or not template_id:
            raise BadRequestException(
                detail="启用钉钉机器人时，Client ID、Client Secret、模板 ID 均不能为空。"
            )

        wecom_smart = bot_config.get("wecom_smart") or {}
        if wecom_smart.get("enabled"):
            if not wecom_smart.get("bot_id") or not wecom_smart.get("secret"):
                raise BadRequestException(
                    detail="启用企业微信智能机器人时，Bot ID 和 Secret 不能为空。"
                )

        wecom_kefu = bot_config.get("wecom_kefu") or {}
        if wecom_kefu.get("enabled"):
            if (
                not wecom_kefu.get("corp_id")
                or not wecom_kefu.get("secret")
                or not wecom_kefu.get("token")
                or not wecom_kefu.get("encoding_aes_key")
            ):
                raise BadRequestException(
                    detail="启用企业微信客服时，企业 ID、Secret、Token 和 Encoding AES Key 均不能为空。"
                )

        wecom_app = bot_config.get("wecom_app") or {}
        if wecom_app.get("enabled"):
            if (
                not wecom_app.get("corp_id")
                or not wecom_app.get("secret")
                or not wecom_app.get("token")
                or not wecom_app.get("encoding_aes_key")
            ):
                raise BadRequestException(
                    detail="启用企业微信机器人(应用)时，企业 ID、Secret、Token 和 Encoding AES Key 均不能为空。"
                )

    @transactional()
    async def list_sites(
        self, page: int, size: int, status: str | None, is_demo: bool
    ) -> tuple[list[SiteModel], Paginator]:
        """获取站点列表（分页）"""
        total = await crud_site.count(self.db, status=status)
        paginator = Paginator(page=page, size=size, total=total)

        sites = await crud_site.list_with_tenant(
            self.db, skip=paginator.skip, limit=paginator.size, status=status
        )

        if is_demo:
            for s in sites:
                if s.bot_config:
                    mask_bot_config_inplace(s.bot_config)
            logger.info(f"🔒 [Sites] Demo Mode: Masked {len(sites)} sites' bot config")

        return sites, paginator

    @transactional()
    async def get_site(self, site_id: int, is_demo: bool) -> SiteModel:
        """获取站点详情"""
        site = await crud_site.get_with_tenant(self.db, id=site_id)
        if not site:
            raise NotFoundException(detail=f"站点 {site_id} 不存在")

        if is_demo:
            if site.bot_config:
                mask_bot_config_inplace(site.bot_config)
            logger.info(f"🔒 [Sites] Demo Mode: Masked bot config for site {site_id}")

        return site

    @transactional()
    async def get_site_by_slug(self, slug: str, is_demo: bool) -> SiteModel:
        """通过 slug 获取站点详情"""
        site = await crud_site.get_by_slug_with_tenant(self.db, slug=slug)
        if not site:
            raise NotFoundException(detail=f"站点 {slug} 不存在")

        if is_demo:
            if site.bot_config:
                mask_bot_config_inplace(site.bot_config)
            logger.info(f"🔒 [Sites] Demo Mode: Masked bot config for site slug={slug}")

        return site

    @transactional()
    async def create_site(self, site_in: SiteCreate) -> SiteModel:
        # 检查名称是否已存在
        existing = await crud_site.get_by_name(self.db, name=site_in.name)
        if existing:
            raise ConflictException(detail=f"站点名称 '{site_in.name}' 已存在")

        # 检查标识是否已存在
        if site_in.slug:
            existing_slug = await crud_site.get_by_slug(self.db, slug=site_in.slug)
            if existing_slug:
                raise ConflictException(detail=f"标识 '{site_in.slug}' 已存在")

        # 处理机器人配置：如果启用 API Bot 且没填 Key，自动生成一个
        if site_in.bot_config:
            self.ensure_bot_config_valid(site_in.bot_config)
            api_bot = site_in.bot_config.get("api_bot")
            # CE 版本不支持 API Bot（企业版专属功能）
            if api_bot and settings.CATWIKI_EDITION == "community":
                api_bot["enabled"] = False
            elif api_bot and api_bot.get("enabled") and not api_bot.get("api_key"):
                api_bot["api_key"] = f"sk-{generate_token(24)}"

        # 先完成管理员参数与用户状态校验，避免后续报错时站点已创建
        admin_email: str | None = None
        admin_password: str | None = None
        existing_user: User | None = None
        if site_in.admin_email:
            admin_email = site_in.admin_email.lower().strip()
            existing_user = await crud_user.get_by_email(self.db, email=admin_email)
            if not existing_user:
                admin_password = (site_in.admin_password or "").strip()
                if not admin_password:
                    raise BadRequestException(
                        detail="提供管理员邮箱时，必须同时提供管理员密码（至少 8 位）。"
                    )

        # 初始化站点及其管理员
        site = await crud_site.create(self.db, obj_in=site_in)

        # 如果提供了管理员信息，初始化站点管理员
        if admin_email:
            if existing_user:
                # 用户已存在，追加站点管理权限
                current_managed_sites = existing_user.managed_sites
                if site.id not in current_managed_sites:
                    new_managed_sites = current_managed_sites + [site.id]
                    await crud_user.update(
                        self.db,
                        db_obj=existing_user,
                        obj_in=UserUpdate(
                            managed_site_ids=new_managed_sites, role=existing_user.role
                        ),
                    )
            else:
                # 用户不存在，创建新用户
                await crud_user.create(
                    self.db,
                    obj_in=UserCreate(
                        email=admin_email,
                        password=admin_password or "",
                        name=site_in.admin_name or admin_email.split("@")[0],
                        role=UserRole.SITE_ADMIN,
                        managed_site_ids=[site.id],
                    ),
                )

        # 自动处理提交

        # 刷新对象以填充 tenant_slug
        await self.db.refresh(site, ["tenant"])

        # 注册提交后回调：由于 bot 刷新和缓存清理是副作用，应在事务成功后执行
        from app.db.transaction import on_commit

        on_commit(self.db, self._after_site_change)

        return site

    async def _after_site_change(self):
        """站点变更后的统一处理：刷新服务与清理缓存"""
        await self.refresh_bot_stream_services()
        cache = get_cache()
        await cache.delete_by_prefix("service:sites:client_list")
        await cache.delete_by_prefix("service:sites:client_detail")

    @transactional()
    async def update_site(self, site_id: int, site_in: SiteUpdate) -> SiteModel:
        site = await crud_site.get(self.db, id=site_id)
        if not site:
            raise NotFoundException(detail=f"站点 {site_id} 不存在")

        # 检查名称冲突
        if site_in.name:
            existing = await crud_site.get_by_name(self.db, name=site_in.name)
            if existing and existing.id != site_id:
                raise ConflictException(detail=f"站点名称 '{site_in.name}' 已存在")

        # 检查标识冲突
        if site_in.slug:
            existing_slug = await crud_site.get_by_slug(self.db, slug=site_in.slug)
            if existing_slug and existing_slug.id != site_id:
                raise ConflictException(detail=f"标识 '{site_in.slug}' 已存在")

        # 处理机器人配置：如果启用 API Bot 且没填 Key，尝试沿用旧的或生成新的
        if site_in.bot_config:
            self.ensure_bot_config_valid(site_in.bot_config)
            api_bot = site_in.bot_config.get("api_bot")
            # CE 版本不支持 API Bot（企业版专属功能）
            if api_bot and settings.CATWIKI_EDITION == "community":
                api_bot["enabled"] = False
            elif api_bot and api_bot.get("enabled") and not api_bot.get("api_key"):
                # 尝试从原有配置中获取
                old_bot_config = site.bot_config or {}
                old_api_bot = old_bot_config.get("api_bot")
                if old_api_bot and old_api_bot.get("api_key"):
                    api_bot["api_key"] = old_api_bot["api_key"]
                else:
                    # 原来也没有，生成一个新的
                    api_bot["api_key"] = f"sk-{generate_token(24)}"

        site = await crud_site.update(self.db, db_obj=site, obj_in=site_in)
        # 预加载租户信息以填充 tenant_slug
        await self.db.refresh(site, ["tenant"])

        # 注册提交后回调
        from app.db.transaction import on_commit

        on_commit(self.db, self._after_site_change)

        return site

    @transactional()
    async def delete_site(self, site_id: int) -> None:
        """删除站点及其关联数据"""
        success = await crud_site.remove_with_relationships(self.db, id=site_id)
        if not success:
            raise NotFoundException(detail=f"站点 {site_id} 不存在")

        # 注册提交后回调
        from app.db.transaction import on_commit

        on_commit(self.db, self._after_site_change)

    @cached(ttl=60, key_prefix="service:sites:client_list")
    @transactional()
    async def list_client_sites(
        self,
        page: int,
        size: int,
        tenant_id: int | None,
        tenant_slug: str | None,
        keyword: str | None,
    ) -> tuple[list[SiteModel], Paginator]:
        """获取激活的站点列表（客户端）"""
        sites, total = await crud_site.list_active(
            self.db,
            page=page,
            size=size,
            tenant_id=tenant_id,
            tenant_slug=tenant_slug,
            keyword=keyword,
        )

        paginator = Paginator(page=page, size=size, total=total)
        return sites, paginator

    @cached(ttl=60, key_prefix="service:sites:client_detail")
    @transactional()
    async def get_client_site(
        self, site_id: int | None = None, slug: str | None = None
    ) -> SiteModel:
        """获取激活的站点详情（客户端）"""
        site = await crud_site.get_active(self.db, site_id=site_id, slug=slug)
        if not site:
            raise NotFoundException(detail=f"站点 {site_id or slug} 不存在")

        return site

    @transactional()
    async def get_site_by_api_token(self, token: str) -> SiteModel:
        """根据 API Token 获取站点，并进行基础校验。"""
        site = await crud_site.get_by_api_token(self.db, api_token=token)

        if not site:
            from app.core.web.exceptions import HTTPException

            raise HTTPException(status_code=401, detail="无效的 API 密钥")

        # 状态校验：检查站点是否被管理员禁用
        if site.status != "active":
            from app.core.web.exceptions import HTTPException

            raise HTTPException(status_code=403, detail="该站点已被禁用")

        return site


def get_site_service(
    db: AsyncSession = Depends(get_db),
) -> SiteService:
    """获取 SiteService 实例的依赖注入函数"""
    return SiteService(db)
