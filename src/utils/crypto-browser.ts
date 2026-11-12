import { sha256 as nobleSha256 } from '@noble/hashes/sha2.js';
import { ripemd160 as nobleRipemd160 } from '@noble/hashes/legacy.js';

// Accepts Uint8Array only: Buffer, subclasses and arrays from another realm
// (iframe, vm) included. Other views, numbers and arrays are rejected rather
// than reinterpreted. Never names the Buffer global, which may be undefined
// (React Native, browsers).
function toBytes(data: unknown, name: string): Uint8Array {
  if (
    !ArrayBuffer.isView(data) ||
    Object.prototype.toString.call(data) !== '[object Uint8Array]'
  ) {
    throw new TypeError(`${name}: data must be a Uint8Array or Buffer`);
  }
  const bytes = data as Uint8Array;
  return Object.getPrototypeOf(bytes) === Uint8Array.prototype
    ? bytes
    : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

export async function sha256(data: Uint8Array | Buffer): Promise<Uint8Array> {
  if (!data) {
    throw new Error('sha256: data is undefined or null');
  }
  const dataArray = toBytes(data, 'sha256');
  return new Uint8Array(nobleSha256(dataArray));
}

export async function ripemd160(
  data: Uint8Array | Buffer
): Promise<Uint8Array> {
  if (!data) {
    throw new Error('ripemd160: data is undefined or null');
  }
  const dataArray = toBytes(data, 'ripemd160');
  return new Uint8Array(nobleRipemd160(dataArray));
}

export async function sha256Sync(
  data: Uint8Array | Buffer
): Promise<Uint8Array> {
  return sha256(data);
}

export const ripemd160Sync: (
  data: Uint8Array | Buffer
) => Promise<Uint8Array> = async (
  data: Uint8Array | Buffer
): Promise<Uint8Array> => {
  return ripemd160(data);
};
