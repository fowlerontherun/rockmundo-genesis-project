import { describe, expect, it } from "vitest";
import { MessageRetryIdentities } from "../services/messageRetryIdentity";

describe("direct message retry identity lifetime", () => {
  it("retains the same ID when an uncertain send is retried", () => {
    const retries = new MessageRetryIdentities();
    let created = 0;
    const make = () => "id-" + ++created;
    expect(retries.getOrCreate("A:hello", make)).toBe("id-1");
    expect(retries.getOrCreate("A:hello", make)).toBe("id-1");
    expect(created).toBe(1);
  });

  it("never clears B when a different in-flight send A finishes", () => {
    const retries = new MessageRetryIdentities();
    retries.getOrCreate("thread:hello", () => "request-A");
    retries.getOrCreate("thread:world", () => "request-B");
    retries.confirm("thread:hello", "request-A");
    expect(retries.getOrCreate("thread:world", () => "duplicate-B")).toBe("request-B");
    expect(retries.getOrCreate("thread:hello", () => "request-A2")).toBe("request-A2");
  });

  it("cannot erase a newer idempotency attempt using a stale confirmation", () => {
    const retries = new MessageRetryIdentities();
    retries.getOrCreate("thread:hello", () => "request-1");
    retries.confirm("thread:hello", "request-1");
    retries.getOrCreate("thread:hello", () => "request-2");
    retries.confirm("thread:hello", "request-1");
    expect(retries.getOrCreate("thread:hello", () => "request-3")).toBe("request-2");
  });
});
