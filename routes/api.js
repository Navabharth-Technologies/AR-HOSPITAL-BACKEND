const express = require('express');
const router = express.Router();
const multer = require('multer');
const { exec } = require('child_process');
const path = require('path');
const { parsePdfAndExtract } = require('../controllers/ocrController');
const { connectDB, sql } = require('../config/db');

// Global state for tracking pending/active OT Timers per OPD
const pendingOTTimers = {}; // { 'OPD 1': { durationMinutes: 30, timerId: null, endTime: null, isActive: false } }
const staticStatuses = {}; // { 'OPD 1': 'AVAILABLE' }

const upload = multer({ storage: multer.memoryStorage() });

// User Login Endpoint
router.post('/login', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password || !role) {
      return res.status(400).json({ success: false, message: 'Username, password, and role are required' });
    }

    let tableName = '';
    if (role === 'RECEPTIONIST') {
      tableName = 'ReceptionistLogins';
    } else if (role === 'OPD_HANDLER') {
      tableName = 'OPDHandlerLogins';
    } else {
      return res.status(400).json({ success: false, message: 'Invalid role specified' });
    }

    const pool = await connectDB();
    // Using string interpolation for table name is safe here because we strictly control the values above
    const result = await pool.request()
      .input('Username', sql.NVarChar(50), username)
      .query(`SELECT ID, Username, Password FROM ${tableName} WHERE Username = @Username`);

    if (result.recordset.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const user = result.recordset[0];
    
    if (user.Password !== password) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.ID,
        username: user.Username,
        role: role
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// OCR PDF Upload Endpoint
router.post('/upload-bill', upload.single('billPdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded.' });
    }
    
    // Process PDF and extract data
    const extractedData = await parsePdfAndExtract(req.file.buffer);
    
    // Automatically save to database with DRAFT status
    const pool = await connectDB();
    const result = await pool.request()
      .input('PatientName', sql.NVarChar(100), extractedData.PatientName)
      .input('Gender', sql.NVarChar(10), extractedData.Gender)
      .input('Age', sql.Int, extractedData.Age)
      .input('MobileNumber', sql.NVarChar(20), extractedData.MobileNumber)
      .input('ConsultingDoctor', sql.NVarChar(100), '')
      .input('OPDNumber', sql.NVarChar(50), '')
      .input('QueueStatus', sql.NVarChar(20), 'DRAFT')
      .query(`
        INSERT INTO Patients (PatientName, Gender, Age, MobileNumber, ConsultingDoctor, OPDNumber, QueueStatus, Timestamp)
        OUTPUT INSERTED.PatientID, INSERTED.Timestamp
        VALUES (@PatientName, @Gender, @Age, @MobileNumber, @ConsultingDoctor, @OPDNumber, @QueueStatus, GETDATE())
      `);
      
    const newPatient = {
      PatientID: result.recordset[0].PatientID,
      PatientName: extractedData.PatientName, 
      Gender: extractedData.Gender, 
      Age: extractedData.Age, 
      MobileNumber: extractedData.MobileNumber, 
      ConsultingDoctor: '', 
      OPDNumber: '', 
      QueueStatus: 'DRAFT',
      Timestamp: result.recordset[0].Timestamp
    };

    // Note: We don't broadcast to OPD displays yet because it's a DRAFT and has no OPD
    // req.io.emit('queue_updated', { type: 'NEW_PATIENT', patient: newPatient });

    res.json({ success: true, data: newPatient });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to process PDF and save patient' });
  }
});

