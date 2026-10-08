export function hintTestId(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}
