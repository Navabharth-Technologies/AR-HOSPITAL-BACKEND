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

IF NOT EXISTS (SELECT * FROM SignageAdminLogins WHERE Username = 'Navabharath')
BEGIN
    INSERT INTO SignageAdminLogins (Username, Password) VALUES ('Navabharath', 'NBT@1122');
    PRINT 'Admin user Navabharath inserted successfully.';
END
ELSE
BEGIN
    UPDATE SignageAdminLogins SET Password = 'NBT@1122' WHERE Username = 'Navabharath';
    PRINT 'Admin user Navabharath already exists, password updated.';
END