// Create new DRAFT patient queue entry (from manual entry)
router.post('/patients/draft', async (req, res) => {
  try {
    const { PatientName, Gender, Age, MobileNumber } = req.body;
    const pool = await connectDB();
    
    const result = await pool.request()
      .input('PatientName', sql.NVarChar(100), PatientName)
      .input('Gender', sql.NVarChar(10), Gender)
      .input('Age', sql.Int, Age)
      .input('MobileNumber', sql.NVarChar(20), MobileNumber)
      .input('ConsultingDoctor', sql.NVarChar(100), '')
      .input('OPDNumber', sql.NVarChar(50), '')
      .input('QueueStatus', sql.NVarChar(20), 'DRAFT')
      .query(`
        INSERT INTO Patients (PatientName, Gender, Age, MobileNumber, ConsultingDoctor, OPDNumber, QueueStatus, Timestamp)
        OUTPUT INSERTED.PatientID, INSERTED.Timestamp
        VALUES (@PatientName, @Gender, @Age, @MobileNumber, @ConsultingDoctor, @OPDNumber, @QueueStatus, GETDATE())
      `);
      
    const newPatient = {
      PatientID: result.recordset[0].PatientID,
      PatientName, Gender, Age, MobileNumber, ConsultingDoctor: '', OPDNumber: '', QueueStatus: 'DRAFT',
      Timestamp: result.recordset[0].Timestamp
    };

    res.json({ success: true, data: newPatient });
  } catch (error) {
    console.error('Error adding draft patient:', error);
    res.status(500).json({ error: 'Failed to add draft patient' });
  }
});

// Create new patient queue entry
router.post('/patients', async (req, res) => {
  try {
    const { PatientName, Gender, Age, MobileNumber, ConsultingDoctor, OPDNumber } = req.body;
    const pool = await connectDB();
    
    const result = await pool.request()
      .input('PatientName', sql.NVarChar(100), PatientName)
      .input('Gender', sql.NVarChar(10), Gender)
      .input('Age', sql.Int, Age)
      .input('MobileNumber', sql.NVarChar(20), MobileNumber)
      .input('ConsultingDoctor', sql.NVarChar(100), ConsultingDoctor)
      .input('OPDNumber', sql.NVarChar(50), OPDNumber)
      .input('QueueStatus', sql.NVarChar(20), 'WAITING')
      .query(`
        INSERT INTO Patients (PatientName, Gender, Age, MobileNumber, ConsultingDoctor, OPDNumber, QueueStatus, Timestamp)
        OUTPUT INSERTED.PatientID, INSERTED.Timestamp
        VALUES (@PatientName, @Gender, @Age, @MobileNumber, @ConsultingDoctor, @OPDNumber, @QueueStatus, GETDATE())
      `);
      
    const newPatient = {
      PatientID: result.recordset[0].PatientID,
      PatientName, Gender, Age, MobileNumber, ConsultingDoctor, OPDNumber, QueueStatus: 'WAITING',
      Timestamp: result.recordset[0].Timestamp
    };

    // Emit socket event to update dashboards
    req.io.emit('queue_updated', { type: 'NEW_PATIENT', patient: newPatient });
    
    res.json({ success: true, patient: newPatient });
  } catch (error) {
    console.error('Error adding patient:', error);
    res.status(500).json({ error: 'Failed to add patient to queue' });
  }
});

// Get all active patients (Waiting or Hold) for an OPD
router.get('/patients/opd/:opdNumber', async (req, res) => {
  try {
    const opdNumber = req.params.opdNumber;
    const pool = await connectDB();
    
    const result = await pool.request()
      .input('OPDNumber', sql.NVarChar(50), opdNumber)
      .query(`
        SELECT * FROM Patients 
        WHERE OPDNumber = @OPDNumber 
        AND QueueStatus IN ('WAITING', 'HOLD', 'UNHOLD')
        ORDER BY 
          IsActive DESC,
          CASE WHEN QueueStatus = 'UNHOLD' THEN 1 WHEN QueueStatus = 'HOLD' THEN 2 ELSE 3 END,
          IsEmergency DESC,
          Timestamp ASC
      `);
      
    res.json({ success: true, patients: result.recordset });
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({ error: 'Failed to fetch patients' });
  }
});

