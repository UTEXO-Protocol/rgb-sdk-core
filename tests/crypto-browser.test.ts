// The hashing helpers are internal (not exported), so this tests the source.
import { runInNewContext } from 'node:vm';
import { sha256, ripemd160 } from '../src/utils/crypto-browser';

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');
const ABC_SHA256 =
  'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

describe('crypto-browser input', () => {
  it('hashes Uint8Array, Buffer, a subclass and a cross-realm Uint8Array alike', async () => {
    class Bytes extends Uint8Array {}
    const foreign = runInNewContext('new Uint8Array([97, 98, 99])');
    expect(foreign instanceof Uint8Array).toBe(false);
    for (const input of [
      new Uint8Array([97, 98, 99]),
      Buffer.from('abc'),
      Bytes.from([97, 98, 99]),
      foreign,
    ]) {
      expect(hex(await sha256(input))).toBe(ABC_SHA256);
    }
  });

  it('hashes only the bytes of a view with an offset', async () => {
    const backing = new Uint8Array([0, 97, 98, 99, 0]);
    const view = Buffer.from(backing.buffer, 1, 3);
    expect(hex(await sha256(view))).toBe(ABC_SHA256);
  });

  it.each([
    ['a DataView', new DataView(new Uint8Array([97, 98, 99]).buffer)],
    ['a Uint16Array', new Uint16Array([257])],
    ['an ArrayBuffer', new Uint8Array([1]).buffer],
    ['a number', 3],
    ['an array', [97, 98, 99]],
    ['a string', 'abc'],
  ])('rejects %s instead of reinterpreting it', async (_name, input) => {
    await expect(sha256(input as Uint8Array)).rejects.toThrow(TypeError);
    await expect(ripemd160(input as Uint8Array)).rejects.toThrow(TypeError);
  });
});
