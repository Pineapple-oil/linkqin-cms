import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as assetsApi from "../../api/assets.js";
import { AssetLibraryPage } from "./AssetLibraryPage.js";
import type { Asset } from "@linkqin/shared";

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderPage() {
  return render(
    <QueryClientProvider client={makeClient()}>
      <MemoryRouter>
        <AssetLibraryPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const sampleAsset: Asset = {
  id: "a-1",
  storage: "local",
  bucket: null,
  path: "2026/01/x.png",
  filename: "x.png",
  mimeType: "image/png",
  size: 100,
  width: 1,
  height: 1,
  alt: "封面",
  caption: null,
  url: "http://localhost:3000/uploads/2026/01/x.png",
};

describe("AssetLibraryPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders uploaded assets in the grid", async () => {
    vi.spyOn(assetsApi, "listAssets").mockResolvedValue({
      items: [sampleAsset],
      meta: { page: 1, pageSize: 24, total: 1, pageCount: 1 },
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("x.png")).toBeInTheDocument());
    expect(screen.getByText(/1×1 · 封面/)).toBeInTheDocument();
  });

  it("shows empty state when no assets", async () => {
    vi.spyOn(assetsApi, "listAssets").mockResolvedValue({
      items: [],
      meta: { page: 1, pageSize: 24, total: 0, pageCount: 0 },
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("暂无媒体")).toBeInTheDocument());
  });

  it("has an upload area", () => {
    vi.spyOn(assetsApi, "listAssets").mockResolvedValue({
      items: [],
      meta: { page: 1, pageSize: 24, total: 0, pageCount: 0 },
    });
    renderPage();
    expect(screen.getByText("点击或拖拽图片到此处上传")).toBeInTheDocument();
  });
});
