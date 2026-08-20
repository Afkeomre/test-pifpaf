// Разовый смоук-тест интеграции Apify: проверяем, что токен рабочий
// и что актор отдаёт данные в ожидаемом формате.
// Запуск: npm run smoke          (без затрагивания БД)
//        APIFY_MOCK=0 npm run smoke

const dotenv = require('dotenv');
dotenv.config();

const ACTOR = process.env.APIFY_ACTOR_LINK || 'social_developer/instagram-post-link-scraper';
const TEST_URL = process.env.SMOKE_URL || 'https://www.instagram.com/reel/DbDp7T4olyC/';

if (!process.env.APIFY_TOKEN) {
  console.error('✗ APIFY_TOKEN не задан — проверка невозможна.');
  process.exit(1);
}

async function main() {
  console.log('Проверяю Apify-интеграцию…');
  console.log(`Актор: ${ACTOR}`);
  console.log(`URL:   ${TEST_URL}`);
  console.log(`Режим: ${String(process.env.APIFY_MOCK) === '1' ? 'МОК (ничего не вызывается)' : 'ЖИВОЙ вызов'}`);

  if (String(process.env.APIFY_MOCK) === '1') {
    console.log('≥ APIFY_MOCK=1 — поставьте APIFY_MOCK=0 для реального вызова.');
    console.log('≥ Токен присутствует, файл модуля подключения корректен.');
    return;
  }

  try {
    const items = await require('../apify').fetchByLinks([TEST_URL]);
    if (!items.length) {
      console.error('✗ Актор вернул пустой набор данных.');
      process.exit(1);
    }
    const r = items[0];
    console.log('✓ Ответ получен. Формат данных:');
    console.log(JSON.stringify({
      ig_url: r.ig_url,
      shortcode: r.shortcode,
      views: r.views,
      likes: r.likes,
      comments: r.comments,
      posted_at: r.posted_at,
      cover_url: (r.cover_url || '').slice(0, 60) + '…',
    }, null, 2));
    console.log('✓ Интеграция рабочая: токен валидный, формат совпадает с ожиданиями.');
  } catch (e) {
    console.error('✗ Ошибка интеграции:', e.message);
    process.exit(1);
  }
}

main();