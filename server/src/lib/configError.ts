/**
 * A deployment configuration problem (missing or malformed environment variable).
 * Its message never contains a secret value, so it may be shown to the operator:
 * the Vercel entry point returns it as JSON instead of a bare platform error page.
 */
export class ConfigError extends Error {
  override name = 'ConfigError'
}
