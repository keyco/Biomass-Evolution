// api/recent-players.js
// Endpoint PÚBLICO (a diferencia de /api/players, que requiere ADMIN_SECRET).
// Solo expone nombre + última conexión de los jugadores más recientes, para
// mostrar un "jugadores recientes" en el menú. No devuelve playerId ni ningún
// otro dato del registro interno.

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

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    if (!redisUrl || !redisToken) {
        return res.status(500).json({ error: 'Backend no configurado (faltan variables de entorno de Upstash)' });
    }

    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit) || 8));

    try {
        const ids = await redisCommand(['ZREVRANGE', 'players_index', '0', String(limit - 1)]);

        const players = [];
        for (const id of ids) {
            const fields = await redisCommand(['HMGET', `player:${id}`, 'name', 'lastSeen']);
            const [name, lastSeen] = fields;
            if (name) players.push({ name, lastSeen: Number(lastSeen) || null });
        }

        return res.status(200).json({ success: true, players });
    } catch (error) {
        return res.status(500).json({ error: 'Error al conectar con la base de datos: ' + error.message });
    }
}
