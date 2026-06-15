import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason
} from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import { db } from '../db';

const SESSIONS_ROOT_DIR = path.join(process.cwd(), 'server/wa_sessions');

export type WAStatus = 'disconnected' | 'connecting' | 'qrcode' | 'connected';

export interface WhatsAppSession {
  sock: any;
  status: WAStatus;
  qr: string | null;
  number: string | null;
  reconnectTimeout: NodeJS.Timeout | null;
}

// Map key is sessionId (string)
const activeSessions = new Map<string, WhatsAppSession>();

// Initialize a session
export async function initWhatsAppSession(sessionId: string) {
  if (activeSessions.has(sessionId)) {
    const existing = activeSessions.get(sessionId);
    if (existing?.sock) return; // already initialized
  }

  console.log(`[WhatsApp] Initializing session ${sessionId}...`);

  const sessionDir = path.join(SESSIONS_ROOT_DIR, `session_${sessionId}`);
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  // Create state structure
  const sessionState: WhatsAppSession = {
    sock: null,
    status: 'connecting',
    qr: null,
    number: null,
    reconnectTimeout: null
  };
  activeSessions.set(sessionId, sessionState);
  
  // Update DB status to connecting
  await updateSourceStatusInDB(sessionId, 'connecting', null, null);

  try {
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

    const sock = makeWASocket({
      auth: state,
      logger: pino({ level: 'silent' }) as any,
      printQRInTerminal: false
    });

    sessionState.sock = sock;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        sessionState.status = 'qrcode';
        try {
          sessionState.qr = await QRCode.toDataURL(qr);
          await updateSourceStatusInDB(sessionId, 'qrcode', sessionState.qr, null);
        } catch (err) {
          console.error(`[WhatsApp] Failed to generate QR Code for ${sessionId}:`, err);
        }
      }

      if (connection === 'open') {
        sessionState.status = 'connected';
        sessionState.qr = null;
        const jid = sock?.user?.id || '';
        sessionState.number = jid.split(':')[0] || jid.split('@')[0] || '';
        console.log(`[WhatsApp] Session ${sessionId} Connected successfully! Number: ${sessionState.number}`);
        await updateSourceStatusInDB(sessionId, 'connected', null, sessionState.number);
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        console.log(`[WhatsApp] Session ${sessionId} closed. Reason: ${statusCode}. Reconnect: ${shouldReconnect}`);

        cleanupSocket(sessionId);

        if (shouldReconnect) {
          if (sessionState.reconnectTimeout) clearTimeout(sessionState.reconnectTimeout);
          sessionState.reconnectTimeout = setTimeout(() => {
            initWhatsAppSession(sessionId);
          }, 5000);
          sessionState.status = 'connecting';
          await updateSourceStatusInDB(sessionId, 'connecting', null, sessionState.number);
        } else {
          sessionState.status = 'disconnected';
          sessionState.qr = null;
          sessionState.number = null;
          deleteSessionFolder(sessionId);
          await updateSourceStatusInDB(sessionId, 'disconnected', null, null);
        }
      }
    });
  } catch (err) {
    console.error(`[WhatsApp] Init error on session ${sessionId}:`, err);
    sessionState.status = 'disconnected';
    await updateSourceStatusInDB(sessionId, 'disconnected', null, null);
  }
}

function cleanupSocket(sessionId: string) {
  const session = activeSessions.get(sessionId);
  if (session && session.sock) {
    try {
      session.sock.ev.removeAllListeners('connection.update');
      session.sock.ev.removeAllListeners('creds.update');
      session.sock.end(undefined);
    } catch (e) {}
    session.sock = null;
  }
}

function deleteSessionFolder(sessionId: string) {
  try {
    const sessionDir = path.join(SESSIONS_ROOT_DIR, `session_${sessionId}`);
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }
  } catch (err) {
    console.error(`[WhatsApp] Failed to delete session folder for ${sessionId}:`, err);
  }
}

