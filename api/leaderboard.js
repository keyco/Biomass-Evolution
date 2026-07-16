// api/leaderboard.js
// Devuelve el top N del leaderboard. Se agrega este tercer endpoint (no estaba en el
// árbol de carpetas original) porque hace falta alguna forma de LEER el ranking para
// mostrarlo en pantalla; save-score.js solo escribe.

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

    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 5));

    try {
        // ZREVRANGE leaderboard 0 (limit-1) WITHSCORES -> [nombre, score, nombre, score, ...]
        const raw = await redisCommand(['ZREVRANGE', 'leaderboard', '0', String(limit - 1), 'WITHSCORES']);

        const board = [];
        for (let i = 0; i < raw.length; i += 2) {
            board.push({ name: raw[i], score: Number(raw[i + 1]) });
        }

        return res.status(200).json({ success: true, leaderboard: board });
    } catch (error) {
        return res.status(500).json({ error: 'Error al conectar con la base de datos: ' + error.message });
    }
}
