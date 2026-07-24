import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import eslintConfigPrettier from 'eslint-config-prettier';

const eslintConfig = [
  { ignores: ['.next/', 'out/', 'coverage/', 'node_modules/', 'next-env.d.ts'] },
  ...nextCoreWebVitals,
  eslintConfigPrettier,
  {
    rules: {
      // react-hooks 7 (via eslint-config-next 16) adds this rule. Relaxed to a
      // warning so the Next 16 upgrade doesn't bundle a dashboard logic refactor;
      // addressed separately.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
];

export default eslintConfig;
