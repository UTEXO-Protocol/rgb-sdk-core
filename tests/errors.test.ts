import {
  SDKError,
  NetworkError,
  ValidationError,
  WalletError,
  CryptoError,
  ConfigurationError,
  BadRequestError,
  NotFoundError,
  ConflictError,
  RgbNodeError,
} from '../dist/index.mjs';

describe('error classes', () => {
  it('SDKError has correct code and name', () => {
    const e = new SDKError('msg', 'MY_CODE');
    expect(e.code).toBe('MY_CODE');
    expect(e.name).toBe('SDKError');
    expect(e.message).toBe('msg');
    expect(e instanceof SDKError).toBe(true);
    expect(e instanceof Error).toBe(true);
  });

  it('NetworkError sets code and statusCode', () => {
    const e = new NetworkError('network fail', 503);
    expect(e.code).toBe('NETWORK_ERROR');
    expect(e.statusCode).toBe(503);
    expect(e.name).toBe('NetworkError');
    expect(e instanceof NetworkError).toBe(true);
    expect(e instanceof SDKError).toBe(true);
  });

  it('ValidationError sets field', () => {
    const e = new ValidationError('bad input', 'myField');
    expect(e.code).toBe('VALIDATION_ERROR');
    expect(e.field).toBe('myField');
    expect(e.name).toBe('ValidationError');
    expect(e instanceof ValidationError).toBe(true);
  });

  it('WalletError uses WALLET_ERROR code', () => {
    const e = new WalletError('wallet broke');
    expect(e.code).toBe('WALLET_ERROR');
    expect(e.name).toBe('WalletError');
  });

  it('WalletError accepts custom code', () => {
    const e = new WalletError('msg', 'CUSTOM_CODE');
    expect(e.code).toBe('CUSTOM_CODE');
  });

  it('CryptoError sets code', () => {
    const e = new CryptoError('crypto fail');
    expect(e.code).toBe('CRYPTO_ERROR');
    expect(e.name).toBe('CryptoError');
  });

  it('BadRequestError has statusCode 400', () => {
    const e = new BadRequestError('bad req');
    expect(e.statusCode).toBe(400);
    expect(e.code).toBe('BAD_REQUEST');
  });

  it('NotFoundError has statusCode 404', () => {
    const e = new NotFoundError('not found');
    expect(e.statusCode).toBe(404);
    expect(e.code).toBe('NOT_FOUND');
  });

  it('ConflictError has statusCode 409', () => {
    const e = new ConflictError('conflict');
    expect(e.statusCode).toBe(409);
    expect(e.code).toBe('CONFLICT');
  });

  it('RgbNodeError sets custom statusCode', () => {
    const e = new RgbNodeError('rgb error', 502);
    expect(e.statusCode).toBe(502);
    expect(e.code).toBe('RGB_NODE_ERROR');
    expect(e.name).toBe('RgbNodeError');
  });

  it('instanceof checks work across all error types', () => {
    const errors = [
      new NetworkError('x'),
      new ValidationError('x'),
      new WalletError('x'),
      new CryptoError('x'),
      new ConfigurationError('x'),
      new BadRequestError('x'),
      new NotFoundError('x'),
      new ConflictError('x'),
      new RgbNodeError('x', 500),
    ];
    for (const e of errors) {
      expect(e instanceof SDKError).toBe(true);
      expect(e instanceof Error).toBe(true);
    }
  });

  it('toJSON returns expected shape', () => {
    const e = new SDKError('test msg', 'TEST_CODE', 400);
    const json = e.toJSON();
    expect(json.name).toBe('SDKError');
    expect(json.message).toBe('test msg');
    expect(json.code).toBe('TEST_CODE');
    expect(json.statusCode).toBe(400);
  });
});
