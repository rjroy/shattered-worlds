import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Global ignores
    ignores: ['dist/**', 'node_modules/**'],
  },
  {
    // Core boundary: no Phaser or game-layer imports, no browser globals
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['phaser', 'phaser/*'],
              message: 'Core must not import Phaser. Keep core pure.',
            },
            {
              group: ['**/game/**'],
              message: 'Core must not import from the game layer.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        {
          name: 'window',
          message: 'Core must not reference browser globals. Use dependency injection.',
        },
        {
          name: 'document',
          message: 'Core must not reference browser globals. Use dependency injection.',
        },
        {
          name: 'navigator',
          message: 'Core must not reference browser globals. Use dependency injection.',
        },
        {
          name: 'canvas',
          message: 'Core must not reference browser globals. Use dependency injection.',
        },
      ],
    },
  }
)
