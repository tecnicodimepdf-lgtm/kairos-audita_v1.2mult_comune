import { syncRealDimepKairos } from './server/kairos';
import { Database } from './server/db';

async function main() {
  console.log('Syncing...');
  const db = new Database();
  await syncRealDimepKairos(db, db.getConfig());
  console.log('Done');
}

main().catch(console.error);
