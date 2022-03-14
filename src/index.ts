import { Plugin } from 'vite';
import { preprocessFile } from './preprocessor';
import { isEstrelaFile } from './utils';

export default function (): Plugin {
  return {
    name: 'vite-plugin-estrela',
    transform(code, id) {
      return isEstrelaFile(id) ? preprocessFile(code, id) : code;
    },
  };
}
