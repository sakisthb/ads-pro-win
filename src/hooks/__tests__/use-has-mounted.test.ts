import { renderHook } from "@testing-library/react";
import { useHasMounted } from "../use-has-mounted";

describe("useHasMounted", () => {
  it("is true after the client mount effect", () => {
    const { result } = renderHook(() => useHasMounted());
    expect(result.current).toBe(true);
  });
});
