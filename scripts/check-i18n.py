#!/usr/bin/env python3
"""
检查 admin 和 client 前端所有 i18n key 是否在 zh.json 和 en.json 中都存在。
用法: python3 scripts/check-i18n.py
"""
import json, re, os, sys

ROOT = os.path.join(os.path.dirname(__file__), '..')

TARGETS = [
    ('Admin',  os.path.join(ROOT, 'frontend', 'admin')),
    ('Client', os.path.join(ROOT, 'frontend', 'client')),
]

def resolve_key(data, key_path):
    parts = key_path.split('.')
    val = data
    for p in parts:
        if isinstance(val, dict) and p in val:
            val = val[p]
        else:
            return None
    return val

def check_project(name, base_dir):
    zh_path = os.path.join(base_dir, 'src', 'messages', 'zh.json')
    en_path = os.path.join(base_dir, 'src', 'messages', 'en.json')
    src_dir = os.path.join(base_dir, 'src')

    if not os.path.exists(zh_path) or not os.path.exists(en_path):
        print(f'  ⚠️  Skipped (messages not found)')
        return []

    zh = json.load(open(zh_path, encoding='utf-8'))
    en = json.load(open(en_path, encoding='utf-8'))

    # Pattern to find: const <var> = useTranslations('<namespace>')
    decl_pattern = re.compile(r'\bconst\s+(\w+)\s*=\s*useTranslations\(["\']([^"\']+)["\']\)')

    issues = []
    for root, dirs, files in os.walk(src_dir):
        dirs[:] = [d for d in dirs if d not in ['sdk', 'node_modules', '.next']]
        for fname in files:
            if not fname.endswith(('.tsx', '.ts')):
                continue
            fpath = os.path.join(root, fname)
            content = open(fpath, encoding='utf-8').read()

            # Find all declarations with their positions
            declarations = [(m.start(), m.group(1), m.group(2))
                            for m in decl_pattern.finditer(content)]
            if not declarations:
                continue

            short = fpath.replace(src_dir + '/', '')

            for i, (pos, var_name, namespace) in enumerate(declarations):
                # Scope: from this declaration to the next redeclaration of same var,
                # or end of file if none.
                next_redecl = None
                for j in range(i + 1, len(declarations)):
                    if declarations[j][1] == var_name:
                        next_redecl = declarations[j][0]
                        break
                scope = content[pos: next_redecl] if next_redecl else content[pos:]

                call_pattern = re.compile(
                    rf'\b{re.escape(var_name)}(?:\.rich)?\(\s*["\']([^"\']+)["\']'
                )
                key_calls = call_pattern.findall(scope)

                zh_ns = resolve_key(zh, namespace) or {}
                en_ns = resolve_key(en, namespace) or {}

                for key in key_calls:
                    if resolve_key(zh_ns, key) is None:
                        issues.append(f'  ZH MISSING: {namespace}.{key}  ({short})')
                    if resolve_key(en_ns, key) is None:
                        issues.append(f'  EN MISSING: {namespace}.{key}  ({short})')

    return sorted(set(issues))

def main():
    has_error = False
    for name, base_dir in TARGETS:
        print(f'[{name}]')
        issues = check_project(name, base_dir)
        if issues:
            has_error = True
            print(f'  ❌ Found {len(issues)} missing i18n keys:')
            for i in issues:
                print(i)
        else:
            print(f'  ✅ All i18n keys present')
        print()

    if has_error:
        sys.exit(1)

if __name__ == '__main__':
    main()
