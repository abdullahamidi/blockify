import { fileURLToPath } from 'node:url';
import { config } from './config';
import { createApp } from './app';
import { CatalogStore } from './catalogStore';
import { OrderStore } from './store';

const store = new OrderStore(config.dataDir);
await store.init();
const catalogs = new CatalogStore(config.dataDir);
await catalogs.init();

const staticDir = config.isProd ? fileURLToPath(new URL('../dist', import.meta.url)) : undefined;
const app = createApp(store, catalogs, config, staticDir);

app.listen(config.port, () => {
  console.log(`Blockify sunucusu http://localhost:${config.port} adresinde (${config.isProd ? 'üretim' : 'geliştirme'})`);
});
