require('dotenv/config');
const { spawnSync } = require('node:child_process');

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  console.error(
    'TEST_DATABASE_URL não está definida. Configure-a em apps/api/.env antes de rodar os testes de integração.',
  );
  process.exit(1);
}

const env = { ...process.env, DATABASE_URL: testDatabaseUrl };

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', env });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run('npx', ['prisma', 'migrate', 'deploy']);
run('npx', ['jest', '--config', 'test/jest-integration.json']);
