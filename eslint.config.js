const { defineConfig } = require('eslint/config');
const expo = require('eslint-config-expo/flat');
const tseslint = require('typescript-eslint');
module.exports = defineConfig([
  expo,
  {
    files: ['*.js', 'config-plugins/*.js', 'tests/helpers/*.js'],
    languageOptions: {
      globals: { module: 'readonly', require: 'readonly', __dirname: 'readonly', jest: 'readonly' },
    },
  },
  { ignores: ['android/**', 'mock/**', 'output/**', '.superpowers/**', '.playwright-cli/**'] },
  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: __dirname } },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
    },
  },
]);
