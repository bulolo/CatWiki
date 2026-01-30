"""
系统配置 API 端点
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_active_user
from app.core.exceptions import NotFoundException
from app.crud.system_config import crud_system_config
from app.db.database import get_db
from app.models.user import User
from app.schemas.response import ApiResponse
from app.schemas.system_config import (
    AIConfigUpdate,
    BotConfigUpdate,
    SystemConfigResponse,
)

router = APIRouter()

# 配置键常量
AI_CONFIG_KEY = "ai_config"
BOT_CONFIG_KEY = "bot_config"


@router.get("/ai-config", response_model=ApiResponse[SystemConfigResponse | None], operation_id="getAdminAiConfig")
async def get_ai_config(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[SystemConfigResponse | None]:
    """
    获取 AI 模型配置

    返回当前的 AI 模型配置，包括自动模式和手动模式的设置
    """
    config = await crud_system_config.get_by_key(db, config_key=AI_CONFIG_KEY)

    if not config:
        # 返回默认配置
        return ApiResponse.ok(data=None, msg="暂无配置，将返回默认值")

    return ApiResponse.ok(data=config, msg="获取成功")


@router.put("/ai-config", response_model=ApiResponse[SystemConfigResponse], operation_id="updateAdminAiConfig")
async def update_ai_config(
    config_in: AIConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[SystemConfigResponse]:
    """
    更新 AI 模型配置

    - **mode**: 配置模式（auto 或 manual）
    - **autoConfig**: 自动模式配置
    - **manualConfig**: 手动模式配置
    """
    config_value = config_in.model_dump(mode='json')

    config = await crud_system_config.update_by_key(
        db,
        config_key=AI_CONFIG_KEY,
        config_value=config_value
    )

    return ApiResponse.ok(data=config, msg="AI 配置更新成功")


@router.get("/bot-config", response_model=ApiResponse[SystemConfigResponse | None], operation_id="getAdminBotConfig")
async def get_bot_config(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[SystemConfigResponse | None]:
    """
    获取机器人配置

    返回当前的机器人配置，包括网页挂件、API 接口和微信公众号设置
    """
    config = await crud_system_config.get_by_key(db, config_key=BOT_CONFIG_KEY)

    if not config:
        # 返回默认配置
        return ApiResponse.ok(data=None, msg="暂无配置，将返回默认值")

    return ApiResponse.ok(data=config, msg="获取成功")


@router.put("/bot-config", response_model=ApiResponse[SystemConfigResponse], operation_id="updateAdminBotConfig")
async def update_bot_config(
    config_in: BotConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[SystemConfigResponse]:
    """
    更新机器人配置

    - **webWidget**: 网页挂件配置
    - **apiBot**: API 机器人配置
    - **wechat**: 微信公众号配置
    """
    config_value = config_in.model_dump(mode='json')

    config = await crud_system_config.update_by_key(
        db,
        config_key=BOT_CONFIG_KEY,
        config_value=config_value
    )

    return ApiResponse.ok(data=config, msg="机器人配置更新成功")


@router.get("", response_model=ApiResponse[dict], operation_id="listAdminConfigs")
async def get_all_configs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[dict]:
    """
    获取所有配置（便捷接口）

    一次性获取所有系统配置
    """
    ai_config = await crud_system_config.get_by_key(db, config_key=AI_CONFIG_KEY)
    bot_config = await crud_system_config.get_by_key(db, config_key=BOT_CONFIG_KEY)

    return ApiResponse.ok(
        data={
            "aiConfig": ai_config.config_value if ai_config else None,
            "botConfig": bot_config.config_value if bot_config else None,
        },
        msg="获取成功"
    )


@router.delete("/{config_key}", response_model=ApiResponse[dict], operation_id="deleteAdminConfig")
async def delete_config(
    config_key: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[dict]:
    """
    删除指定配置

    - **config_key**: 配置键（如 'ai_config' 或 'bot_config'）
    """
    success = await crud_system_config.delete_by_key(db, config_key=config_key)

    if not success:
        raise NotFoundException(detail=f"配置 {config_key} 不存在")

    return ApiResponse.ok(data={"deleted": True}, msg="配置删除成功")
