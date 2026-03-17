/** Convert various data formats to ArrayBuffer for Web Crypto API */
export function convertToArrayBuffer(data: unknown): ArrayBuffer {
  if (!data) {
    throw new Error('convertToArrayBuffer: data is undefined or null');
  }

  if (data instanceof Uint8Array) {
    return data.buffer as ArrayBuffer;
  }

  if (
    data &&
    typeof data === 'object' &&
    'byteLength' in data &&
    Object.prototype.toString.call(data) === '[object ArrayBuffer]'
  ) {
    return data as ArrayBuffer;
  }

  if (data && typeof data === 'object') {
    if ('buffer' in data && (data as { buffer?: unknown }).buffer) {
      const buffer = (data as { buffer: unknown }).buffer;
      if (buffer instanceof ArrayBuffer) {
        return buffer;
      }
      const uint8 = new Uint8Array(data as unknown as ArrayLike<number>);
      return uint8.buffer;
    }

    try {
      const uint8 = new Uint8Array(data as unknown as ArrayLike<number>);
      return uint8.buffer;
    } catch (error) {
      throw new Error(
        `convertToArrayBuffer: Failed to convert data to ArrayBuffer: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  try {
    const uint8 = new Uint8Array(data as ArrayLike<number>);
    return uint8.buffer;
  } catch (error) {
    throw new Error(
      `convertToArrayBuffer: Failed to convert data to ArrayBuffer: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
