import babelParser from "@babel/eslint-parser";
import js from "@eslint/js";
export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.turbo/**",
      "apps/identity_service/**",
      "packages/ui/**",
      "packages/eslint-config/**",
    ],
  },
  {
    files: [
      "apps/{api,knowledge,worker,web}/**/*.{ts,tsx}",
      "packages/{contracts,server}/**/*.ts",
    ],
    ...js.configs.recommended,
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: { presets: ["@babel/preset-typescript"] },
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-undef": "off",
      "no-unused-vars": "off",
      "no-control-regex": "off",
    },
  },
  {
    files: ["**/*.tsx"],
    languageOptions: {
      parserOptions: {
        babelOptions: {
          presets: ["@babel/preset-typescript"],
          plugins: ["@babel/plugin-syntax-jsx"],
        },
      },
    },
  },
];
