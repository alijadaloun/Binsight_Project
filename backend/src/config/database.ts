import mysql from 'mysql2/promise';

const requiredEnvironmentVariables = ['DB_HOST', 'DB_NAME', 'DB_USER'] as const;

function getDatabaseConfig(): mysql.PoolOptions {
  const missingVariables: string[] = requiredEnvironmentVariables.filter((variable) => !process.env[variable]);

  if (process.env.DB_PASSWORD === undefined) {
    missingVariables.push('DB_PASSWORD');
  }

  if (missingVariables.length > 0) {
    throw new Error(`Missing required database environment variables: ${missingVariables.join(', ')}`);
  }

  const port = Number(process.env.DB_PORT ?? 3306);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('DB_PORT must be an integer between 1 and 65535.');
  }

  return {
    host: process.env.DB_HOST,
    port,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    waitForConnections: true,
    connectionLimit: 10,
    decimalNumbers: true,
    connectTimeout: 10000
  };
}

export const databasePool = mysql.createPool(getDatabaseConfig());

export async function verifyDatabaseConnection(): Promise<void> {
  await databasePool.query('SELECT 1');
}
