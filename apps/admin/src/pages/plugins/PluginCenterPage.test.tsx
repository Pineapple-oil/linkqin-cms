import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as pluginsApi from "../../api/plugins.js";
import { PluginCenterPage } from "./PluginCenterPage.js";
import type { PluginView } from "../../api/plugins.js";

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderPage() {
  return render(
    <QueryClientProvider client={makeClient()}>
      <MemoryRouter>
        <PluginCenterPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const sample: PluginView[] = [
  {
    name: "seo",
    version: "0.1.0",
    displayName: "SEO",
    description: "SEO 字段类型",
    enabled: true,
    menus: [{ key: "seo.settings", label: "SEO 设置", path: "/plugins/seo" }],
    hasConfigSchema: true,
  },
  {
    name: "local-storage",
    version: "0.1.0",
    displayName: "本地存储",
    description: "本地文件存储",
    enabled: false,
    menus: [],
    hasConfigSchema: false,
  },
];

describe("PluginCenterPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders plugin list with names and status", async () => {
    vi.spyOn(pluginsApi, "listPlugins").mockResolvedValue(sample);
    renderPage();
    await waitFor(() => expect(screen.getByText("SEO")).toBeInTheDocument());
    expect(screen.getByText("本地存储")).toBeInTheDocument();
  });

  it("shows menu tags for plugins with menus", async () => {
    vi.spyOn(pluginsApi, "listPlugins").mockResolvedValue(sample);
    renderPage();
    await waitFor(() => expect(screen.getByText("SEO 设置")).toBeInTheDocument());
  });

  it("shows config button for configurable plugins", async () => {
    vi.spyOn(pluginsApi, "listPlugins").mockResolvedValue(sample);
    renderPage();
    await waitFor(() => expect(screen.getByRole("button", { name: /配.?置/ })).toBeInTheDocument());
  });
});
