// api/login.js
// Registra/identifica a un jugador antes de dejarlo entrar al laboratorio.
// No hay contraseñas: el "login" es un identificador de científico + un playerId
// estable generado en el navegador (localStorage). Guardamos un registro real
// por jugador en Redis (no solo el nombre) para poder saber quién es cada uno:
// primera vez visto, última conexión, y cuántas veces entró.

import crypto from 'crypto';

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redisCommand(command) {
    const response = await fetch(redisUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${redisToken}` },
        body: JSON.stringify(command)
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return data.result;
}

function sanitizeName(raw) {
    return String(raw)
        .replace(/<[^>]*>/g, '')      // quita cualquier etiqueta HTML
        .replace(/[<>"'`]/g, '')      // quita caracteres peligrosos sueltos
        .trim()
        .slice(0, 20);
}

// El playerId lo genera el cliente (crypto.randomUUID) y viaja en cada request;
// validamos el formato y, si no viene o es inválido, generamos uno nuevo aquí.
function resolvePlayerId(incoming) {
    if (typeof incoming === 'string' && /^[a-zA-Z0-9-]{8,64}$/.test(incoming)) return incoming;
    return crypto.randomUUID();
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    if (!redisUrl || !redisToken) {
        return res.status(500).json({ error: 'Backend no configurado (faltan variables de entorno de Upstash)' });
    }

    const { name, playerId: incomingId } = req.body || {};
    const clean = sanitizeName(name || '');

    if (!clean) {
        return res.status(400).json({ error: 'ID de científico inválido' });
    }

    const playerId = resolvePlayerId(incomingId);
    const now = Date.now();
    const key = `player:${playerId}`;

    try {
        // Guarda la primera vez que se vio a este playerId (no se pisa en logins posteriores)
        await redisCommand(['HSETNX', key, 'firstSeen', String(now)]);
        // Actualiza nombre actual + última conexión en cada login
        await redisCommand(['HSET', key, 'name', clean, 'lastSeen', String(now)]);
        // Cuenta cuántas veces se registró/entró
        await redisCommand(['HINCRBY', key, 'logins', '1']);
        // Índice ordenado por última actividad, para poder listar jugadores después
        await redisCommand(['ZADD', 'players_index', String(now), playerId]);

        return res.status(200).json({ success: true, player: clean, playerId });
    } catch (error) {
        return res.status(500).json({ error: 'Error al conectar con la base de datos: ' + error.message });
    }
}
