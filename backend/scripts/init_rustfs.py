#!/usr/bin/env python3
"""
初始化 RustFS 对象存储
- 验证 .env 配置的访问密钥
- 等待 RustFS 服务就绪
- 创建默认存储桶
- 设置存储桶策略（可选）
"""

import logging
import os
import sys
import time

from app.core.logger import setup_logging

setup_logging()
logger = logging.getLogger(__name__)

try:
    from minio import Minio
    from minio.error import S3Error
except ImportError:
    logger.warning("⚠️  minio 包未安装，跳过 RustFS 初始化")
    sys.exit(0)


def validate_rustfs_config() -> bool:
    """验证 RustFS 配置是否正确"""
    logger.debug("🔍 验证 RustFS 配置...")

    # 检查必需的环境变量
    required_vars = {
        "RUSTFS_ENDPOINT": os.getenv("RUSTFS_ENDPOINT"),
        "RUSTFS_ACCESS_KEY": os.getenv("RUSTFS_ACCESS_KEY"),
        "RUSTFS_SECRET_KEY": os.getenv("RUSTFS_SECRET_KEY"),
        "RUSTFS_ROOT_USER": os.getenv("RUSTFS_ROOT_USER"),
        "RUSTFS_ROOT_PASSWORD": os.getenv("RUSTFS_ROOT_PASSWORD"),
    }

    missing_vars = [key for key, value in required_vars.items() if not value]
    if missing_vars:
        logger.warning(f"⚠️  缺少必需的环境变量: {', '.join(missing_vars)}")
        return False

    # 检查访问密钥是否与 Root 用户一致
    access_key = required_vars["RUSTFS_ACCESS_KEY"]
    root_user = required_vars["RUSTFS_ROOT_USER"]

    if access_key != root_user:
        logger.warning(f"⚠️  警告: RUSTFS_ACCESS_KEY ({access_key}) 与 RUSTFS_ROOT_USER ({root_user}) 不一致")
        logger.warning(f"   建议设置 RUSTFS_ACCESS_KEY={root_user}")

    # 检查是否使用默认密钥
    default_keys = ["rustfsadmin", "minioadmin", "admin"]
    if access_key in default_keys or required_vars["RUSTFS_SECRET_KEY"] in default_keys:
        logger.warning("⚠️  警告: 检测到使用默认密钥！")
        logger.warning(f"   当前 ACCESS_KEY: {access_key}")
        logger.warning("   🔒 生产环境请务必修改为安全的随机密钥")

    logger.debug("✅ RustFS 配置验证通过")
    logger.debug(f"   Endpoint: {required_vars['RUSTFS_ENDPOINT']}")
    logger.debug(f"   Access Key: {access_key}")
    logger.debug(f"   Root User: {root_user}")

    return True


def get_rustfs_client() -> Minio | None:
    """创建 RustFS 客户端，使用 .env 中配置的访问密钥"""
    try:
        endpoint = os.getenv("RUSTFS_ENDPOINT", "rustfs:9000")
        access_key = os.getenv("RUSTFS_ACCESS_KEY", os.getenv("RUSTFS_ROOT_USER", "rustfsadmin"))
        secret_key = os.getenv("RUSTFS_SECRET_KEY", os.getenv("RUSTFS_ROOT_PASSWORD", "rustfsadmin"))
        use_ssl = os.getenv("RUSTFS_USE_SSL", "false").lower() == "true"

        logger.debug("📡 连接 RustFS...")
        logger.debug(f"   Endpoint: {endpoint}")
        logger.debug(f"   Access Key: {access_key}")
        logger.debug(f"   SSL: {use_ssl}")

        client = Minio(
            endpoint=endpoint,
            access_key=access_key,
            secret_key=secret_key,
            secure=use_ssl,
        )
        return client
    except Exception as e:
        logger.error(f"❌ 创建 RustFS 客户端失败: {e}")
        return None


def wait_for_rustfs(client: Minio, max_retries: int = 30) -> bool:
    """等待 RustFS 服务就绪"""
    logger.info("⏳ 等待 RustFS 服务就绪...")

    for retry in range(max_retries):
        try:
            # 尝试列出存储桶来测试连接
            list(client.list_buckets())
            logger.debug("✅ RustFS 服务已就绪")
            return True
        except Exception as e:
            if retry < max_retries - 1:
                logger.info(f"   等待中... ({retry + 1}/{max_retries})")
                time.sleep(2)
            else:
                logger.error(f"❌ RustFS 服务连接超时: {e}")
                return False

    return False


def create_bucket(client: Minio, bucket_name: str) -> bool:
    """创建存储桶"""
    try:
        # 检查存储桶是否已存在
        if client.bucket_exists(bucket_name):
            logger.info(f"✅ 存储桶 '{bucket_name}' 已存在")
            return True

        # 创建存储桶
        client.make_bucket(bucket_name)
        logger.info(f"✅ 存储桶 '{bucket_name}' 创建成功")
        return True

    except S3Error as e:
        logger.error(f"❌ 创建存储桶失败: {e}")
        return False
    except Exception as e:
        logger.error(f"❌ 创建存储桶时发生未知错误: {e}")
        return False


