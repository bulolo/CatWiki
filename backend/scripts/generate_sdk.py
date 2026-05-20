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

"""生成前端 SDK 脚本。

根据后端 OpenAPI 规范使用 orval (mode=tags + react-query) 生成 TypeScript SDK。
每个 frontend 项目 (admin / client) 自带 ``orval.config.ts``，本脚本只负责：

1. 下载后端最新的 OpenAPI spec
2. 把 OpenAPI 3.1 ``contentMediaType`` binary 字段规范化为 3.0 ``format: binary``
   （兼容当前 orval 7.x，避免 multipart 文件字段退化为 string）
3. 落盘 spec 到 frontend 项目内的临时位置
4. 调用 ``pnpm orval`` 让前端项目内的 ``orval.config.ts`` 接管真正的生成
5. 清理临时 spec

产物按 tag 分文件（每 tag 一个目录 + sdk.ts），同时生成 TanStack Query hooks。
"""

import json
import subprocess
import sys
import urllib.request
from pathlib import Path
from typing import Any

BACKEND_DIR = Path(__file__).parent.parent
FRONTEND_DIR = BACKEND_DIR.parent / "frontend"

API_URL = "http://localhost:3000"

# (spec 名称, OpenAPI URL, frontend 项目根目录)
SDK_TARGETS = [
    ("admin", f"{API_URL}/openapi-admin.json", FRONTEND_DIR / "admin"),
    ("client", f"{API_URL}/openapi-client.json", FRONTEND_DIR / "client"),
]


def download_and_normalize_specs() -> list[tuple[str, Path, Path]]:
    """下载所有 OpenAPI 规范并落盘到 frontend 项目内。

    返回 [(name, spec_file_path, frontend_root), ...]。
    """
    print("\n📥 下载 + 规范化 OpenAPI specs...")

    results: list[tuple[str, Path, Path]] = []
    for name, url, frontend_root in SDK_TARGETS:
        try:
            print(f"  下载 {name.upper()}: {url}")
            with urllib.request.urlopen(url) as response:
                spec = json.loads(response.read().decode())

            _normalize_binary_fields(spec)
            _unwrap_api_response_envelope(spec)

            # 落盘到 frontend/<admin|client>/openapi.json，方便 orval.config.ts 直接引用相对路径
            spec_file = frontend_root / "openapi.json"
            spec_file.write_text(json.dumps(spec, indent=2, ensure_ascii=False), encoding="utf-8")
            print(f"  ✅ {name.upper()} → {spec_file}")
            results.append((name, spec_file, frontend_root))
        except Exception as e:
            print(f"  ❌ 下载 {name.upper()} 失败: {e}")
            print("\n💡 提示: 请确保后端服务正在运行 (make dev-up)")
            sys.exit(1)

    return results


def _normalize_binary_fields(spec: dict) -> None:
    """把 OpenAPI 3.1 ``contentMediaType`` binary 字段改写为 3.0 ``format: binary``。

    FastAPI 0.115+ 输出 OpenAPI 3.1 表达 multipart 文件字段：
    ``{"type": "string", "contentMediaType": "application/octet-stream"}``。
    orval 8.x 仍只识别 3.0 风格 ``format: binary``，否则把字段生成成 ``string``，
    导致前端传 ``File`` 类型通不过 tsc。这里就地重写为 3.0 标记，让生成器正确产
    出 ``Blob``。
    """
    schemas = (spec.get("components") or {}).get("schemas") or {}
    for schema in schemas.values():
        for prop in (schema.get("properties") or {}).values():
            _rewrite_binary_marker(prop)
            if prop.get("type") == "array":
                _rewrite_binary_marker(prop.get("items") or {})


def _rewrite_binary_marker(node: dict) -> None:
    if (
        isinstance(node, dict)
        and node.get("type") == "string"
        and "contentMediaType" in node
        and "format" not in node
    ):
        node.pop("contentMediaType", None)
        node["format"] = "binary"


