// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      "prettier/prettier": ["error", { endOfLine: "auto" }],
    },
  },
  // Hexagonal layer boundaries: dependencies point inward only
  // (adapters -> application -> domain).
  {
    files: ['src/**/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...infrastructureImports('domain'),
            layerImport('application', 'domain'),
            layerImport('adapters', 'domain'),
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...infrastructureImports('application'),
            layerImport('adapters', 'application'),
          ],
        },
      ],
    },
  },
  {
    // Use-case specs may use the in-memory adapters as port fakes.
    files: ['src/**/application/**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: infrastructureImports('application') },
      ],
    },
  },
);

/** @param {string} layer */
function infrastructureImports(layer) {
  return [
    {
      regex: '^(@nestjs/|socket\\.io|better-sqlite3$|node:|crypto$)',
      message: `The ${layer} layer must not depend on frameworks or infrastructure. Define a port and implement it in an adapter.`,
    },
  ];
}

/**
 * @param {string} target
 * @param {string} layer
 */
function layerImport(target, layer) {
  return {
    regex: `(^|/)${target}(/|$)`,
    message: `The ${layer} layer must not import from ${target}/ (dependencies point inward only).`,
  };
}
