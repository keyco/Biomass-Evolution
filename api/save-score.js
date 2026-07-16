// api/save-score.js
// Guarda el puntaje de un jugador en el leaderboard (sorted set "leaderboard" en Redis).
// Usamos ZADD con la opción GT para que, si el mismo nombre juega varias veces,
// solo se quede registrado su MEJOR puntaje (no se sobrescribe con uno más bajo).

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
        .replace(/<[^>]*>/g, '')
        .replace(/[<>"'`]/g, '')
        .trim()
        .slice(0, 20);
}

export default async function handler(req, res) {
    // Solo permitimos peticiones POST (para enviar datos)
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    if (!redisUrl || !redisToken) {
        return res.status(500).json({ error: 'Backend no configurado (faltan variables de entorno de Upstash)' });
    }

    const { player, score, playerId } = req.body || {};
    const cleanPlayer = sanitizeName(player || '');
    const cleanScore = Number(score);

    // Validamos que nos envíen el nombre y el puntaje
    if (!cleanPlayer || !Number.isFinite(cleanScore) || cleanScore < 0) {
        return res.status(400).json({ error: 'Faltan datos del jugador o el puntaje no es válido' });
    }

    try {
        // ZADD leaderboard GT <score> <player>
        // GT = solo actualiza si el nuevo puntaje es mayor que el guardado; si no existía, lo crea.
        await redisCommand(['ZADD', 'leaderboard', 'GT', String(Math.floor(cleanScore)), cleanPlayer]);

        // Si tenemos un playerId válido (viene del navegador), lo vinculamos a su registro
        // de login para saber su último puntaje y cuándo jugó por última vez.
        if (typeof playerId === 'string' && /^[a-zA-Z0-9-]{8,64}$/.test(playerId)) {
            await redisCommand(['HSET', `player:${playerId}`, 'lastScore', String(Math.floor(cleanScore)), 'lastPlayed', String(Date.now())]);
        }

        return res.status(200).json({ success: true, message: 'Puntuación guardada con éxito' });
    } catch (error) {
        return res.status(500).json({ error: 'Error al conectar con la base de datos: ' + error.message });
    }
}
