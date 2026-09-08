import { defineConfig } from 'tsdown'
export default defineConfig([
  { entry: { index:'src/index.ts' }, outDir:'lib', platform:'node', format:'esm', target:'node22', fixedExtension:false, clean:false, dts:false },
  { entry: { client:'src/client.tsx' }, outDir:'lib', platform:'browser', format:'cjs', target:'es2022', clean:false, dts:false,
    external:['react','react/jsx-runtime',/^@deepseek-ai\//],
    outputOptions: {
      entryFileNames:'client.js',
      banner:'window.__ModuleLoader__.load({ id: "dsh-plugin-ssh", factory: (require) => {',
      intro:'var module = { exports: {} }; var exports = module.exports;',
      footer:'return module.exports; } });',
    },
  },
])
