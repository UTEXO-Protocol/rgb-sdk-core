export { toUnitsNumber, fromUnitsNumber } from '../../utils/units';

const UTXO_PATH_INDEX = 2;

/**
 * Decodes a hex invoice from bridge transfer signature.
 * Handles hex strings that may start with '0x' prefix.
 * Uses TextDecoder for cross-platform compatibility (Node, RN, Web).
 *
 * @param hexInvoice - Hex string from bridge transfer signature
 * @returns Decoded UTF-8 string invoice
 */
export function decodeBridgeInvoice(hexInvoice: string): string {
  const hex = hexInvoice.startsWith('0x')
    ? hexInvoice.slice(UTXO_PATH_INDEX)
    : hexInvoice;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return new TextDecoder().decode(bytes);
}
