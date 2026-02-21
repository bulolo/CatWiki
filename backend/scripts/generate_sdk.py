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

"""
生成前端 SDK 脚本
根据后端 OpenAPI 规范自动生成 TypeScript SDK
"""

import json
import shutil
import subprocess
import sys
from pathlib import Path

# 项目路径
BACKEND_DIR = Path(__file__).parent.parent
FRONTEND_DIR = BACKEND_DIR.parent / "frontend"
FRONTEND_ADMIN_DIR = FRONTEND_DIR / "admin"
FRONTEND_CLIENT_DIR = FRONTEND_DIR / "client"

# SDK 输出目录
SDK_OUTPUTS = [
    FRONTEND_ADMIN_DIR / "src" / "lib" / "sdk",
    FRONTEND_CLIENT_DIR / "src" / "lib" / "sdk",
]

# API 配置
API_URL = "http://localhost:3000"
OPENAPI_ADMIN_URL = f"{API_URL}/openapi-admin.json"
OPENAPI_CLIENT_URL = f"{API_URL}/openapi-client.json"


def check_dependencies():
    """检查依赖"""
    print("🔍 检查依赖...")

    # 检查是否安装了 openapi-typescript-codegen
    try:
        subprocess.run(
            ["npx", "openapi-typescript-codegen", "--version"],
            capture_output=True,
            text=True,
            check=False,
        )
        print("  ✅ openapi-typescript-codegen 可用")
        return True
    except Exception:
        print("  ⚠️  openapi-typescript-codegen 未安装")
        return True  # npx 会自动下载


def download_openapi_specs():
    """下载 Admin 和 Client 的 OpenAPI 规范"""
    print("\n📥 下载 OpenAPI 规范...")

    import urllib.request

    specs = {}
    urls = {
        "admin": OPENAPI_ADMIN_URL,
        "client": OPENAPI_CLIENT_URL,
    }

    for name, url in urls.items():
        try:
            print(f"  下载 {name.upper()} 规范: {url}")
            with urllib.request.urlopen(url) as response:
                spec = json.loads(response.read().decode())

            # 保存到临时文件
            spec_file = BACKEND_DIR / f"openapi-{name}.json"
            with open(spec_file, "w", encoding="utf-8") as f:
                json.dump(spec, f, indent=2, ensure_ascii=False)

            specs[name] = (spec_file, spec)
            print(f"  ✅ {name.upper()} 规范已保存到: {spec_file}")

        except Exception as e:
            print(f"  ❌ 下载 {name.upper()} 规范失败: {e}")
            print("\n💡 提示: 请确保后端服务正在运行")
            print("  请先运行: make dev-up")
            sys.exit(1)

    return specs


def clean_old_sdk():
    """清理旧的 SDK 目录"""
    print("\n🧹 清理旧的 SDK 目录...")

    for sdk_dir in SDK_OUTPUTS:
        if sdk_dir.exists():
            try:
                shutil.rmtree(sdk_dir)
                print(f"  ✅ 已删除旧目录: {sdk_dir}")
            except Exception as e:
                print(f"  ⚠️  删除失败: {e}")
        else:
            print(f"  ℹ️  目录不存在，跳过: {sdk_dir}")


def generate_sdk(specs: dict):
    """生成 SDK 到多个目录"""
    print("\n🔨 生成 TypeScript SDK...")

    # SDK 配置：(规范名称, 输出目录, SDK名称)
    sdk_configs = [
        ("admin", FRONTEND_ADMIN_DIR / "src" / "lib" / "sdk", "CatWikiAdminSdk"),
        ("client", FRONTEND_CLIENT_DIR / "src" / "lib" / "sdk", "CatWikiClientSdk"),
    ]

    for spec_name, sdk_dir, sdk_name in sdk_configs:
        spec_file, spec = specs[spec_name]

        print(f"\n  📦 生成 {sdk_name} 到: {sdk_dir}")
        print(f"     包含 {len(spec.get('paths', {}))} 个接口")

        # 确保输出目录存在
        sdk_dir.mkdir(parents=True, exist_ok=True)

        # 确定工作目录
        frontend_root = (
            sdk_dir.parent.parent.parent if "src" in str(sdk_dir) else sdk_dir.parent.parent
        )

        # 使用 openapi-typescript-codegen 生成
        try:
            cmd = [
                "npx",
                "--yes",
                "openapi-typescript-codegen",
                "--input",
                str(spec_file),
                "--output",
                str(sdk_dir),
                "--client",
                "fetch",
                "--name",
                sdk_name,
                "--useOptions",
                "--exportCore",
                "true",
                "--exportServices",
                "true",
                "--exportModels",
                "true",
            ]

            result = subprocess.run(cmd, cwd=frontend_root, capture_output=True, text=True)

            if result.returncode == 0:
                print(f"  ✅ {sdk_name} 生成成功!")
            else:
                print("  ❌ 生成失败:")
                print(result.stderr)
                sys.exit(1)
        except Exception as e:
            print(f"  ❌ 错误: {e}")
            sys.exit(1)


