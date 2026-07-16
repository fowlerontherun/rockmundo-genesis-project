import { StrictMode } from "react";
import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useStableMutationIdempotencyKey } from "../useStableMutationIdempotencyKey";

function Probe({
  fingerprint = "",
  onValue,
}: {
  fingerprint?: string;
  onValue: (value: ReturnType<typeof useStableMutationIdempotencyKey>) => void;
}) {
  const value = useStableMutationIdempotencyKey(
    "booking-action",
    "subject-1",
    fingerprint,
  );
  onValue(value);
  return <output>{value.idempotencyKey}</output>;
}

describe("useStableMutationIdempotencyKey", () => {
  it("keeps retry keys stable across unrelated rerenders and regenerates on lifecycle events", () => {
    const values: ReturnType<typeof useStableMutationIdempotencyKey>[] = [];
    const { rerender } = render(
      <Probe onValue={(value) => values.push(value)} fingerprint="a" />,
    );
    const first = values.at(-1)!.idempotencyKey;

    rerender(<Probe onValue={(value) => values.push(value)} fingerprint="a" />);
    expect(values.at(-1)!.idempotencyKey).toBe(first);

    act(() => values.at(-1)!.markSucceeded());
    expect(values.at(-1)!.idempotencyKey).not.toBe(first);
    const afterSuccess = values.at(-1)!.idempotencyKey;

    act(() => values.at(-1)!.cancel());
    expect(values.at(-1)!.idempotencyKey).not.toBe(afterSuccess);
  });

  it("changes keys after material input changes without setting state during render", () => {
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const values: ReturnType<typeof useStableMutationIdempotencyKey>[] = [];
    const { rerender } = render(
      <StrictMode>
        <Probe onValue={(value) => values.push(value)} fingerprint="a" />
      </StrictMode>,
    );
    const first = values.at(-1)!.idempotencyKey;

    rerender(
      <StrictMode>
        <Probe onValue={(value) => values.push(value)} fingerprint="b" />
      </StrictMode>,
    );

    expect(values.at(-1)!.idempotencyKey).not.toBe(first);
    expect(errorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("Cannot update a component"),
    );
    errorSpy.mockRestore();
  });
});
