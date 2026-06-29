-- Run this script in SQL Server Management Studio (SSMS) against the AR_Hospital database

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Videos' and xtype='U')
BEGIN
    CREATE TABLE Videos
    (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        VideoName VARCHAR(255) NOT NULL,
        VideoUrl VARCHAR(MAX) NOT NULL,
        DisplayOrder INT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedDate DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedDate DATETIME NULL
    );
    PRINT 'Videos table created successfully.';
    
END
ELSE
BEGIN
    PRINT 'Videos table already exists.';
END
GO
