/** Runtime configuration contract. */

export interface AppConfig {
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  clientUrl: string;
  socketCorsOrigin: string;
  stunUrls: string[];
  heartbeatInterval: number;
  peerTimeout: number;
  maxRoomSize: number;
  enableDebug: boolean;
  logLevel: LogLevel;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Subset of config that is safe to expose to the browser via GET /config. */
export interface PublicConfig {
  stunUrls: string[];
  heartbeatInterval: number;
  peerTimeout: number;
  maxRoomSize: number;
  enableDebug: boolean;
}

/** Built so the client can construct RTCConfiguration without hardcoding ICE. */
export interface IceServerConfig {
  urls: string[];
}
