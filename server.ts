/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ConnectedClient {
  ws: WebSocket;
  id: string;
  callsign: string;
  name: string;
  qth: string;
  frequencyKhz: number;
  joinedAt: number;
}

interface StoredTransmission {
  id: string;
  senderId: string;
  callsign: string;
  frequencyKhz: number;
  morse: string;
  text: string;
  wpm: number;
  frequencyHz: number;
  timestamp: number;
  rst?: string;
}

// In-memory frequency rooms state
const frequencyClients = new Map<number, Set<ConnectedClient>>();
const frequencyHistory = new Map<number, StoredTransmission[]>();

function getClientsOnFrequency(freqKhz: number): ConnectedClient[] {
  const set = frequencyClients.get(freqKhz);
  return set ? Array.from(set) : [];
}

function broadcastToFrequency(freqKhz: number, message: unknown, excludeWs?: WebSocket) {
  const payload = JSON.stringify(message);
  const set = frequencyClients.get(freqKhz);
  if (!set) return;
  for (const client of set) {
    if (client.ws !== excludeWs && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(payload);
      } catch (err) {
        console.error('Error broadcasting to client:', err);
      }
    }
  }
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const port = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Health and API routes
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      activeFrequencies: Array.from(frequencyClients.keys()).filter(
        (k) => (frequencyClients.get(k)?.size || 0) > 0
      ),
      totalOperators: Array.from(frequencyClients.values()).reduce(
        (sum, set) => sum + set.size,
        0
      ),
    });
  });

  // WebSocket Server with explicit upgrade handling for /ws
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    try {
      const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
      if (url.pathname === '/ws') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      }
    } catch (err) {
      console.warn('Upgrade error:', err);
    }
  });

  wss.on('connection', (ws) => {
    let clientInfo: ConnectedClient | null = null;

    ws.on('message', (rawData) => {
      try {
        const data = JSON.parse(rawData.toString());

        if (data.type === 'join') {
          const freqKhz = Number(data.frequencyKhz) || 7030;
          const id = data.id || `op_${Math.random().toString(36).substring(2, 9)}`;
          const callsign = (data.callsign || 'TA1MORS').trim().toUpperCase();
          const name = data.name || 'Operatör';
          const qth = data.qth || 'İstanbul';

          // Remove from previous frequency if any
          if (clientInfo) {
            const oldSet = frequencyClients.get(clientInfo.frequencyKhz);
            if (oldSet) {
              oldSet.delete(clientInfo);
              broadcastToFrequency(clientInfo.frequencyKhz, {
                type: 'operator:left',
                operatorId: clientInfo.id,
                callsign: clientInfo.callsign,
              });
            }
          }

          clientInfo = {
            ws,
            id,
            callsign,
            name,
            qth,
            frequencyKhz: freqKhz,
            joinedAt: Date.now(),
          };

          if (!frequencyClients.has(freqKhz)) {
            frequencyClients.set(freqKhz, new Set());
          }
          frequencyClients.get(freqKhz)!.add(clientInfo);

          // Prepare init payload
          const history = frequencyHistory.get(freqKhz) || [];
          const operators = getClientsOnFrequency(freqKhz).map((c) => ({
            id: c.id,
            callsign: c.callsign,
            name: c.name,
            qth: c.qth,
            joinedAt: c.joinedAt,
            lastActive: Date.now(),
          }));

          ws.send(
            JSON.stringify({
              type: 'init',
              frequencyKhz: freqKhz,
              operators,
              history: history.slice(-30),
            })
          );

          // Broadcast to other stations on this frequency
          broadcastToFrequency(
            freqKhz,
            {
              type: 'operator:joined',
              operator: {
                id: clientInfo.id,
                callsign: clientInfo.callsign,
                name: clientInfo.name,
                qth: clientInfo.qth,
                joinedAt: clientInfo.joinedAt,
                lastActive: Date.now(),
              },
            },
            ws
          );
        } else if (data.type === 'frequency:change') {
          if (!clientInfo) return;
          const oldFreq = clientInfo.frequencyKhz;
          const newFreq = Number(data.newFrequencyKhz) || 7030;
          if (oldFreq === newFreq) return;

          // Remove from old
          const oldSet = frequencyClients.get(oldFreq);
          if (oldSet) {
            oldSet.delete(clientInfo);
            broadcastToFrequency(oldFreq, {
              type: 'operator:left',
              operatorId: clientInfo.id,
              callsign: clientInfo.callsign,
            });
          }

          // Add to new
          clientInfo.frequencyKhz = newFreq;
          if (!frequencyClients.has(newFreq)) {
            frequencyClients.set(newFreq, new Set());
          }
          frequencyClients.get(newFreq)!.add(clientInfo);

          const history = frequencyHistory.get(newFreq) || [];
          const operators = getClientsOnFrequency(newFreq).map((c) => ({
            id: c.id,
            callsign: c.callsign,
            name: c.name,
            qth: c.qth,
            joinedAt: c.joinedAt,
            lastActive: Date.now(),
          }));

          ws.send(
            JSON.stringify({
              type: 'init',
              frequencyKhz: newFreq,
              operators,
              history: history.slice(-30),
            })
          );

          broadcastToFrequency(
            newFreq,
            {
              type: 'operator:joined',
              operator: {
                id: clientInfo.id,
                callsign: clientInfo.callsign,
                name: clientInfo.name,
                qth: clientInfo.qth,
                joinedAt: clientInfo.joinedAt,
                lastActive: Date.now(),
              },
            },
            ws
          );
        } else if (data.type === 'cw:live_key') {
          // Real-time straight key or paddle continuous press/release event
          if (!clientInfo) return;
          broadcastToFrequency(
            clientInfo.frequencyKhz,
            {
              type: 'cw:live_key',
              senderId: clientInfo.id,
              callsign: clientInfo.callsign,
              down: Boolean(data.down),
              frequencyHz: Number(data.frequencyHz) || 600,
            },
            ws
          );
        } else if (data.type === 'cw:transmission') {
          if (!clientInfo) return;
          const transmission: StoredTransmission = {
            id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            senderId: clientInfo.id,
            callsign: clientInfo.callsign,
            frequencyKhz: clientInfo.frequencyKhz,
            morse: String(data.morse || ''),
            text: String(data.text || ''),
            wpm: Number(data.wpm) || 20,
            frequencyHz: Number(data.frequencyHz) || 600,
            timestamp: Date.now(),
            rst: data.rst,
          };

          if (!frequencyHistory.has(clientInfo.frequencyKhz)) {
            frequencyHistory.set(clientInfo.frequencyKhz, []);
          }
          const history = frequencyHistory.get(clientInfo.frequencyKhz)!;
          history.push(transmission);
          if (history.length > 50) history.shift();

          // Broadcast transmission to all users on that frequency (including sender for confirmation)
          broadcastToFrequency(clientInfo.frequencyKhz, {
            type: 'cw:transmission',
            transmission,
          });
        } else if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch (err) {
        console.error('Error handling WebSocket message:', err);
      }
    });

    ws.on('close', () => {
      if (clientInfo) {
        const set = frequencyClients.get(clientInfo.frequencyKhz);
        if (set) {
          set.delete(clientInfo);
          broadcastToFrequency(clientInfo.frequencyKhz, {
            type: 'operator:left',
            operatorId: clientInfo.id,
            callsign: clientInfo.callsign,
          });
        }
      }
    });

    ws.on('error', (err) => {
      console.warn('WebSocket client error:', err);
    });
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  server.listen(port, '0.0.0.0', () => {
    console.log(`MorsLab full-stack server running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start MorsLab server:', err);
  process.exit(1);
});
