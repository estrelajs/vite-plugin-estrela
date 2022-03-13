# vite-plugin-estrela

A vite plugin to process estrela files.

`vite-plugin-estrela` translates Estrela files (.estrela), that are html/tsx like, to TypeScript readable files (.ts). To apply syntax highlights on vscode, install the estrela [extension](https://marketplace.visualstudio.com/items?itemName=estrelajs.estrela-vscode) for vscode.

### Estrela file example

```html
<script tag="app-root">
  import { state } from 'estrela';

  const count = state(0);

  setInterval(() => count.update(value => ++value), 1000);
</script>

<div>Count is { count }</div>
```

## Installation

### npm

```bash
$ npm i --save-dev vite-plugin-estrela
```

### yarn

```bash
$ yarn add --dev vite-plugin-estrela
```

## Usage

### Vite Config

```js
// vite.config.js

import estrela from "vite-plugin-estrela";

export default {
  plugins: [estrela()],
};

```

## Estrela

For more Estrela information, head over to https://estrelajs.gitbook.io/estrela/
