/**
 * Reads a file's bytes with `FileReader`, which every supported browser and jsdom provide
 * (jsdom's `Blob` lacks `arrayBuffer()`/`text()`). The bytes never leave the device.
 */
export function readBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

export async function readText(blob: Blob): Promise<string> {
  return new TextDecoder().decode(await readBytes(blob));
}