// Route a patient (assign Doctor, OPD, Specialization and move to WAITING)
router.put('/patients/:id/route', async (req, res) => {
  try {
    const { id } = req.params;
    const { ConsultingDoctor, OPDNumber, Specialization, IsEmergency } = req.body;
    
    const pool = await connectDB();

    let emergencyToken = null;
    let opdToken = null;

    if (IsEmergency) {
      const tokenCheck = await pool.request()
        .query("SELECT ISNULL(MAX(EmergencyTokenNumber), 0) + 1 as nextToken FROM Patients WHERE CONVERT(date, Timestamp) = CONVERT(date, GETDATE())");
      emergencyToken = tokenCheck.recordset[0].nextToken;
    } else if (OPDNumber) {
      let baseToken = 0;
      if (OPDNumber === 'OPD 1') baseToken = 1000;
      else if (OPDNumber === 'OPD 2') baseToken = 2000;
      else if (OPDNumber === 'OPD 3') baseToken = 3000;

      if (baseToken > 0) {
        const tokenCheck = await pool.request()
          .input('OPDNumber', sql.NVarChar(50), OPDNumber)
          .input('BaseToken', sql.Int, baseToken)
          .query("SELECT ISNULL(MAX(OpdTokenNumber), @BaseToken) + 1 as nextToken FROM Patients WHERE OPDNumber = @OPDNumber AND CONVERT(date, Timestamp) = CONVERT(date, GETDATE())");
        opdToken = tokenCheck.recordset[0].nextToken;
      }
    }

    await pool.request()
      .input('PatientID', sql.Int, id)
      .input('ConsultingDoctor', sql.NVarChar(100), ConsultingDoctor)
      .input('OPDNumber', sql.NVarChar(50), OPDNumber)
      .input('Specialization', sql.NVarChar(100), Specialization)
      .input('IsEmergency', sql.Bit, IsEmergency ? 1 : 0)
      .input('EmergencyTokenNumber', sql.Int, emergencyToken)
      .input('OpdTokenNumber', sql.Int, opdToken)
      .input('IsActive', sql.Bit, 0)
      .input('QueueStatus', sql.NVarChar(20), 'WAITING')
      .query(`
        UPDATE Patients 
        SET ConsultingDoctor = @ConsultingDoctor, OPDNumber = @OPDNumber, Specialization = @Specialization, IsEmergency = @IsEmergency, EmergencyTokenNumber = @EmergencyTokenNumber, OpdTokenNumber = @OpdTokenNumber, IsActive = @IsActive, QueueStatus = @QueueStatus, Timestamp = GETDATE()
        WHERE PatientID = @PatientID
      `);
      
    // Auto-promote if the destination queue is empty
    if (OPDNumber) {
      const activeCheck = await pool.request()
        .input('OPDCheckNumber', sql.NVarChar(50), OPDNumber)
        .query("SELECT COUNT(*) as count FROM Patients WHERE OPDNumber = @OPDCheckNumber AND IsActive = 1");

      if (activeCheck.recordset[0].count === 0) {
        await pool.request()
          .input('OPDCheckNumber', sql.NVarChar(50), OPDNumber)
          .query(`
            DECLARE @NextPatientID INT;
            SELECT TOP 1 @NextPatientID = PatientID FROM Patients
            WHERE OPDNumber = @OPDCheckNumber AND QueueStatus IN ('WAITING', 'UNHOLD')
            ORDER BY CASE WHEN QueueStatus = 'UNHOLD' THEN 1 ELSE 2 END, IsEmergency DESC, Timestamp ASC;
            IF @NextPatientID IS NOT NULL
              UPDATE Patients SET IsActive = 1 WHERE PatientID = @NextPatientID;
          `);
      }
    }

    // Fetch updated patient to broadcast (in case they were the one promoted)
    const finalPatientReq = await pool.request()
      .input('PatientIDFinal', sql.Int, id)
      .query('SELECT * FROM Patients WHERE PatientID = @PatientIDFinal');
      
    const finalPatient = finalPatientReq.recordset[0];
    
    // Now broadcast to the OPDs since they are properly queued
    req.io.emit('queue_updated', { type: 'NEW_PATIENT', patient: finalPatient });
    
    res.json({ success: true, patient: finalPatient });
  } catch (error) {
    console.error('Error routing patient:', error);
    res.status(500).json({ error: 'Failed to route patient' });
  }
});

