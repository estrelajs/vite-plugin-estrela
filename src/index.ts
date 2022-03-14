import { Plugin } from 'vite';
import { preprocess } from './preprocessor';
import { isEstrelaFile } from './utils';

export default function (): Plugin {
  return {
    name: 'vite-plugin-estrela',
    transform(code, id) {
      return isEstrelaFile(id) ? preprocess(code, id) : code;
    },
  };
}
