require('dotenv').config({ path: __dirname + '/.env' });
const https = require('https');

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

console.log('TOKEN:', token ? 'SET (' + token.substring(0, 10) + '...)' : 'MISSING');
console.log('CHAT_ID:', chatId);

if (!token || !chatId) {
  console.error('ERROR: Missing token or chat ID!');
  process.exit(1);
}

const text = '🧠 *Test Ting AI Bot*\n\nIni adalah test pengiriman pesan manual.\nJika kamu melihat ini, bot berjalan normal!';
const body = JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' });

const options = {
  hostname: 'api.telegram.org',
  path: '/bot' + token + '/sendMessage',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => {
    const json = JSON.parse(data);
    if (json.ok) { console.log('SUCCESS: Message sent! Message ID:', json.result.message_id); }
    else { console.log('ERROR from Telegram API:', JSON.stringify(json, null, 2)); }
  });
});
req.on('error', (e) => console.error('REQUEST ERROR:', e.message));
req.write(body);
req.end();
