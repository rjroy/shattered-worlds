import { defineConfig } from 'vite'

export default defineConfig({
  base: '/shattered-worlds/',
  build: { outDir: 'dist' },
  server: {
    allowedHosts: ['gsai.raptor-piranha.ts.net']
  }
})