async function updateSourceStatusInDB(sessionId: string, status: WAStatus, qr: string | null, number: string | null) {
  try {
    await db.query(
      "UPDATE whatsapp_sources SET status = ?, phone_number = ? WHERE session_id = ?",
      [status, number, sessionId]
    );
  } catch (err) {
    console.error(`[WhatsApp] Failed to update source status in DB for ${sessionId}:`, err);
  }
}

export async function disconnectWhatsAppSession(sessionId: string) {
  const session = activeSessions.get(sessionId);
  if (session) {
    session.status = 'disconnected';
    session.qr = null;
    session.number = null;
    if (session.reconnectTimeout) {
      clearTimeout(session.reconnectTimeout);
      session.reconnectTimeout = null;
    }
  }
  cleanupSocket(sessionId);
  deleteSessionFolder(sessionId);
  await updateSourceStatusInDB(sessionId, 'disconnected', null, null);
  activeSessions.delete(sessionId);
  console.log(`[WhatsApp] Session ${sessionId} disconnected manually and deleted.`);
}

export function getWhatsAppSessionInfo(sessionId: string) {
  const session = activeSessions.get(sessionId);
  return {
    status: session?.status || 'disconnected',
    qr: session?.qr || null,
    number: session?.number || null
  };
}

// Bootstrapper to initialize all active sources
export async function initAllActiveWhatsAppSessions() {
  try {
    console.log('[WhatsApp] Booting active WhatsApp source sessions...');
    const [sources]: any = await db.query("SELECT session_id FROM whatsapp_sources WHERE is_active = 1");
    for (const src of sources) {
      initWhatsAppSession(src.session_id);
    }
  } catch (err) {
    console.error('[WhatsApp] Failed to load active sessions from DB:', err);
  }
}

// Send WhatsApp message using a specific source device
export async function sendWhatsAppMessageFromSession(sessionId: string, targetNumber: string, message: string): Promise<boolean> {
  const session = activeSessions.get(sessionId);
  if (!session || session.status !== 'connected' || !session.sock) {
    console.warn(`[WhatsApp] Cannot send message via ${sessionId}, client not connected.`);
    return false;
  }

  try {
    let cleanNumber = targetNumber.replace(/\D/g, ''); // keep digits only
    if (cleanNumber.startsWith('0')) {
      cleanNumber = '62' + cleanNumber.substring(1);
    }
    
    const jid = `${cleanNumber}@s.whatsapp.net`;
    await session.sock.sendMessage(jid, { text: message });
    console.log(`[WhatsApp] Message sent from source ${sessionId} to ${cleanNumber}`);
    return true;
  } catch (err) {
    console.error(`[WhatsApp] Failed to send message from session ${sessionId}:`, err);
    return false;
  }
}

// Broadcast alert from any active connected source to all target numbers
export async function sendWhatsAppAlertBroadcast(title: string, message: string): Promise<boolean> {
  try {
    // 1. Fetch active targets
    const [targets]: any = await db.query("SELECT phone_number FROM whatsapp_targets WHERE is_active = 1");
    if (targets.length === 0) {
      console.log("[WhatsApp Broadcast] No active target recipients configured.");
      return false;
    }

    // 2. Fetch active connected sources
    const connectedSources = Array.from(activeSessions.entries())
      .filter(([_, session]) => session.status === 'connected' && session.sock)
      .map(([sessionId, _]) => sessionId);

    if (connectedSources.length === 0) {
      console.warn("[WhatsApp Broadcast] No connected active WhatsApp sources available.");
      return false;
    }

    // Use the first connected source for broadcast
    const senderSessionId = connectedSources[0];
    let successCount = 0;
    
    for (const target of targets) {
      const success = await sendWhatsAppMessageFromSession(senderSessionId, target.phone_number, message);
      if (success) successCount++;
    }

    console.log(`[WhatsApp Broadcast] Successfully sent alert to ${successCount}/${targets.length} targets via sender ${senderSessionId}`);
    return successCount > 0;
  } catch (err) {
    console.error("[WhatsApp Broadcast] Error:", err);
    return false;
  }
}
