import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as contentTypesApi from "../../api/content-types.js";
import { ContentTypeListPage } from "./ContentTypeListPage.js";
import type { ContentType } from "@linkqin/shared";

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderPage() {
  return render(
    <QueryClientProvider client={makeClient()}>
      <MemoryRouter>
        <ContentTypeListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const sample: ContentType[] = [
  {
    id: "ct-1",
    uid: "article",
    kind: "collection",
    displayName: "文章",
    description: undefined,
    fields: [{ name: "title", type: "text", label: "标题", required: true, localized: false, unique: false }],
    options: { draftAndPublish: true, versions: true, localized: false, sortable: false },
    schemaVersion: 1,
  },
  {
    id: "ct-2",
    uid: "homepage",
    kind: "single",
    displayName: "首页",
    description: undefined,
    fields: [],
    options: { draftAndPublish: true, versions: true, localized: false, sortable: false },
    schemaVersion: 1,
  },
];

describe("ContentTypeListPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders content types from the API", async () => {
    vi.spyOn(contentTypesApi, "listContentTypes").mockResolvedValue(sample);
    renderPage();
    await waitFor(() => expect(screen.getByText("article")).toBeInTheDocument());
    expect(screen.getByText("homepage")).toBeInTheDocument();
    expect(screen.getByText("文章")).toBeInTheDocument();
  });

  it("shows empty state when no content types", async () => {
    vi.spyOn(contentTypesApi, "listContentTypes").mockResolvedValue([]);
    renderPage();
    // AntD Table 空态渲染 .ant-empty-description。
    await waitFor(() =>
      expect(document.querySelector(".ant-empty-description")).not.toBeNull(),
    );
  });

  it("has a create button", async () => {
    vi.spyOn(contentTypesApi, "listContentTypes").mockResolvedValue([]);
    renderPage();
    expect(screen.getByText("新建内容类型")).toBeInTheDocument();
  });
});
