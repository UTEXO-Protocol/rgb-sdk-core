/** The engine contract: base plus extensions. Re-exported from the package root. */

export type {
  SharedWalletContractVersion,
  EngineLifecycleApi,
  EngineNetworkApi,
  EngineBitcoinApi,
  EngineRgbAssetsApi,
  EngineOnchainApi,
  EngineHistoryApi,
  EngineCapabilities,
  SharedWalletApi,
} from './SharedWalletApi';

export type {
  RestartableWalletApi,
  FileBackupApi,
  WalletMaintenanceApi,
  BurnApi,
  ConsignmentApi,
  ConsignmentFileApi,
  VssBackupApi,
  VssFenceApi,
  MessageSigningApi,
  IndexerCheckApi,
  AssetMetadataApi,
  FileIssuanceApi,
  TxidLookupApi,
  AddressRotationApi,
} from './extensions';
