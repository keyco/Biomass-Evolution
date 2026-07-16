// api/players.js
// Lista los jugadores registrados (los que pasaron por /api/login), con su nombre,
// primera vez visto, última conexión, cantidad de logins y último puntaje.
// Protegido con una clave simple (ADMIN_SECRET) para que no sea un endpoint público:
// GET /api/players?key=TU_CLAVE&limit=20

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

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

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    if (!redisUrl || !redisToken) {
        return res.status(500).json({ error: 'Backend no configurado (faltan variables de entorno de Upstash)' });
    }

    // Sin ADMIN_SECRET configurado en Vercel, este endpoint queda cerrado por defecto.
    if (!ADMIN_SECRET || req.query.key !== ADMIN_SECRET) {
        return res.status(401).json({ error: 'No autorizado' });
    }

    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));

    try {
        // IDs de los jugadores más recientemente activos
        const ids = await redisCommand(['ZREVRANGE', 'players_index', '0', String(limit - 1)]);

        const players = [];
        for (const id of ids) {
            const fields = await redisCommand(['HGETALL', `player:${id}`]); // [campo, valor, campo, valor, ...]
            const record = { playerId: id };
            for (let i = 0; i < fields.length; i += 2) record[fields[i]] = fields[i + 1];
            players.push(record);
        }

        return res.status(200).json({ success: true, count: players.length, players });
    } catch (error) {
        return res.status(500).json({ error: 'Error al conectar con la base de datos: ' + error.message });
    }
}
