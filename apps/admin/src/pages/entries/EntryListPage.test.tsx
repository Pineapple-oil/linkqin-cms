import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as contentTypesApi from "../../api/content-types.js";
import * as entriesApi from "../../api/entries.js";
import { EntryListPage } from "./EntryListPage.js";
import type { Entry } from "@linkqin/shared";

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderPage(initialPath = "/entries") {
  return render(
    <QueryClientProvider client={makeClient()}>
      <MemoryRouter initialEntries={[initialPath]}>
        <EntryListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const sampleEntry: Entry = {
  id: "e-1",
  contentTypeId: "ct-1",
  status: "draft",
  locale: "zh-CN",
  slug: "hello",
  titleSnapshot: "Hello",
  data: { title: "Hello" },
  publishedData: null,
  version: 1,
  createdBy: null,
  updatedBy: null,
  publishedBy: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  publishedAt: null,
};

describe("EntryListPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(contentTypesApi, "listContentTypes").mockResolvedValue([
      { id: "ct-1", uid: "article", kind: "collection", displayName: "文章", description: undefined, fields: [], options: {}, schemaVersion: 1 } as never,
    ]);
    vi.spyOn(entriesApi, "listEntries").mockResolvedValue({
      items: [sampleEntry],
      meta: { page: 1, pageSize: 10, total: 1, pageCount: 1 },
    });
  });

  it("prompts to select a content type when none chosen", () => {
    renderPage();
    expect(screen.getByText("请先选择一个内容类型。")).toBeInTheDocument();
  });

  it("renders entries after selecting a content type", async () => {
    renderPage("/entries?contentType=ct-1");
    await waitFor(() => expect(screen.getByText("Hello")).toBeInTheDocument());
    expect(screen.getByText("hello")).toBeInTheDocument();
    expect(screen.getByText("draft")).toBeInTheDocument();
  });

  it("shows the create button", () => {
    renderPage("/entries?contentType=ct-1");
    expect(screen.getByRole("button", { name: /新.?建.?内.?容/ })).toBeInTheDocument();
  });
});
