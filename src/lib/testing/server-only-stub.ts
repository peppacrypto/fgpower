// Stub for the "server-only" package, aliased in vitest.config.mts so
// integration tests can import server-side modules without pulling in
// Next.js's bundler (which is what actually enforces the real package's
// client/server boundary in production).
export {};
