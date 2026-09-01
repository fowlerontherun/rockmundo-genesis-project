import { readFileSync } from "node:fs";
import { act, render, screen } from "@testing-library/react";
import {
  createMemoryRouter,
  RouterProvider,
  useLocation,
} from "react-router-dom";
import { describe, expect, it } from "vitest";

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
};

const createHistoryRouter = () => createMemoryRouter(
  [{ path: "*", element: <LocationProbe /> }],
  { initialEntries: ["/home"] },
);

describe("P4 browser navigation history", () => {
  it("supports normal forward navigation followed by browser back and forward", async () => {
    const router = createHistoryRouter();
    render(<RouterProvider router={router} />);

    await act(async () => { await router.navigate("/music"); });
    expect(screen.getByTestId("location")).toHaveTextContent("/music");

    await act(async () => { await router.navigate(-1); });
    expect(screen.getByTestId("location")).toHaveTextContent("/home");

    await act(async () => { await router.navigate(1); });
    expect(screen.getByTestId("location")).toHaveTextContent("/music");
  });

  it("uses replacement semantics for compatibility redirects so Back does not loop", async () => {
    const router = createHistoryRouter();
    render(<RouterProvider router={router} />);

    await act(async () => { await router.navigate("/hub/media?tab=radio"); });
    await act(async () => { await router.navigate("/media?tab=radio", { replace: true }); });
    expect(screen.getByTestId("location")).toHaveTextContent("/media?tab=radio");

    await act(async () => { await router.navigate(-1); });
    expect(screen.getByTestId("location")).toHaveTextContent("/home");
  });

  it("keeps the application compatibility redirect helper query-preserving and replace-based", () => {
    const appSource = readFileSync("src/App.tsx", "utf8");
    const helper = appSource.match(/const PreserveQueryRedirect[\s\S]*?\n};/)?.[0] ?? "";

    expect(helper).toContain("useLocation()");
    expect(helper).toContain("${to}${search}");
    expect(helper).toMatch(/<Navigate[\s\S]*?replace\s*\/>/);
  });
});
