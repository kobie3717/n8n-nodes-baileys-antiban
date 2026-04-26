import { createHash } from 'crypto';
import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import { wrapSocket } from 'baileys-antiban';
import type { WrappedSocket } from 'baileys-antiban';

interface BaileysCredentials {
  sessionPath: string;
  phoneNumber?: string;
  usePairingCode?: boolean;
  printQRInTerminal?: boolean;
}

interface EventHandler {
  (data: any): void;
}

type UnsubscribeFn = () => void;

// Module-level connection cache (one socket per credential hash)
const socketCache = new Map<string, WrappedSocket>();
const eventSubscribers = new Map<string, Map<string, Set<EventHandler>>>();

function getCredentialHash(credentials: BaileysCredentials): string {
  const key = `${credentials.sessionPath}:${credentials.phoneNumber || ''}`;
  return createHash('sha256').update(key).digest('hex');
}

export async function getOrCreateSocket(credentials: BaileysCredentials): Promise<WrappedSocket> {
  const hash = getCredentialHash(credentials);

  if (socketCache.has(hash)) {
    const cached = socketCache.get(hash)!;
    // Check if still connected
    if (cached.ws && cached.ws.readyState === 1) {
      return cached;
    }
    // Connection died, remove from cache
    socketCache.delete(hash);
  }

  // Create new socket
  const { state, saveCreds } = await useMultiFileAuthState(credentials.sessionPath);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: credentials.printQRInTerminal ?? true,
    browser: ['n8n', 'Chrome', '110.0.0'],
  });

  // Handle pairing code if enabled
  if (credentials.usePairingCode && credentials.phoneNumber && !sock.authState.creds.registered) {
    const code = await sock.requestPairingCode(credentials.phoneNumber);
    console.log(`Pairing code for ${credentials.phoneNumber}: ${code}`);
  }

  // Save credentials on updates
  sock.ev.on('creds.update', saveCreds);

  // Wrap with baileys-antiban for rate limiting
  const safeSock = wrapSocket(sock, {
    preset: 'moderate',
    logging: true,
  });

  // Handle disconnects
  sock.ev.on('connection.update', (update: any) => {
    if (update.connection === 'close') {
      const shouldReconnect = (update.lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log(`Connection closed. Reconnect: ${shouldReconnect}`);

      if (shouldReconnect) {
        // Remove from cache, next call will recreate
        socketCache.delete(hash);
      } else {
        // Logged out, clean up completely
        socketCache.delete(hash);
        eventSubscribers.delete(hash);
      }
    } else if (update.connection === 'open') {
      console.log('Connection opened successfully');
    }
  });

  // Store in cache
  socketCache.set(hash, safeSock);

  return safeSock;
}

export async function closeSocket(credentials: BaileysCredentials): Promise<void> {
  const hash = getCredentialHash(credentials);
  const sock = socketCache.get(hash);

  if (sock) {
    try {
      await sock.logout();
    } catch (error) {
      console.error('Error during logout:', error);
    }
    socketCache.delete(hash);
    eventSubscribers.delete(hash);
  }
}

export function subscribe(
  credentials: BaileysCredentials,
  event: string,
  handler: EventHandler
): UnsubscribeFn {
  const hash = getCredentialHash(credentials);

  if (!eventSubscribers.has(hash)) {
    eventSubscribers.set(hash, new Map());
  }

  const credSubs = eventSubscribers.get(hash)!;
  if (!credSubs.has(event)) {
    credSubs.set(event, new Set());
  }

  credSubs.get(event)!.add(handler);

  // Return unsubscribe function
  return () => {
    const subs = eventSubscribers.get(hash)?.get(event);
    if (subs) {
      subs.delete(handler);
    }
  };
}

export async function attachEventListeners(
  credentials: BaileysCredentials,
  events: string[]
): Promise<void> {
  const sock = await getOrCreateSocket(credentials);
  const hash = getCredentialHash(credentials);

  for (const event of events) {
    // Attach listener to socket if not already attached
    const existingListener = (sock as any)[`__n8n_${event}_attached`];
    if (!existingListener) {
      sock.ev.on(event, (data: any) => {
        const handlers = eventSubscribers.get(hash)?.get(event);
        if (handlers) {
          handlers.forEach(h => h(data));
        }
      });
      (sock as any)[`__n8n_${event}_attached`] = true;
    }
  }
}
