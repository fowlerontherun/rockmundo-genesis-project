class EventTargetShim {
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() { return true; }
}

class ElementShim extends EventTargetShim {
  constructor(tagName = 'div') { super(); this.tagName = tagName.toUpperCase(); this.children = []; this.style = {}; }
  appendChild(child) { this.children.push(child); return child; }
  removeChild(child) { this.children = this.children.filter((item) => item !== child); return child; }
  setAttribute(name, value) { this[name] = String(value); }
  getAttribute(name) { return this[name] ?? null; }
  scrollIntoView() {}
  getBoundingClientRect() { return { width: 640, height: 360, top: 0, left: 0, right: 640, bottom: 360 }; }
}

class DocumentShim extends EventTargetShim {
  constructor(html = '') { super(); this.body = new ElementShim('body'); this.body.innerHTML = html; this.documentElement = new ElementShim('html'); }
  createElement(tagName) { return new ElementShim(tagName); }
  createElementNS(_ns, tagName) { return new ElementShim(tagName); }
  getElementById() { return null; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
}

export class CookieJar {
  setCookieSync() {}
  getCookieStringSync() { return ''; }
}

export class ResourceLoader {}

export class VirtualConsole {
  sendTo() { return this; }
  on() { return this; }
}

export class JSDOM {
  constructor(html = '', options = {}) {
    const document = new DocumentShim(html);
    const window = new EventTargetShim();
    Object.assign(window, {
      document,
      navigator: { userAgent: options.userAgent ?? 'jsdom-local-shim' },
      location: new URL(options.url ?? 'http://localhost/'),
      Element: ElementShim,
      HTMLElement: ElementShim,
      HTMLCanvasElement: ElementShim,
      EventTarget: EventTargetShim,
      Event: class Event { constructor(type) { this.type = type; } },
      MouseEvent: class MouseEvent { constructor(type) { this.type = type; } },
      KeyboardEvent: class KeyboardEvent { constructor(type) { this.type = type; } },
      CustomEvent: class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
      getComputedStyle: () => ({}),
      close: () => {},
    });
    document.defaultView = window;
    this.window = window;
    this.virtualConsole = options.virtualConsole ?? new VirtualConsole();
    this.cookieJar = options.cookieJar ?? new CookieJar();
  }
  static fragment(html = '') { return new DocumentShim(html).body; }
}
