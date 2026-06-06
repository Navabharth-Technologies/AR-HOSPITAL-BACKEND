const sql = require('mssql');

let dbServer = process.env.DB_SERVER || 'localhost';
let instanceName = undefined;

if (dbServer.includes('\\')) {
  const parts = dbServer.split('\\');
  dbServer = parts[0];
  instanceName = parts[1];
}

const config = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'YourPassword123!',
  server: dbServer,
  database: process.env.DB_NAME || 'AR_Hospital',
  options: {
    encrypt: true, // For Azure
    trustServerCertificate: true, // Change to true for local dev / self-signed certs
    instanceName: instanceName
  }
};

let pool;

const connectDB = async () => {
  try {
    if (pool) return pool;
    pool = await sql.connect(config);
    console.log('Connected to MS SQL Server - AR_Hospital Database');
    return pool;
  } catch (err) {
    console.error('Database Connection Failed! Bad Config: ', err);
    throw err;
  }
};

module.exports = {
  sql,
  connectDB
};
