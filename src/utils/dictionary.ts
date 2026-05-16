/** Shared dictionary utilities used by both the store slice and the page. */

export function normalizeContextKey(context: string | undefined): string {
  return (context ?? '').trim().toLocaleLowerCase()
}
