import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCompanies, useCompany } from "./useCompanies";

const from = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));
vi.mock("@/hooks/useActiveProfile", () => ({
  useActiveProfile: () => ({ userId: "auth-user-1" }),
}));

const company = { id: "company-1", owner_id: "auth-user-1", name: "Ordinary Co" };

function wrapper({ children }: PropsWithChildren) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function companiesQuery(result: { data: unknown; error: unknown }) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn().mockResolvedValue(result),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
}

function festivalListQuery(result: { data: unknown; error: unknown }) {
  const query = { select: vi.fn(), in: vi.fn().mockResolvedValue(result) };
  query.select.mockReturnValue(query);
  return query;
}

describe("useCompanies", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps core companies when the optional festival extension query fails", async () => {
    const coreQuery = companiesQuery({ data: [company], error: null });
    const extensionQuery = festivalListQuery({ data: null, error: new Error("schema cache unavailable") });
    from.mockImplementation((table: string) => table === "companies" ? coreQuery : extensionQuery);

    const { result } = renderHook(() => useCompanies(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ ...company, festival_company_id: null }]);
    expect(coreQuery.eq).toHaveBeenCalledWith("owner_id", "auth-user-1");
    expect(extensionQuery.in).toHaveBeenCalledWith("company_id", ["company-1"]);
  });

  it("merges a festival extension id into its matching company", async () => {
    const coreQuery = companiesQuery({ data: [company], error: null });
    const extensionQuery = festivalListQuery({
      data: [{ id: "festival-1", company_id: "company-1" }],
      error: null,
    });
    from.mockImplementation((table: string) => table === "companies" ? coreQuery : extensionQuery);

    const { result } = renderHook(() => useCompanies(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].festival_company_id).toBe("festival-1");
  });

  it("treats a core query failure as an error and does not query extensions", async () => {
    from.mockReturnValue(companiesQuery({ data: null, error: new Error("companies unavailable") }));

    const { result } = renderHook(() => useCompanies(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(from).toHaveBeenCalledTimes(1);
  });
});

describe("useCompany", () => {
  it("keeps a core company when its optional festival extension query fails", async () => {
    const coreQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: company, error: null }),
    };
    coreQuery.select.mockReturnValue(coreQuery);
    coreQuery.eq.mockReturnValue(coreQuery);
    const extensionQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: new Error("optional failure") }),
    };
    extensionQuery.select.mockReturnValue(extensionQuery);
    extensionQuery.eq.mockReturnValue(extensionQuery);
    from.mockImplementation((table: string) => table === "companies" ? coreQuery : extensionQuery);

    const { result } = renderHook(() => useCompany("company-1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ ...company, festival_company_id: null });
  });
});
