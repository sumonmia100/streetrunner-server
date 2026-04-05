const WebSocket = require('ws');
const http = require('http');
const express = require('express');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const players = {};

app.get('/', (req, res) => {
    res.send('StreetRunner Server running');
});

wss.on('connection', (ws) => {
    const playerId = Date.now().toString();
    console.log(`Player connected: ${playerId}`);

    players[playerId] = { id: playerId, lat: 0, lng: 0, hp: 100 };

    ws.send(JSON.stringify({ type: 'CONNECTED', id: playerId }));

    ws.on('message', (message) => {
        const data = JSON.parse(message);

        switch(data.type) {
            case 'GPS_UPDATE':
                players[playerId].lat = data.lat;
                players[playerId].lng = data.lng;

                wss.clients.forEach((client) => {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({
                            type: 'PLAYER_POSITIONS',
                            players: Object.values(players)
                        }));
                    }
                });
                break;

            case 'JOIN_GAME':
                ws.send(JSON.stringify({
                    type: 'ZONE_UPDATE',
                    zoneLat: data.lat,
                    zoneLng: data.lng,
                    zoneRadius: 500
                }));
                break;

            case 'ATTACK':
                const target = players[data.targetId];
                if (!target) return;
                target.hp -= 10;

                wss.clients.forEach((client) => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({
                            type: 'DAMAGE_RECEIVED',
                            targetId: data.targetId,
                            damage: 10,
                            remainingHP: target.hp
                        }));
                    }
                });
                break;
        }
    });

    ws.on('close', () => {
        console.log(`প্লেয়ার চলে গেছে: ${playerId}`);
        delete players[playerId];
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    type: 'PLAYER_LEFT',
                    id: playerId
                }));
            }
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`StreetRunner Server running on Port: ${PORT}`);
});