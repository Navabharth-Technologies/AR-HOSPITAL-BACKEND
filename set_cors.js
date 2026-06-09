require('dotenv').config();
const { BlobServiceClient } = require('@azure/storage-blob');

async function setCORS() {
    try {
        const AZURE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
        const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_CONNECTION_STRING);
        
        const properties = await blobServiceClient.getProperties();
        console.log("Current CORS rules:", JSON.stringify(properties.cors, null, 2));

        const corsRule = {
            allowedOrigins: "*",
            allowedMethods: "GET,OPTIONS,HEAD",
            allowedHeaders: "*",
            exposedHeaders: "*",
            maxAgeInSeconds: 86400
        };

        properties.cors = [corsRule];

        await blobServiceClient.setProperties(properties);
        console.log("CORS updated successfully!");
    } catch (e) {
        console.error("Error setting CORS:", e);
    }
}

setCORS();
