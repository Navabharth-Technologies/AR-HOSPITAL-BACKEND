const express = require('express');
const router = express.Router();
const multer = require('multer');
const { connectDB, sql } = require('../config/db');
const { BlobServiceClient } = require('@azure/storage-blob');
const crypto = require('crypto');
const path = require('path');

// Multer in-memory storage for uploading to Azure
const upload = multer({ storage: multer.memoryStorage() });

// Read Azure config from environment
const AZURE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING || process.env.AZURE_CONNECTION_STRING;
const CONTAINER_NAME = process.env.AZURE_CONTAINER_NAME;

// Helper to get container client
const getContainerClient = () => {
    if (!AZURE_CONNECTION_STRING || !CONTAINER_NAME) {
        throw new Error('Azure Storage Connection String or Container Name not configured in .env');
    }
    const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_CONNECTION_STRING);
    return blobServiceClient.getContainerClient(CONTAINER_NAME);
};

// 1. POST /upload-video
router.post('/upload-video', upload.single('video'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No video file provided' });
        }

        const originalName = req.file.originalname;
        const extension = path.extname(originalName);
        const blobName = `${crypto.randomUUID()}${extension}`;

        const containerClient = getContainerClient();
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);

        // Upload to Azure with Cache-Control
        await blockBlobClient.uploadData(req.file.buffer, {
            blobHTTPHeaders: {
                blobContentType: req.file.mimetype || 'video/mp4',
                blobCacheControl: 'public,max-age=31536000'
            }
        });

        const videoUrl = blockBlobClient.url;

        // Determine next DisplayOrder
        const pool = await connectDB();
        const maxOrderResult = await pool.request().query('SELECT ISNULL(MAX(DisplayOrder), 0) + 1 AS NextOrder FROM Videos');
        const nextOrder = maxOrderResult.recordset[0].NextOrder;

        // Insert into DB
        const insertResult = await pool.request()
            .input('VideoName', sql.VarChar(255), originalName)
            .input('VideoUrl', sql.VarChar(sql.MAX), videoUrl)
            .input('DisplayOrder', sql.Int, nextOrder)
            .query(`
                INSERT INTO Videos (VideoName, VideoUrl, DisplayOrder, IsActive, CreatedDate)
                OUTPUT INSERTED.*
                VALUES (@VideoName, @VideoUrl, @DisplayOrder, 1, GETDATE())
            `);

        res.json({ success: true, video: insertResult.recordset[0] });

    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ success: false, error: 'Failed to upload video' });
    }
});

// 2. GET /videos - Active Playlist
router.get('/videos', async (req, res) => {
    try {
        const pool = await connectDB();
        const result = await pool.request().query(`
            SELECT Id, VideoName, VideoUrl, DisplayOrder 
            FROM Videos 
            WHERE IsActive = 1 
            ORDER BY DisplayOrder ASC
        `);
        
        // Return in expected format for AR Display
        const videos = result.recordset.map(v => v.VideoUrl);
        res.json({ success: true, videos, detailed: result.recordset });
    } catch (error) {
        console.error('Fetch Videos Error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch videos' });
    }
});

// Admin Route: Get ALL videos
router.get('/admin/videos', async (req, res) => {
    try {
        const pool = await connectDB();
        const result = await pool.request().query(`
            SELECT * 
            FROM Videos 
            ORDER BY IsActive DESC, DisplayOrder ASC
        `);
        res.json({ success: true, videos: result.recordset });
    } catch (error) {
        console.error('Fetch Admin Videos Error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch videos' });
    }
});

// 3. PUT /videos/:id - Update metadata
router.put('/videos/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const { VideoName, DisplayOrder, IsActive } = req.body;

        const pool = await connectDB();
        
        let updateFields = [];
        const request = pool.request().input('Id', sql.Int, id);

        if (VideoName !== undefined) {
            updateFields.push('VideoName = @VideoName');
            request.input('VideoName', sql.VarChar(255), VideoName);
        }
        if (DisplayOrder !== undefined) {
            updateFields.push('DisplayOrder = @DisplayOrder');
            request.input('DisplayOrder', sql.Int, DisplayOrder);
        }
        if (IsActive !== undefined) {
            updateFields.push('IsActive = @IsActive');
            request.input('IsActive', sql.Bit, IsActive ? 1 : 0);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ success: false, error: 'No fields to update' });
        }

        updateFields.push('UpdatedDate = GETDATE()');

        const query = `
            UPDATE Videos 
            SET ${updateFields.join(', ')} 
            OUTPUT INSERTED.*
            WHERE Id = @Id
        `;

        const result = await request.query(query);

        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, error: 'Video not found' });
        }

        res.json({ success: true, video: result.recordset[0] });

    } catch (error) {
        console.error('Update Video Error:', error);
        res.status(500).json({ success: false, error: 'Failed to update video' });
    }
});

// 4. DELETE /videos/:id - Hard Delete
router.delete('/videos/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const pool = await connectDB();
        
        // 1. Get the video URL so we can delete it from Azure
        const selectResult = await pool.request()
            .input('Id', sql.Int, id)
            .query('SELECT VideoUrl FROM Videos WHERE Id = @Id');

        if (selectResult.recordset.length === 0) {
            return res.status(404).json({ success: false, error: 'Video not found' });
        }

        const videoUrl = selectResult.recordset[0].VideoUrl;
        
        // 2. Delete from Azure Blob Storage
        try {
            const blobName = videoUrl.substring(videoUrl.lastIndexOf('/') + 1);
            const containerClient = getContainerClient();
            const blockBlobClient = containerClient.getBlockBlobClient(blobName);
            await blockBlobClient.deleteIfExists();
        } catch (azureErr) {
            console.error('Failed to delete blob from Azure:', azureErr);
        }

        // 3. Delete from DB completely
        await pool.request()
            .input('Id', sql.Int, id)
            .query('DELETE FROM Videos WHERE Id = @Id');

        res.json({ success: true });

    } catch (error) {
        console.error('Delete Video Error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete video' });
    }
});

module.exports = router;
