export interface SystemReadyEvent {
  connectedAt: string;
}

export interface SystemPongEvent {
  receivedAt: string;
}

export interface ClientToServerEvents {
  "system:ping": (acknowledge: (event: SystemPongEvent) => void) => void;
}

export interface ServerToClientEvents {
  "system:ready": (event: SystemReadyEvent) => void;
}

export type InterServerEvents = Record<string, never>;

export interface SocketData {
  userId?: string;
  email?: string;
}
