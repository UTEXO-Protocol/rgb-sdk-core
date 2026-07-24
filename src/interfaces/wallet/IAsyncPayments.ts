/**
 * Async payments (APay) — hash-pool registration with an invoice host / LSP,
 * optionally attested to a Lightning Address. Always present.
 */

import type { ApayNewResponse } from '../../rln';

export interface IAsyncPayments {
  apayNew(hostNodeId: string): Promise<ApayNewResponse>;
  apayNewWithAddress(
    hostNodeId: string,
    username: string,
    domain: string
  ): Promise<ApayNewResponse>;
}
