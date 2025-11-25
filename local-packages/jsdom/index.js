export class JSDOM {
  constructor(html = "") {
    this.window = { document: { body: { innerHTML: html } }, navigator: {} };
  }
}
