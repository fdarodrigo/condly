require('dotenv/config');
const { spawnSync } = require('node:child_process');

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  console.error(
    'TEST_DATABASE_URL não está definida. Configure-a em apps/api/.env antes de rodar o smoke test do seed.',
  );
  process.exit(1);
}

// Roda contra o mesmo banco descartável usado por test:integration — nunca
// o de dev (DATABASE_URL), pra não sobrescrever um cenário de demonstração
// já preparado manualmente.
const env = { ...process.env, DATABASE_URL: testDatabaseUrl };

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', env });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run('npx', ['prisma', 'migrate', 'deploy']);
run('npx', ['ts-node', 'prisma/seed.ts']);
run('npx', ['ts-node', 'scripts/verify-seed-counts.ts']);