// Update patient status
router.put('/patients/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'COMPLETED', 'HOLD', 'CANCELLED', 'WAITING'
    
    const pool = await connectDB();
    await pool.request()
      .input('PatientID', sql.Int, id)
      .input('QueueStatus', sql.NVarChar(20), status)
      .query(`
        UPDATE Patients 
        SET QueueStatus = @QueueStatus, 
            IsActive = CASE WHEN @QueueStatus IN ('COMPLETED', 'CANCELLED', 'HOLD') THEN 0 ELSE IsActive END
        WHERE PatientID = @PatientID
      `);

    const getOpd = await pool.request()
      .input('PatientID', sql.Int, id)
      .query('SELECT OPDNumber FROM Patients WHERE PatientID = @PatientID');
    const opdNumber = getOpd.recordset[0]?.OPDNumber;

    if (opdNumber) {
      // ONLY promote if there's no active patient
      const activeCheck = await pool.request()
        .input('OPDNumber', sql.NVarChar(50), opdNumber)
        .query("SELECT COUNT(*) as count FROM Patients WHERE OPDNumber = @OPDNumber AND IsActive = 1");

      if (activeCheck.recordset[0].count === 0) {
        if (pendingOTTimers[opdNumber] && !pendingOTTimers[opdNumber].isActive) {
          // We have a pending timer, so start it now instead of promoting the next patient
          const duration = pendingOTTimers[opdNumber].durationMinutes;
          const endTimeMs = Date.now() + duration * 60 * 1000;
          
          pendingOTTimers[opdNumber].isActive = true;
          pendingOTTimers[opdNumber].endTime = endTimeMs;
          
          req.io.emit('ot_timer_started', { opdId: opdNumber, endTime: endTimeMs, durationMinutes: duration });
          
          pendingOTTimers[opdNumber].timerId = setTimeout(async () => {
            // Timer expired naturally
            delete pendingOTTimers[opdNumber];
            req.io.emit('ot_timer_ended', { opdId: opdNumber });
            
            try {
              const innerPool = await connectDB();
              await innerPool.request()
                .input('OPDNumber', sql.NVarChar(50), opdNumber)
                .query(`
                  DECLARE @NextPatientID INT;
                  SELECT TOP 1 @NextPatientID = PatientID FROM Patients
                  WHERE OPDNumber = @OPDNumber AND QueueStatus IN ('WAITING', 'UNHOLD')
                  ORDER BY CASE WHEN QueueStatus = 'UNHOLD' THEN 1 ELSE 2 END, IsEmergency DESC, Timestamp ASC;
                  IF @NextPatientID IS NOT NULL
                    UPDATE Patients SET IsActive = 1 WHERE PatientID = @NextPatientID;
                `);
              req.io.emit('queue_updated', { type: 'TIMER_RESUMED' });
            } catch(e) { console.error("Error auto-resuming queue:", e); }
          }, duration * 60 * 1000);
          
        } else if (!pendingOTTimers[opdNumber] || !pendingOTTimers[opdNumber].isActive) {
          // No timer, or timer not active, so proceed normally if not away/holiday
          const opdStaticStatus = staticStatuses[opdNumber] || 'AVAILABLE';
          if (opdStaticStatus === 'AVAILABLE') {
            await pool.request()
              .input('OPDNumber', sql.NVarChar(50), opdNumber)
              .query(`
                DECLARE @NextPatientID INT;
                SELECT TOP 1 @NextPatientID = PatientID FROM Patients
                WHERE OPDNumber = @OPDNumber AND QueueStatus IN ('WAITING', 'UNHOLD')
                ORDER BY CASE WHEN QueueStatus = 'UNHOLD' THEN 1 ELSE 2 END, IsEmergency DESC, Timestamp ASC;
                IF @NextPatientID IS NOT NULL
                  UPDATE Patients SET IsActive = 1 WHERE PatientID = @NextPatientID;
              `);
          }
        }
      }
    }
      
    // Fetch updated patient to broadcast
    const updatedPatientReq = await pool.request()
      .input('PatientID', sql.Int, id)
      .query('SELECT * FROM Patients WHERE PatientID = @PatientID');
      
    const updatedPatient = updatedPatientReq.recordset[0];
    
    req.io.emit('queue_updated', { type: 'STATUS_CHANGED', patient: updatedPatient });
    
    res.json({ success: true, patient: updatedPatient });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ error: 'Failed to update patient status' });
  }
});

