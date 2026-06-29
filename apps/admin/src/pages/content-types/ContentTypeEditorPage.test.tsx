import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as contentTypesApi from "../../api/content-types.js";
import { ApiError } from "../../api/client.js";
import { ContentTypeEditorPage } from "./ContentTypeEditorPage.js";

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderNew() {
  return render(
    <QueryClientProvider client={makeClient()}>
      <MemoryRouter initialEntries={["/content-types/new"]}>
        <ContentTypeEditorPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ContentTypeEditorPage (create mode)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders basic info form and empty field config", () => {
    renderNew();
    expect(screen.getByText("新建内容类型")).toBeInTheDocument();
    expect(screen.getByText("基本信息")).toBeInTheDocument();
    expect(screen.getByText("字段配置")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /创.?建/ })).toBeInTheDocument();
  });

  it("adds a field row on click", () => {
    renderNew();
    const before = screen.queryAllByPlaceholderText("myField").length;
    fireEvent.click(screen.getByText("添加字段"));
    expect(screen.getAllByPlaceholderText("myField").length).toBe(before + 1);
  });

  it("submits via createContentType", async () => {
    const spy = vi
      .spyOn(contentTypesApi, "createContentType")
      .mockResolvedValue({
        id: "ct-x",
        uid: "article",
        kind: "collection",
        displayName: "文章",
        description: undefined,
        fields: [],
        options: { draftAndPublish: true, versions: true, localized: false, sortable: false },
        schemaVersion: 1,
      });

    renderNew();
    // 填基本信息。
    fireEvent.change(screen.getByPlaceholderText("article"), { target: { value: "article" } });
    fireEvent.change(screen.getByPlaceholderText("文章"), { target: { value: "文章" } });

    // 创建。
    fireEvent.click(screen.getByRole("button", { name: /创.?建/ }));

    await waitFor(() => expect(spy).toHaveBeenCalled());
    const arg = spy.mock.calls[0]![0];
    expect(arg.uid).toBe("article");
    expect(arg.kind).toBe("collection");
    expect(arg.displayName).toBe("文章");
  });

  it("shows API error message on create failure", async () => {
    vi.spyOn(contentTypesApi, "createContentType").mockRejectedValue(
      new ApiError("CONTENT_TYPE_FIELD_INVALID", "字段定义非法", 400),
    );

    renderNew();
    fireEvent.change(screen.getByPlaceholderText("article"), { target: { value: "article" } });
    fireEvent.change(screen.getByPlaceholderText("文章"), { target: { value: "文章" } });
    fireEvent.click(screen.getByRole("button", { name: /创.?建/ }));

    await waitFor(() => expect(screen.getByText("字段定义非法")).toBeInTheDocument());
  });
});
