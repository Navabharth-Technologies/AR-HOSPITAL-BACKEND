require('dotenv').config();
const { connectDB, sql } = require('./config/db');

async function createAdminTable() {
    try {
        const pool = await connectDB();
        
        // Create table if not exists
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SignageAdminLogins' and xtype='U')
            BEGIN
                CREATE TABLE SignageAdminLogins (
                    ID INT IDENTITY(1,1) PRIMARY KEY,
                    Username NVARCHAR(50) NOT NULL,
                    Password NVARCHAR(255) NOT NULL
                );
                PRINT 'SignageAdminLogins table created.';
            END
            ELSE
            BEGIN
                PRINT 'SignageAdminLogins table already exists.';
            END
        `);

        // Check if user exists
        const checkResult = await pool.request()
            .input('Username', sql.NVarChar(50), 'Navabharath')
            .query('SELECT * FROM SignageAdminLogins WHERE Username = @Username');

        if (checkResult.recordset.length === 0) {
            // Insert user
            await pool.request()
                .input('Username', sql.NVarChar(50), 'Navabharath')
                .input('Password', sql.NVarChar(255), 'NBT@1122')
                .query('INSERT INTO SignageAdminLogins (Username, Password) VALUES (@Username, @Password)');
            console.log('Admin user Navabharath inserted successfully.');
        } else {
            // Update user just in case
            await pool.request()
                .input('Username', sql.NVarChar(50), 'Navabharath')
                .input('Password', sql.NVarChar(255), 'NBT@1122')
                .query('UPDATE SignageAdminLogins SET Password = @Password WHERE Username = @Username');
            console.log('Admin user Navabharath already exists, password updated.');
        }

        console.log('Database migration for Signage Admin completed.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

createAdminTable();
