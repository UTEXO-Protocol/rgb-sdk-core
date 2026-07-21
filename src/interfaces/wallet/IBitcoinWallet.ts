/**
 * Bitcoin balance, addresses, UTXOs and on-chain BTC sends. Always present.
 */

import type {
  BtcBalance,
  GetFeeEstimationResponse,
  SendBtcBeginRequestModel,
  Unspent,
} from '../../types/wallet-model';

export interface IBitcoinWallet {
  getBtcBalance(): Promise<BtcBalance>;
  /** Current on-chain deposit address. */
  getAddress(): Promise<string>;

  listUnspents(): Promise<Unspent[]>;

  /**
   * Atomic BTC send. The begin/end variants are on the `beginEnd` carrier —
   * rn's node signs internally and exposes no PSBT (§2.7a).
   */
  sendBtc(params: SendBtcBeginRequestModel): Promise<string>;

  /** Atomic UTXO creation (begin → sign → end happens inside the platform). */
  createUtxos(params: {
    upTo?: boolean;
    num?: number;
    size?: number;
    feeRate?: number;
  }): Promise<number>;

  estimateFeeRate(blocks: number): Promise<GetFeeEstimationResponse>;
}
