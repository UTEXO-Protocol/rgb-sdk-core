import { ValidationError } from '../errors';
import type { TransferStatus } from './wallet-model';

const STATUSES: Record<TransferStatus, true> = {
  Initiated: true,
  WaitingCounterparty: true,
  WaitingSafeHeight: true,
  WaitingBroadcast: true,
  WaitingConfirmations: true,
  Settled: true,
  Failed: true,
};

export function normalizeTransferStatus(raw: unknown): TransferStatus {
  if (typeof raw === 'string') {
    const key = raw
      .trim()
      .replace(/[_\s-]/g, '')
      .toLowerCase();
    const status = (Object.keys(STATUSES) as TransferStatus[]).find(
      (value) => value.toLowerCase() === key
    );
    if (status) return status;
  }
  throw new ValidationError(
    `Unknown transfer status: ${JSON.stringify(raw)}`,
    'transferStatus'
  );
}