def _unwrap_api_response_envelope(spec: dict) -> None:
    """把 ``ApiResponse_X`` envelope schema 在 OpenAPI 层面展平为 ``X``。

    CatWiki 后端所有响应统一裹 ``{code, msg, data}`` envelope，OpenAPI 把它表达
    成 ``ApiResponse_Site_`` 这样的 schema。如果原样喂给 codegen，前端 useQuery
    会拿到 envelope 对象（``data.data.list`` 三层访问）；而 ``orval`` 又不支持
    "按 schema 名重写类型"的选项。

    解法：在 spec 落盘前，遍历整个 OpenAPI：
    1. 把所有 ``$ref: ApiResponse_X_`` 节点就地替换为 ``ApiResponse_X_.data``
       字段的 schema（即剥去 envelope，只保留 ``data`` 类型）
    2. 删除 ``ApiResponse_X_`` schema 定义本身

    配合 mutator 里的 envelope 解包逻辑（``customFetch`` 已经在做），运行时和
    类型完全对齐 —— 业务侧 ``useListAdminSites().data?.list`` 零层多余的 .data。

    注意：``ApiResponseNoneType``（DELETE 等返回 ``{code, msg, data: null}``）
    展开后是 ``{type: 'null'}``，orval 会把它生成成 ``null | undefined``，业务
    侧用 ``void`` 处理即可。
    """
    schemas = (spec.get("components") or {}).get("schemas") or {}
    envelope_to_data: dict[str, dict] = {}
    for name, schema in list(schemas.items()):
        if not name.startswith("ApiResponse"):
            continue
        data_field = (schema.get("properties") or {}).get("data")
        if data_field is None:
            continue
        # 复制一份避免后续替换时多次 mutate
        envelope_to_data[name] = json.loads(json.dumps(data_field))

    if not envelope_to_data:
        return

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            ref = node.get("$ref")
            if isinstance(ref, str) and ref.startswith("#/components/schemas/"):
                schema_name = ref.rsplit("/", 1)[-1]
                replacement = envelope_to_data.get(schema_name)
                if replacement is not None:
                    node.clear()
                    node.update(json.loads(json.dumps(replacement)))
                    return
            for v in list(node.values()):
                walk(v)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(spec)

    for name in envelope_to_data:
        schemas.pop(name, None)


def run_orval(targets: list[tuple[str, Path, Path]]) -> None:
    """对每个 frontend 项目调用 ``pnpm orval``，由项目内的 orval.config.ts 接管。"""
    print("\n🔨 生成 SDK (orval)...")
    for name, _spec_file, frontend_root in targets:
        config_file = frontend_root / "orval.config.ts"
        if not config_file.exists():
            print(f"  ❌ 缺少 {config_file}")
            print("     请在 frontend 项目内放置 orval.config.ts")
            sys.exit(1)
        print(f"\n  📦 {name.upper()} ({frontend_root})")
        result = subprocess.run(
            ["pnpm", "orval", "--config", "orval.config.ts"],
            cwd=frontend_root,
            check=False,
        )
        if result.returncode != 0:
            print(f"  ❌ {name.upper()} 生成失败")
            sys.exit(result.returncode)
        print(f"  ✅ {name.upper()} 生成成功")


def cleanup_specs(targets: list[tuple[str, Path, Path]]) -> None:
    """删除临时 OpenAPI spec 文件（避免提交到 git）。"""
    print("\n🧹 清理临时 spec 文件...")
    for _name, spec_file, _root in targets:
        if spec_file.exists():
            spec_file.unlink()
            print(f"  ✅ 已删除 {spec_file}")


def main() -> None:
    print("=" * 60)
    print("CatWiki SDK 生成工具 (orval)")
    print("=" * 60)

    # 1. 下载 + 规范化 spec
    targets = download_and_normalize_specs()

    try:
        # 2. 让 orval 按各自配置生成
        run_orval(targets)
    finally:
        # 3. 无论成功失败都清理临时 spec
        cleanup_specs(targets)

    print("\n" + "=" * 60)
    print("✅ SDK 生成完成！")
    print("=" * 60)
    print("\n📁 产物位置由各 frontend 项目的 orval.config.ts 决定")
    print("\n💡 在前端中使用:")
    print("   import { useListAdminSites } from '@/lib/sdk/admin-sites'")
    print("   const { data } = useListAdminSites({ page: 1 })")


if __name__ == "__main__":
    main()
