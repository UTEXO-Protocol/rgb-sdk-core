/**
 * RLN (RGB Lightning Node) shared contract.
 *
 * Domain types + canonical status vocabulary + the wire-mapping contract.
 * Platform SDKs map their own wire shapes into these types at the binding
 * boundary — see `mapper.ts` for why the shape mappers are not here.
 */

export type {
  RlnInvoiceStatus,
  RlnPaymentStatus,
  RlnChannelStatus,
} from './status';
export {
  normalizeInvoiceStatus,
  normalizePaymentStatus,
  normalizeChannelStatus,
  tryNormalizeInvoiceStatus,
  tryNormalizePaymentStatus,
  tryNormalizeChannelStatus,
  isTerminalPaymentStatus,
  isClaimablePaymentStatus,
} from './status';

export { normalizeRlnNetwork, tryNormalizeRlnNetwork } from './network';

export type {
  LightningChannel,
  OpenChannelParams,
  OpenChannelResult,
  CreateLnInvoiceParams,
  CreateHodlInvoiceParams,
  LightningInvoice,
  HodlInvoiceResult,
  DecodedLnInvoice,
  LightningPayment,
  LightningPaymentType,
  SendPaymentParams,
  SendPaymentResult,
  KeysendParams,
  LightningAssetParam,
  LightningPeer,
  LightningNodeInfo,
  LightningNetworkInfo,
  ApayHashEntry,
  ApayNewResponse,
  LdkVssBackupInfo,
} from './model';

export type { WireMapper } from './mapper';
export {
  mapAll,
  mapMaybe,
  msatToSat,
  satToMsat,
  toNumber,
  toBigInt,
} from './mapper';
