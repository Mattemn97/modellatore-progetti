/* --- LINT DEL CODICE TYPESCRIPT --- */
// js/ resta fuori finché non diventa TypeScript (voce 23)
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
    { ignores: ['out/**', 'release/**', 'node_modules/**', 'js/**', 'build/**', 'dist/**', 'test-results/**', 'playwright-report/**'] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['**/*.ts', '**/*.mjs'],
        languageOptions: { globals: { ...globals.node } },
        rules: {
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            eqeqeq: ['error', 'always'],
            'no-console': 'off'
        }
    }
);
