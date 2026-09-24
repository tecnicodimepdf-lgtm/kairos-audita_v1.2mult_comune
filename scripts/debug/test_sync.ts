import { syncRealDimepKairos } from './server/kairos';
import { dbInstance } from './server/db';

async function main() {
  console.log('Syncing...');
  const config = dbInstance.getConfig();
  const res = await syncRealDimepKairos(dbInstance, config);
  console.log('Done:', res);
}
main().catch(console.error);
