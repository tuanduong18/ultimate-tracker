import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api-client";

describe("ApiError", () => {
  it("carries status, code, and message from the backend error shape", () => {
    const err = new ApiError(404, { code: "NOT_FOUND", message: "Nope." });

    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toBe("Nope.");
  });
});
