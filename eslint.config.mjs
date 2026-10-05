/* --- LINT DEL CODICE TYPESCRIPT --- */
// js/ resta fuori finché non diventa TypeScript (voce 23)
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
    // src/renderer/*.js resta fuori finché non diventa TypeScript (spec 0020)
    { ignores: ['out/**', 'release/**', 'node_modules/**', 'src/renderer/**/*.js', 'build/**', 'dist/**', 'test-results/**', 'playwright-report/**'] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['src/renderer/**/*.ts'],
        languageOptions: { globals: { ...globals.browser } },
        rules: { 'no-restricted-imports': ['error', { patterns: ['node:*'] }] }
    },
    {
        files: ['**/*.ts', '**/*.mjs'],
        ignores: ['src/renderer/**'],
        languageOptions: { globals: { ...globals.node } },
        rules: {
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            eqeqeq: ['error', 'always'],
            'no-console': 'off'
        }
    }
);
