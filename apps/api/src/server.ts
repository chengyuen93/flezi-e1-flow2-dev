import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createApp } from './app';
import { createDatabase } from './database';

const databasePath = resolve(process.env.DATABASE_PATH ?? 'data/auth.sqlite');
mkdirSync(dirname(databasePath), { recursive: true });

async function startServer(): Promise<void> {
  const database = createDatabase(databasePath);
  const app = await createApp(database);
  const port = Number(process.env.PORT ?? 4000);

  app.listen(port, () => {
    console.log(`Authentication API listening on port ${port}`);
  });
}

void startServer();
