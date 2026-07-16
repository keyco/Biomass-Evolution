export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const { callback_query } = req.body;

  // Detectar cuando el usuario hace clic en el botón "Play" del juego Biomass_Evolution
  if (callback_query && callback_query.game_short_name === 'Biomass_Evolution') {
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const gameUrl = 'https://biomass-evolution.vercel.app'; 

    const responseUrl = `https://api.telegram.org/bot${telegramToken}/answerCallbackQuery`;

    try {
      await fetch(responseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callback_query.id,
          url: gameUrl
        })
      });
      return res.status(200).send('OK');
    } catch (error) {
      console.error('Error al responder a Telegram:', error);
      return res.status(500).send('Internal Server Error');
    }
  }

  return res.status(200).send('OK');
}