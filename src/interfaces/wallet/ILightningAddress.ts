/**
 * Lightning address (apay) — always present.
 */

import type { ApayNewResponse } from '../../rln';

export interface ILightningAddress {
  apayNew(hostNodeId: string): Promise<ApayNewResponse>;
  apayNewWithAddress(
    hostNodeId: string,
    username: string,
    domain: string
  ): Promise<ApayNewResponse>;
}
