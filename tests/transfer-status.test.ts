import { normalizeTransferStatus, ValidationError } from '../dist/index.mjs';

describe('transfer status normalization', () => {
  it.each([
    'WaitingBroadcast',
    'waitingBroadcast',
    'WAITING_BROADCAST',
    'waitingbroadcast',
  ])('preserves the new broadcast-wait state from %s', (raw) =>
    expect(normalizeTransferStatus(raw)).toBe('WaitingBroadcast')
  );

  it.each([
    'Initiated',
    'WaitingCounterparty',
    'WaitingSafeHeight',
    'WaitingConfirmations',
    'Settled',
    'Failed',
  ])('preserves existing state %s', (raw) =>
    expect(normalizeTransferStatus(raw)).toBe(raw)
  );

  it.each(['FutureState', 'Paid', '', null, undefined, 1])(
    'rejects %p instead of substituting a valid transfer state',
    (raw) => expect(() => normalizeTransferStatus(raw)).toThrow(ValidationError)
  );
});