def set_bucket_policy(client: Minio, bucket_name: str, public: bool = True, allow_list: bool = False) -> bool:
    """设置存储桶策略（支持 RustFS/MinIO）

    Args:
        client: Minio 客户端
        bucket_name: 存储桶名称
        public: 是否允许公共读取文件
        allow_list: 是否允许公共列出文件（需要 public=True，会让 Console 显示"公共"）
    """
    if not public:
        # 移除公共访问策略（恢复私有）
        try:
            client.delete_bucket_policy(bucket_name)
            logger.info("✅ 存储桶策略: 私有（需要签名访问）")
        except Exception:
            logger.info("✅ 存储桶策略: 私有（默认）")
        return True

    try:
        import json

        # 构建策略语句（使用 MinIO Console 的格式）
        if allow_list:
            # MinIO Console "公有" 格式：所有公共读取权限在一个语句中
            statements = [
                {
                    "Effect": "Allow",
                    "Principal": {"AWS": ["*"]},
                    "Action": [
                        "s3:GetBucketLocation",
                        "s3:GetObjectTagging",
                        "s3:GetObject",
                        "s3:ListBucket"
                    ],
                    "Resource": [f"arn:aws:s3:::{bucket_name}/*"]
                }
            ]
        else:
            # 仅公共读取（不列出）
            statements = [
                {
                    "Effect": "Allow",
                    "Principal": {"AWS": ["*"]},
                    "Action": ["s3:GetObject"],
                    "Resource": [f"arn:aws:s3:::{bucket_name}/*"]
                }
            ]

        policy = {
            "Version": "2012-10-17",
            "Statement": statements
        }

        policy_json = json.dumps(policy)
        logger.debug(f"📝 设置策略: {policy_json}")

        # 设置策略
        client.set_bucket_policy(bucket_name, policy_json)
        policy_desc = "完全公开" if allow_list else "公共读取（推荐）"
        logger.info(f"✅ 存储桶 '{bucket_name}' 策略已设置（{policy_desc}）")

        # 验证策略是否生效
        logger.debug("🔍 验证策略...")
        try:
            current_policy = client.get_bucket_policy(bucket_name)
            policy_obj = json.loads(current_policy)

            # 检查策略内容
            if policy_obj.get("Statement"):
                has_public_read = False
                for stmt in policy_obj["Statement"]:
                    principal = stmt.get("Principal", {})
                    aws_principal = principal.get("AWS") if isinstance(principal, dict) else principal

                    # 检查是否为公共访问 (可能是 "*" 或 ["*"])
                    is_public = aws_principal == "*" or (isinstance(aws_principal, list) and "*" in aws_principal)

                    if (stmt.get("Effect") == "Allow" and
                        "s3:GetObject" in stmt.get("Action" if isinstance(stmt.get("Action"), list) else ["Action"], [stmt.get("Action")]) and
                        is_public):
                        has_public_read = True
                        break

                if has_public_read:
                    logger.debug("✅ 策略验证成功: 公共读取已生效")
                else:
                    logger.warning("⚠️  警告: 策略已设置但内容可能不正确")
                    logger.warning(f"   当前策略: {current_policy}")
            else:
                logger.warning("⚠️  警告: 策略已设置但无法解析")
        except Exception as e:
            logger.warning(f"⚠️  无法验证策略 (这可能正常): {e}")
            logger.warning("   提示: 访问 http://localhost:9001 手动检查桶策略")

        return True

    except Exception as e:
        logger.error(f"❌ 设置存储桶策略失败: {e}")
        logger.error(f"   Bucket: {bucket_name}")
        logger.error("   提示: 请手动在 RustFS Console (http://localhost:9001) 中设置公共读取策略")
        return False


def init_rustfs() -> int:
    """初始化 RustFS"""
    logger.info("🗄️  初始化 RustFS 对象存储...")


    # 验证配置
    if not validate_rustfs_config():
        logger.warning("⚠️  RustFS 配置验证失败，跳过初始化")
        return 0



    # 创建客户端
    client = get_rustfs_client()
    if not client:
        logger.warning("⚠️  跳过 RustFS 初始化")
        return 0

    # 等待服务就绪
    if not wait_for_rustfs(client):
        logger.warning("⚠️  RustFS 服务未就绪，跳过初始化")
        return 0

    # 获取存储桶名称
    bucket_name = os.getenv("RUSTFS_BUCKET_NAME", "catwiki")

    # 创建默认存储桶
    bucket_created = create_bucket(client, bucket_name)
    if not bucket_created:
        logger.warning("⚠️  创建存储桶失败，但继续尝试设置策略...")

    # 设置存储桶策略（强制设置，无论桶是新建还是已存在）
    logger.info("")
    public = os.getenv("RUSTFS_PUBLIC_BUCKET", "true").lower() == "true"
    allow_list = os.getenv("RUSTFS_ALLOW_LIST_BUCKET", "true").lower() == "true"  # 默认允许列出

    logger.info("🔧 配置存储桶访问策略...")
    if not public:
        logger.info("   策略类型: 私有访问")
    elif allow_list:
        logger.info("   策略类型: 完全公开")
    else:
        logger.info("   策略类型: 公共读取")
        logger.info("   说明: 文件可公开访问，但文件列表需要认证")

    if not set_bucket_policy(client, bucket_name, public, allow_list):
        logger.warning("⚠️  策略设置失败，但不影响基本功能")
        logger.warning("   说明: 文件上传仍可正常工作，但可能需要预签名 URL 访问")

    logger.info(f"✅ RustFS 初始化完成！Endpoint: {os.getenv('RUSTFS_ENDPOINT', 'rustfs:9000')}, Console: http://localhost:{os.getenv('RUSTFS_CONSOLE_PORT', '9001')}")

    return 0


if __name__ == "__main__":
    try:
        sys.exit(init_rustfs())
    except KeyboardInterrupt:
        logger.warning("\n⚠️  初始化被中断")
        sys.exit(1)
    except Exception as e:
        logger.error(f"❌ 初始化失败: {e}", exc_info=True)
        # 初始化失败不影响后端启动
        sys.exit(0)

