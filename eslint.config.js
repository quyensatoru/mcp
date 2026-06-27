import js from '@eslint/js';
import globals from 'globals';
import reactPlugin from 'eslint-plugin-react';

export default [
    js.configs.recommended,
    {
        ignores: ['**/dist/**', '**/node_modules/**'],
    },
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: { ...globals.node },
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            'no-console': 'warn',
        },
    },
    {
        // React dashboard (browser context + JSX).
        files: ['packages/console/web/**/*.{js,jsx}'],
        plugins: { react: reactPlugin },
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            parserOptions: { ecmaFeatures: { jsx: true } },
            globals: { ...globals.browser },
        },
        rules: {
            // Mark identifiers referenced in JSX as used.
            'react/jsx-uses-vars': 'error',
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            'no-console': 'off',
        },
    },
];
