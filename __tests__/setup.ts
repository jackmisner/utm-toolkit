import { beforeEach, vi } from 'vitest';

// Mock sessionStorage
const createStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
};

// Reset mocks before each test
beforeEach(() => {
  const sessionStorageMock = createStorageMock();
  vi.stubGlobal('sessionStorage', sessionStorageMock);

  // Reset location mock
  vi.stubGlobal('location', {
    href: 'https://example.com',
    search: '',
    hash: '',
    pathname: '/',
    protocol: 'https:',
    host: 'example.com',
    hostname: 'example.com',
  });
});
