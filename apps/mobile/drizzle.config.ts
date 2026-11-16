import { defineConfig } from 'drizzle-kit';

// `npm run db:generate` after changing src/db/schema.ts writes a new migration to drizzle/.
export default defineConfig({
  dialect: 'sqlite',
  driver: 'expo',
  schema: './src/db/schema.ts',
  out: './drizzle',
});
