/**
 * Short git commit the running build was deployed from, injected at deploy
 * time by scripts/deploy-prod.sh as the Railway service variable BUILD_SHA.
 * Returns "unknown" when the app runs outside that script (local dev, tests,
 * or any deploy that did not set the variable).
 */
export function buildSha(): string {
  const sha = process.env.BUILD_SHA?.trim();
  return sha && sha.length > 0 ? sha : "unknown";
}
