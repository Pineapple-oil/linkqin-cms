import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./RequireAuth.js";
import { authStore } from "../stores/auth.js";

function renderRoutes(initialPath = "/") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route element={<RequireAuth />}>
          <Route path="/" element={<div>Protected Home</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("RequireAuth", () => {
  beforeEach(() => {
    authStore.clear();
  });

  it("redirects to login when access token is missing", () => {
    renderRoutes("/");
    expect(screen.getByText("Login Page")).toBeInTheDocument();
  });

  it("renders protected content when access token exists", () => {
    authStore.setAccessToken("token");
    renderRoutes("/");
    expect(screen.getByText("Protected Home")).toBeInTheDocument();
  });
});
