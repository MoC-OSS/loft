import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodeExternals from 'rollup-plugin-node-externals'
import globals from 'rollup-plugin-node-globals';
// import builtins from 'rollup-plugin-node-builtins';
// import nodePolyfills from 'rollup-plugin-node-polyfills';
// import nodePolyfills from 'rollup-plugin-polyfill-node';


export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'lib/index.cjs.js',
      format: 'cjs',
      // sourcemap: true,
    },
    {
      file: 'lib/index.esm.js',
      format: 'esm',
      // sourcemap: true,
    },
    {
      file: 'lib/index.umd.js',
      format: 'umd',
      name: 'loft-palm',
      // sourcemap: true,
    },
    {
      file: 'lib/index.amd.js',
      format: 'amd',
      // sourcemap: true,
    }
  ],
  plugins: [
    typescript({outputToFilesystem: true}),
    nodeExternals(),
    globals(),
    // builtins({crypto:  true}),
    // resolve({preferBuiltins: true, browser: false }),
    resolve({ browser: false }),
    json(),
    commonjs(),
    // commonjs({transformMixedEsModules: true}),
    // nodePolyfills(["os", "events", "fs", "util", "path", "worker_threads", "module", "url", "buffer", "assert", "child_process", "net", "tty", "stream", "crypto", "dns", "tls", "string_decoder", "http", "https", "zlib", "http2", "punycode", "querystring", "process"]),
  ],
  // external: ,
  treeshake: true,
};
