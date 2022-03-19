import { Plugin } from 'vite';
import { preprocessFile } from './preprocessor';
import { getEstrelaFilename } from './utils';

export default function (): Plugin {
  return {
    name: 'vite-plugin-estrela',
    enforce: 'pre',
    config(config) {
      return {
        ...config,
        esbuild: {
          ...config.esbuild,
          include: /\.(js|ts|estrela)$/,
          loader: 'ts',
        },
      };
    },
    transform(code, id) {
      return !!getEstrelaFilename(id) ? preprocessFile(code, id) : code;
    },
  };
}
