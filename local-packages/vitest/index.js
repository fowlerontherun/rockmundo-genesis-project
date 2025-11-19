import {
  describe,
  it,
  test,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from "bun:test";

const trackedSpies = [];

const createMockFn = (impl = () => undefined) => {
  const mockFn = (...args) => {
    mockFn.mock.calls.push(args);
    return impl(...args);
  };
  mockFn.mock = { calls: [] };
  mockFn.mockImplementation = (newImpl) => {
    impl = newImpl;
    return mockFn;
  };
  mockFn.mockReturnValue = (value) => {
    impl = () => value;
    return mockFn;
  };
  mockFn.mockResolvedValue = (value) => {
    impl = () => Promise.resolve(value);
    return mockFn;
  };
  mockFn.mockRejectedValue = (reason) => {
    impl = () => Promise.reject(reason);
    return mockFn;
  };
  return mockFn;
};

const spyOn = (object, method) => {
  if (!object || typeof object[method] !== "function") {
    throw new Error("Cannot spyOn a non-function property");
  }
  const original = object[method];
  const spyFn = createMockFn((...args) => original.apply(object, args));
  object[method] = spyFn;
  const handle = {
    mock: spyFn.mock,
    mockImplementation: (impl) => {
      spyFn.mockImplementation(impl);
      return handle;
    },
    mockReturnValue: (value) => {
      spyFn.mockReturnValue(value);
      return handle;
    },
    restore: () => {
      object[method] = original;
    },
  };
  trackedSpies.push(handle);
  return handle;
};

export const vi = {
  fn: createMockFn,
  spyOn,
  restoreAllMocks: () => {
    while (trackedSpies.length) {
      const spy = trackedSpies.pop();
      spy.restore();
    }
  },
};

export {
  describe,
  it,
  test,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
};
