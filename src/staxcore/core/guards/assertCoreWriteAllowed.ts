export function assertCoreWriteAllowed(path: string): void {
  if (!path.startsWith("src/staxcore/core/api/")) {
    throw new Error(
      "BOUNDARY_VIOLATION: STAX Core writes must go through src/staxcore/core/api"
    );
  }
}
