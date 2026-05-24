import nextConfig from 'eslint-config-next';

const eslintConfig = [
  ...nextConfig,
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'maintenance/**',
      'public/scripts/**',
    ],
  },
  {
    rules: {
      '@next/next/no-img-element': 'off',
    },
  },
];

export default eslintConfig;
