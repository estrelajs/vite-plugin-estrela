import { preprocessFile } from '../src/preprocessor';

const linesExtractor = (str: string) =>
  str
    .split('\n')
    .map(line => line.trim())
    .filter(line => !/^(\s+)?$/.test(line));

describe('preprocessFile', () => {
  test('script', () => {
    const file = 'app.estrela';
    const content = `
      <script tag="app-root">
        import { state } from 'estrela';
        const count = state(0);
        setInterval(() => count.update(value => ++value), 1000);
      </script>
      <div>Count is { count() && <span>{count}</span> }</div>`;

    const { code } = preprocessFile(content, file);

    const expected = `
      import { defineElement, html } from "estrela";
      import { state } from 'estrela';
      defineElement("app-root", host => {
        const count = state(0);
        setInterval(() => count.update(value => ++value), 1000);
        return () => html\`
          <div>Count is \${ count() && html\` <span>\${count}</span>\` }</div>
        \`;
      });`;

    expect(linesExtractor(code)).toEqual(linesExtractor(expected));
  });

  test('empty script', () => {
    const file = 'app.estrela';
    const content = `
      <script tag="app-root">
      </script>
      <h1>Hello World!</h1>`;

    const { code } = preprocessFile(content, file);

    const expected = `
      import { defineElement, html } from "estrela";
      defineElement("app-root", host => {
        return () => html\`
          <h1>Hello World!</h1>
        \`;
      });`;

    expect(linesExtractor(code)).toEqual(linesExtractor(expected));
  });

  test('no script', () => {
    const file = 'app.estrela';
    const content = `<h1>Hello World!</h1>`;

    const { code } = preprocessFile(content, file);

    const expected = `
      import { defineElement, html } from "estrela";
      defineElement("app", () => {
        return () => html\`
          <h1>Hello World!</h1>
        \`;
      });`;

    expect(linesExtractor(code)).toEqual(linesExtractor(expected));
  });

  test('script and style', () => {
    const file = 'app.estrela';
    const content = `
      <script tag="app-root">
        import { state } from 'estrela';
        const name = state('World');
      </script>
      <h1>Hello {name}!</h1>
      <style>
        h1 {
          color: #555;
        }
      </style>`;

    const { code } = preprocessFile(content, file);

    const expected = `
      import { defineElement, html } from "estrela";
      import { state } from 'estrela';
      defineElement("app-root", host => {
        const name = state('World');
        return () => html\`
          <h1>Hello \${name}!</h1>
        \`;
      }, \`
        h1 {
          color: #555;
        }
      \`);`;

    expect(linesExtractor(code)).toEqual(linesExtractor(expected));
  });

  test('with hyperlink', () => {
    const file = 'app.estrela';
    const content = `
    <script tag="app-root">
      import { state } from 'estrela';
      const name = state('Stranger');
    </script>
    <p>Visit <a href="https://www.link.com">{ name }</a>.</p>`;

    const { code } = preprocessFile(content, file);

    const expected = `
    import { defineElement, html } from "estrela";
    import { state } from 'estrela';
    defineElement("app-root", host => {
      const name = state('Stranger');
      return () => html\`
        <p>Visit <a href="https://www.link.com">\${ name }</a>.</p>
      \`;
    });`;

    expect(linesExtractor(code)).toEqual(linesExtractor(expected));
  });

  test('with typed declarations', () => {
    const file = 'app.estrela';
    const content = `
    <script tag="app-greeter">
      import { prop } from "estrela";
      import { async, when } from "estrela/directives";
      const name = prop<string>();
      const greet = new Promise<string>(r => {
        setTimeout(() => r('Welcome'), 5000);
      });
    </script>
    <h1>
      { async(greet) ?? 'Hello' }
      { when(name() === 'Eduardo', 'o cara', name()) }!
    </h1>
  `;

    const { code } = preprocessFile(content, file);

    const expected = `
    import { defineElement, html } from "estrela";
    import { prop } from "estrela";
    import { async, when } from "estrela/directives";
    defineElement("app-greeter", host => {
      const name = prop<string>(undefined, { key: "name" });
      const greet = new Promise<string>(r => {
        setTimeout(() => r('Welcome'), 5000);
      });
      return () => html\`
        <h1>
          \${ async(greet) ?? 'Hello' }
          \${ when(name() === 'Eduardo', 'o cara', name()) }!
        </h1>
      \`;
    });
`;

    expect(linesExtractor(code)).toEqual(linesExtractor(expected));
  });

  test('with prop', () => {
    const file = 'app.estrela';
    const content = `
    <script tag="app-greeter">
      import { prop } from "estrela";
      const name = prop<string>('World');
    </script>
    <h1>Hello { name }!</h1>
  `;

    const { code } = preprocessFile(content, file);

    const expected = `
    import { defineElement, html } from "estrela";
    import { prop } from "estrela";
    defineElement("app-greeter", host => {
      const name = prop<string>('World', { key: "name" });
      return () => html\`
        <h1>Hello \${ name }!</h1>
      \`;
    });
`;

    expect(linesExtractor(code)).toEqual(linesExtractor(expected));
  });
});