// Manually call the next patient in the queue
router.post('/opd/:opdNumber/call-next', async (req, res) => {
  try {
    const opdNumber = req.params.opdNumber;
    const pool = await connectDB();
    
    // Check if there is already an active patient
    const activeCheck = await pool.request()
      .input('OPDNumber', sql.NVarChar(50), opdNumber)
      .query("SELECT COUNT(*) as count FROM Patients WHERE OPDNumber = @OPDNumber AND IsActive = 1");

    if (activeCheck.recordset[0].count > 0) {
      return res.status(400).json({ success: false, error: 'A patient is already active' });
    }

    // Promote the next patient
    await pool.request()
      .input('OPDNumber', sql.NVarChar(50), opdNumber)
      .query(`
        DECLARE @NextPatientID INT;
        SELECT TOP 1 @NextPatientID = PatientID FROM Patients
        WHERE OPDNumber = @OPDNumber AND QueueStatus IN ('WAITING', 'UNHOLD')
        ORDER BY CASE WHEN QueueStatus = 'UNHOLD' THEN 1 ELSE 2 END, IsEmergency DESC, Timestamp ASC;
        IF @NextPatientID IS NOT NULL
          UPDATE Patients SET IsActive = 1 WHERE PatientID = @NextPatientID;
      `);
      
    req.io.emit('queue_updated', { type: 'CALL_NEXT' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error calling next patient:', error);
    res.status(500).json({ error: 'Failed to call next patient' });
  }
});


// Set a pending OT timer for an OPD
router.post('/opd/:opdNumber/ot-timer', async (req, res) => {
  try {
    const opdNumber = req.params.opdNumber;
    const { durationMinutes } = req.body;
    
    if (pendingOTTimers[opdNumber] && pendingOTTimers[opdNumber].timerId) {
      clearTimeout(pendingOTTimers[opdNumber].timerId);
    }

    pendingOTTimers[opdNumber] = { 
      durationMinutes: parseInt(durationMinutes), 
      timerId: null, 
      endTime: null,
      isActive: false
    };

    // Check if there's currently an active patient. If not, start the timer immediately.
    const pool = await connectDB();
    const activeCheck = await pool.request()
      .input('OPDNumber', sql.NVarChar(50), opdNumber)
      .query("SELECT COUNT(*) as count FROM Patients WHERE OPDNumber = @OPDNumber AND IsActive = 1 AND QueueStatus IN ('WAITING', 'HOLD')");
    
    if (activeCheck.recordset[0].count === 0) {
      // No active patient, start immediately
      const duration = pendingOTTimers[opdNumber].durationMinutes;
      const endTimeMs = Date.now() + duration * 60 * 1000;
      
      pendingOTTimers[opdNumber].isActive = true;
      pendingOTTimers[opdNumber].endTime = endTimeMs;
      
      req.io.emit('ot_timer_started', { opdId: opdNumber, endTime: endTimeMs, durationMinutes: duration });
      
      pendingOTTimers[opdNumber].timerId = setTimeout(async () => {
        delete pendingOTTimers[opdNumber];
        req.io.emit('ot_timer_ended', { opdId: opdNumber });
        req.io.emit('queue_updated', { type: 'TIMER_RESUMED' });
      }, duration * 60 * 1000);
      
      return res.json({ success: true, message: `OT Timer started immediately for ${durationMinutes} mins.` });
    }

    res.json({ success: true, message: `Pending OT timer set for ${opdNumber} (${durationMinutes} mins). Will trigger after current patient.` });
  } catch (error) {
    console.error('Error setting OT timer:', error);
    res.status(500).json({ error: 'Failed to set OT timer' });
  }
});

// Unified Check Status for an OPD
router.get('/opd/:opdNumber/status', (req, res) => {
  const opdNumber = req.params.opdNumber;
  const staticStatus = staticStatuses[opdNumber] || 'AVAILABLE';
  
  if (staticStatus !== 'AVAILABLE') {
    return res.json({ success: true, status: staticStatus, hasTimer: false });
  }

  if (pendingOTTimers[opdNumber]) {
    res.json({
      success: true,
      status: 'OT',
      hasTimer: true,
      isActive: pendingOTTimers[opdNumber].isActive,
      endTime: pendingOTTimers[opdNumber].endTime,
      durationMinutes: pendingOTTimers[opdNumber].durationMinutes
    });
  } else {
    res.json({ success: true, status: 'AVAILABLE', hasTimer: false });
  }
});

// Set static status (HOLIDAY, AWAY, AVAILABLE)
router.post('/opd/:opdNumber/status', async (req, res) => {
  const opdNumber = req.params.opdNumber;
  const { status } = req.body;
  
  staticStatuses[opdNumber] = status;

  if (status === 'AVAILABLE') {
    try {
      const pool = await connectDB();
      await pool.request()
        .input('OPDNumber', sql.NVarChar(50), opdNumber)
        .query(`
          DECLARE @NextPatientID INT;
          SELECT TOP 1 @NextPatientID = PatientID FROM Patients
          WHERE OPDNumber = @OPDNumber AND QueueStatus IN ('WAITING', 'UNHOLD')
          ORDER BY CASE WHEN QueueStatus = 'UNHOLD' THEN 1 ELSE 2 END, IsEmergency DESC, Timestamp ASC;
          IF @NextPatientID IS NOT NULL
            UPDATE Patients SET IsActive = 1 WHERE PatientID = @NextPatientID;
        `);
      req.io.emit('queue_updated', { type: 'STATUS_RESUMED' });
    } catch (e) { console.error("Error auto-resuming queue:", e); }
  } else {
    // HOLIDAY or AWAY - Deactivate current patient to pause queue
    try {
      const pool = await connectDB();
      await pool.request()
        .input('OPDNumber', sql.NVarChar(50), opdNumber)
        .query(`UPDATE Patients SET IsActive = 0 WHERE OPDNumber = @OPDNumber AND IsActive = 1`);
      req.io.emit('queue_updated', { type: 'STATUS_PAUSED' });
    } catch(e) { console.error("Error pausing queue:", e); }
  }
  
  req.io.emit('doctor_status_changed', { opdId: opdNumber, status });
  res.json({ success: true, status });
});

// Manually cancel an OT timer (pending or active)
router.post('/opd/:opdNumber/cancel-ot-timer', async (req, res) => {
  const opdNumber = req.params.opdNumber;
  if (pendingOTTimers[opdNumber]) {
    if (pendingOTTimers[opdNumber].timerId) {
      clearTimeout(pendingOTTimers[opdNumber].timerId);
    }
    const wasActive = pendingOTTimers[opdNumber].isActive;
    delete pendingOTTimers[opdNumber];
    
    req.io.emit('ot_timer_ended', { opdId: opdNumber });
    
    // If it was active, we should promote the next patient now that it's cancelled
    if (wasActive) {
      try {
        const pool = await connectDB();
        await pool.request()
          .input('OPDNumber', sql.NVarChar(50), opdNumber)
          .query(`
            DECLARE @NextPatientID INT;
            SELECT TOP 1 @NextPatientID = PatientID FROM Patients
            WHERE OPDNumber = @OPDNumber AND QueueStatus IN ('WAITING', 'UNHOLD')
            ORDER BY CASE WHEN QueueStatus = 'UNHOLD' THEN 1 ELSE 2 END, IsEmergency DESC, Timestamp ASC;
            IF @NextPatientID IS NOT NULL
              UPDATE Patients SET IsActive = 1 WHERE PatientID = @NextPatientID;
          `);
        req.io.emit('queue_updated', { type: 'TIMER_CANCELLED_RESUMED' });
      } catch (e) { console.error("Error auto-resuming queue after cancel:", e); }
    }
    
    res.json({ success: true, message: 'OT Timer cancelled.' });
  } else {
    res.json({ success: true, message: 'No OT timer to cancel.' });
  }
});

let arDisplayProcess = null;

router.post('/start-ar-display', (req, res) => {
  try {
    if (!arDisplayProcess) {
      // Use absolute path based on user's structure
      const arDisplayPath = path.resolve(__dirname, '../../AR DISPLAY');
      console.log('Starting AR DISPLAY in:', arDisplayPath);
      
      // Execute npm run dev
      arDisplayProcess = exec('npm run dev', { cwd: arDisplayPath });
      
      arDisplayProcess.stdout.on('data', (data) => {
        console.log(`AR DISPLAY stdout: ${data}`);
      });
      
      arDisplayProcess.stderr.on('data', (data) => {
        console.error(`AR DISPLAY stderr: ${data}`);
      });
      
      arDisplayProcess.on('exit', () => {
         arDisplayProcess = null;
      });
    }
    
    // Give it a moment to start the Vite server
    setTimeout(() => {
      res.json({ success: true, url: 'http://localhost:5173' });
    }, 1500);
  } catch (error) {
    console.error('Failed to start AR display', error);
    res.status(500).json({ error: 'Failed to start AR display' });
  }
});

module.exports = router;
