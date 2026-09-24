require('dotenv/config');
const { initTelegramBot, sendMorningCommandToGroup } = require('./dist/services/telegramBotService');

async function test() {
  initTelegramBot();
  setTimeout(async () => {
    console.log('Sending morning command...');
    const result = await sendMorningCommandToGroup();
    console.log('Result:', result);
    process.exit(0);
  }, 2000);
}

test();
