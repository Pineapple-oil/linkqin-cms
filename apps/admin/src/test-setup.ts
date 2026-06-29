import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// AntD 的响应式组件（Table/Grid 等）依赖 window.matchMedia，jsdom 默认不提供。
if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  });
}

// jsdom 未实现 getComputedStyle 的伪元素重载，AntD 部分组件会触发。
window.getComputedStyle = window.getComputedStyle || (() => ({ getPropertyValue: () => "" }));
