import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PlaceholderPage } from "./PlaceholderPage.js";

describe("PlaceholderPage", () => {
  it("renders the title", () => {
    render(
      <MemoryRouter>
        <PlaceholderPage title="测试页面" />
      </MemoryRouter>,
    );
    expect(screen.getByText("测试页面")).toBeInTheDocument();
  });
});
