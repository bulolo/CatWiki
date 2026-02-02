import os
from typing import Any
from urllib.parse import quote_plus

from pydantic import Field, computed_field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """应用配置管理"""

    # 基础配置
    PROJECT_NAME: str = "CatWiki API"
    DESCRIPTION: str = "CatWiki 后端 API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/v1"  # 客户端 API
    ADMIN_API_V1_STR: str = "/admin/v1"  # 管理后台 API

    # 环境配置
    ENVIRONMENT: str = Field(default="local", pattern="^(local|dev|prod)$")
    DEBUG: bool = Field(default=False)



    # 数据库配置
    POSTGRES_SERVER: str = Field(default="localhost")
    POSTGRES_USER: str = Field(default="postgres")
    POSTGRES_PASSWORD: str = Field(default="postgres")
    POSTGRES_DB: str = Field(default="catwiki")
    POSTGRES_PORT: int = Field(default=5432, ge=1, le=65535)

    # 数据库连接池配置
    DB_POOL_SIZE: int = Field(default=10, ge=1, le=50)
    DB_MAX_OVERFLOW: int = Field(default=20, ge=0, le=100)
    DB_POOL_TIMEOUT: int = Field(default=30, ge=1)
    DB_POOL_RECYCLE: int = Field(default=3600, ge=300)

    @computed_field
    @property
    def DATABASE_URL(self) -> str:
        """生成异步数据库连接 URL（使用 asyncpg 驱动）"""
        encoded_user = quote_plus(self.POSTGRES_USER)
        encoded_password = quote_plus(self.POSTGRES_PASSWORD)
        return (
            f"postgresql+asyncpg://{encoded_user}:{encoded_password}"
            f"@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # CORS 配置
    BACKEND_CORS_ORIGINS: str | list[str] = Field(
        default="http://localhost:8001,http://localhost:8002"
    )

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Any) -> list[str]:
        """解析 CORS 源配置"""
        if isinstance(v, str):
            # 处理逗号分隔的字符串
            if not v:
                return []
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        elif isinstance(v, list):
            return v
        raise ValueError(f"无效的 CORS 配置: {v}")


    # 安全配置
    SECRET_KEY: str = Field(
        default="your-secret-key-change-this-in-production",
        min_length=32,
    )
    ALGORITHM: str = "HS256"
    # Token 过期时间（分钟），默认 7 天（10080 分钟），最大 30 天（43200 分钟）
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=10080, ge=1, le=43200)

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v: str, info) -> str:
        """验证生产环境必须修改默认密钥"""
        # 获取环境变量
        environment = info.data.get("ENVIRONMENT", "local")

        # 生产环境不允许使用默认密钥
        if environment == "prod" and v == "your-secret-key-change-this-in-production":
            raise ValueError(
                "🔒 生产环境安全检查失败: SECRET_KEY 仍使用默认值! "
                "请在 .env.prod 中设置一个强密钥 (建议使用: openssl rand -hex 32)"
            )

        # 检查密钥强度（生产环境）
        if environment == "prod" and len(v) < 32:
            raise ValueError(
                f"🔒 生产环境安全检查失败: SECRET_KEY 长度不足 ({len(v)} < 32)! "
                "请使用至少 32 字符的强密钥"
            )

        return v


    # 日志配置
    LOG_LEVEL: str = Field(default="INFO", pattern="^(DEBUG|INFO|WARNING|ERROR|CRITICAL)$")
    DB_ECHO: bool = Field(default=False, description="是否输出 SQL 日志")

    # RustFS 对象存储配置
    RUSTFS_ENDPOINT: str = Field(default="localhost:9000", description="RustFS 服务地址")
    RUSTFS_ACCESS_KEY: str = Field(default="rustfsadmin", description="RustFS 访问密钥")
    RUSTFS_SECRET_KEY: str = Field(default="rustfsadmin", description="RustFS 密钥")
    RUSTFS_BUCKET_NAME: str = Field(default="catwiki", description="RustFS 存储桶名称")
    RUSTFS_USE_SSL: bool = Field(default=False, description="是否使用 SSL")
    RUSTFS_REGION: str = Field(default="us-east-1", description="RustFS 区域")
    RUSTFS_PUBLIC_URL: str = Field(
        default="http://localhost:9000",
        description="RustFS 公共访问地址（用于生成外部可访问的 URL）"
    )
    RUSTFS_PUBLIC_BUCKET: bool = Field(
        default=True,
        description="是否将 RustFS 存储桶设置为公共可读"
    )

    # AI 服务配置 (OpenAI Compatible)
    AI_CHAT_API_KEY: str | None = Field(default=None)
    AI_CHAT_API_BASE: str | None = Field(default=None)
    AI_CHAT_MODEL: str | None = Field(default=None)

    AI_EMBEDDING_API_KEY: str | None = Field(default=None)
    AI_EMBEDDING_API_BASE: str | None = Field(default=None)
    AI_EMBEDDING_MODEL: str | None = Field(default=None)
    AI_EMBEDDING_DIMENSION: int | None = Field(default=None)

    AI_RERANK_API_KEY: str | None = Field(default=None)
    AI_RERANK_API_BASE: str | None = Field(default=None)
    AI_RERANK_MODEL: str | None = Field(default=None)

    AI_VL_API_KEY: str | None = Field(default=None)
    AI_VL_API_BASE: str | None = Field(default=None)
    AI_VL_MODEL: str | None = Field(default=None)

    # 文件上传配置
    UPLOAD_MAX_SIZE: int = Field(
        default=100 * 1024 * 1024,  # 100MB
        description="文件上传最大大小（字节）"
    )
    UPLOAD_ALLOWED_EXTENSIONS: str = Field(
        default="jpg,jpeg,png,gif,webp,svg,pdf,doc,docx,xls,xlsx,ppt,pptx,txt,md,zip",
        description="允许上传的文件扩展名（逗号分隔）"
    )

    @property
    def allowed_extensions_set(self) -> set[str]:
        """返回允许的扩展名集合"""
        return {ext.strip().lower() for ext in self.UPLOAD_ALLOWED_EXTENSIONS.split(",") if ext.strip()}

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


def get_env_files() -> list[str]:
    """获取环境文件列表，按顺序加载（后面的覆盖前面的）"""
    env = os.getenv("ENV", "local")
    env_files = [".env"]  # 基础配置
    
    specific_file = {
        "local": ".env.local",
        "dev": ".env.dev",
        "prod": ".env.prod",
    }.get(env)
    
    if specific_file:
        env_files.append(specific_file)
        
    return env_files


# 根据环境加载配置文件
settings = Settings(_env_file=get_env_files())

