require('dotenv').config();
const { connectDB } = require('./config/db');

async function setupTables() {
  try {
    const pool = await connectDB();
    
    // Create ReceptionistLogins table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ReceptionistLogins' and xtype='U')
      CREATE TABLE ReceptionistLogins (
          ID INT PRIMARY KEY IDENTITY(1,1),
          Username NVARCHAR(50) NOT NULL UNIQUE,
          Password NVARCHAR(255) NOT NULL
      )
    `);
    console.log('ReceptionistLogins table created or already exists.');

    // Create OPDHandlerLogins table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='OPDHandlerLogins' and xtype='U')
      CREATE TABLE OPDHandlerLogins (
          ID INT PRIMARY KEY IDENTITY(1,1),
          Username NVARCHAR(50) NOT NULL UNIQUE,
          Password NVARCHAR(255) NOT NULL
      )
    `);
    console.log('OPDHandlerLogins table created or already exists.');

    // Insert default data if not exists
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM ReceptionistLogins WHERE Username = 'admin')
      INSERT INTO ReceptionistLogins (Username, Password) VALUES ('admin', 'admin123')
    `);
    console.log('Inserted default admin for Receptionist.');

    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM OPDHandlerLogins WHERE Username = 'admin')
      INSERT INTO OPDHandlerLogins (Username, Password) VALUES ('admin', 'admin123')
    `);
    console.log('Inserted default admin for OPDHandler.');

    console.log('Database setup complete.');
    process.exit(0);
  } catch (error) {
    console.error('Error setting up tables:', error);
    process.exit(1);
  }
}

setupTables();