def create_models_index(sdk_dir: Path):
    """创建 models/index.ts 文件"""
    models_dir = sdk_dir / "models"
    if not models_dir.exists():
        print(f"  ⚠️  Models 目录不存在: {models_dir}")
        return

    print(f"  📝 正在生成 models/index.ts ({models_dir})...")

    model_files = sorted([f.stem for f in models_dir.glob("*.ts") if f.name != "index.ts"])

    if not model_files:
        print("  ⚠️  没有找到模型文件")
        return

    exports = []
    exports.append("/* generated using openapi-typescript-codegen -- do not edit */")
    exports.append("/* istanbul ignore file */")
    exports.append("/* tslint:disable */")
    exports.append("/* eslint-disable */")
    exports.append("")

    for model in model_files:
        exports.append(f"export * from './{model}';")

    index_file = models_dir / "index.ts"
    with open(index_file, "w", encoding="utf-8") as f:
        f.write("\n".join(exports))

    print(f"  ✅ 已更新 {index_file} (包含 {len(model_files)} 个模型)")


def create_index_file():
    """创建 index.ts 文件"""
    print("\n📝 创建 index 文件...")

    sdk_configs = [
        (FRONTEND_ADMIN_DIR / "src" / "lib" / "sdk", "CatWikiAdminSdk", "Admin"),
        (FRONTEND_CLIENT_DIR / "src" / "lib" / "sdk", "CatWikiClientSdk", "Client"),
    ]

    for sdk_dir, sdk_class_name, display_name in sdk_configs:
        # 标准的 openapi-typescript-codegen 格式
        index_content = f"""/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export {{ {sdk_class_name} }} from './{sdk_class_name}';
export {{ OpenAPI }} from './core/OpenAPI';
export {{ ApiError }} from './core/ApiError';
export type {{ ApiRequestOptions }} from './core/ApiRequestOptions';
export type {{ ApiResult }} from './core/ApiResult';
export {{ CancelablePromise }} from './core/CancelablePromise';

// 导出所有模型到 Models 命名空间
export * as Models from './models';
"""

        index_file = sdk_dir / "index.ts"
        with open(index_file, "w", encoding="utf-8") as f:
            f.write(index_content)

        print(f"  ✅ 创建 {index_file}")


def main():
    """主函数"""
    print("=" * 60)
    print("CatWiki SDK 生成工具")
    print("=" * 60)

    # 1. 检查依赖
    check_dependencies()

    # 2. 下载 OpenAPI 规范（Admin 和 Client 分别下载）
    # 理由：先下载规范，确保后端已启动，防止误删 SDK 后下载失败导致整个前端报错
    specs = download_openapi_specs()

    # 3. 清理旧的 SDK 目录
    clean_old_sdk()

    # 4. 生成 SDK
    generate_sdk(specs)

    # 5. 创建 index 文件
    create_index_file()

    # 5.1 创建 models/index.ts (补充)
    for _, sdk_dir, _ in [
        ("admin", FRONTEND_ADMIN_DIR / "src" / "lib" / "sdk", "CatWikiAdminSdk"),
        ("client", FRONTEND_CLIENT_DIR / "src" / "lib" / "sdk", "CatWikiClientSdk"),
    ]:
        create_models_index(sdk_dir)

    # 6. 清理临时文件

    print("\n🧹 清理临时文件...")
    for name, (spec_file, _) in specs.items():
        if spec_file.exists():
            spec_file.unlink()
            print(f"  ✅ 已删除 {spec_file}")

    print("\n" + "=" * 60)
    print("✅ SDK 生成完成！")
    print("=" * 60)
    print("\n📁 输出位置:")
    print(f"  - Admin SDK: {FRONTEND_ADMIN_DIR / 'src' / 'lib' / 'sdk'} (7 个接口)")
    print(f"  - Client SDK: {FRONTEND_CLIENT_DIR / 'src' / 'lib' / 'sdk'} (5 个接口)")
    print("\n💡 在前端中使用:")
    print("   import { apiClient } from '@/lib/sdk'")
    print("   const docs = await apiClient.documents.listDocuments(...)")
    print()


if __name__ == "__main__":
    main()
