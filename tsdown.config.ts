import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: 'src/main.ts',
  format: ['esm', 'cjs'],
  dts: true,
});
