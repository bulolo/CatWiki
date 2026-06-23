import nextVitals from "eslint-config-next/core-web-vitals"

const eslintConfig = [
  {
    ignores: ["next-env.d.ts", ".next/**"],
  },
  ...nextVitals,
  {
    rules: {
      "react-hooks/immutability": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/set-state-in-effect": "off",
      quotes: ["error", "double", { avoidEscape: true, allowTemplateLiterals: true }],
      semi: ["error", "never"],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/components/ui/*"],
              message: "请从 '@/components/ui' barrel 导入，避免直接引用单个文件。",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/components/ui/**"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    files: ["src/lib/sdk/**", "src/messages/**"],
    rules: {
      quotes: "off",
      semi: "off",
      "no-restricted-imports": "off",
    },
  },
]

export default eslintConfig
