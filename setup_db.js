const sql = require('mssql');
require('dotenv').config();
const { connectDB } = require('./config/db');

async function setup() {
  try {
    const pool = await connectDB();
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Patients' AND xtype='U')
      CREATE TABLE Patients (
        PatientID INT IDENTITY(1,1) PRIMARY KEY,
        PatientName NVARCHAR(100),
        Gender NVARCHAR(10),
        Age INT,
        MobileNumber NVARCHAR(20),
        ConsultingDoctor NVARCHAR(100),
        OPDNumber NVARCHAR(50),
        QueueStatus NVARCHAR(20),
        Timestamp DATETIME DEFAULT GETDATE()
      )
    `);
    console.log('Table Patients created or already exists.');

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ReceptionistLogins' AND xtype='U')
      BEGIN
        CREATE TABLE ReceptionistLogins (
          ID INT IDENTITY(1,1) PRIMARY KEY,
          Username NVARCHAR(50) UNIQUE NOT NULL,
          Password NVARCHAR(255) NOT NULL
        )
      END
    `);
    console.log('Table ReceptionistLogins created or already exists.');

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='OPDHandlerLogins' AND xtype='U')
      BEGIN
        CREATE TABLE OPDHandlerLogins (
          ID INT IDENTITY(1,1) PRIMARY KEY,
          Username NVARCHAR(50) UNIQUE NOT NULL,
          Password NVARCHAR(255) NOT NULL
        )
      END
    `);
    console.log('Table OPDHandlerLogins created or already exists.');

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM ReceptionistLogins WHERE Username='admin')
      BEGIN
        INSERT INTO ReceptionistLogins (Username, Password) VALUES ('admin', 'admin123')
      END

      IF NOT EXISTS (SELECT * FROM OPDHandlerLogins WHERE Username='opd')
      BEGIN
        INSERT INTO OPDHandlerLogins (Username, Password) VALUES ('opd', 'opd123')
      END
    `);
    console.log('Default login accounts inserted or already exist.');

    process.exit(0);
  } catch(e) {
    console.error('Error creating table:', e);
    process.exit(1);
  }
}
setup();
