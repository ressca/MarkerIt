import nxPlugin from '@nx/eslint-plugin';

export default [
  ...nxPlugin.configs['flat/base'],
  ...nxPlugin.configs['flat/typescript'],
  ...nxPlugin.configs['flat/javascript'],
  {
    ignores: ['**/.next/**', '**/build/**', '**/dist/**', '**/node_modules/**'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          allow: [],
          depConstraints: [
            {
              sourceTag: 'type:application',
              onlyDependOnLibsWithTags: ['type:ui', 'type:util', 'type:contract', 'type:i18n'],
            },
            {
              sourceTag: 'scope:landing',
              onlyDependOnLibsWithTags: ['scope:landing', 'scope:shared'],
            },
            {
              sourceTag: 'scope:app',
              onlyDependOnLibsWithTags: ['scope:app', 'scope:shared'],
            },
            {
              sourceTag: 'scope:shared',
              onlyDependOnLibsWithTags: ['scope:shared'],
            },
            {
              sourceTag: 'scope:api',
              onlyDependOnLibsWithTags: ['scope:api'],
            },
          ],
        },
      ],
    },
  },
];
