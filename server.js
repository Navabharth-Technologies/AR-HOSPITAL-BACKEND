require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const apiRoutes = require('./routes/api');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Attach io to req so routes can emit events
app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use('/api', apiRoutes);

const videosPath = path.join(__dirname, '../AR DISPLAY/Videos');
app.use('/videos', express.static(videosPath));

app.get('/api/videos', (req, res) => {
  try {
    if (!fs.existsSync(videosPath)) {
      return res.json({ success: true, videos: [] });
    }
    const files = fs.readdirSync(videosPath);
    const videos = files.filter(f => {
      const ext = path.extname(f).toLowerCase();
      return ['.mp4', '.mov', '.mkv', '.webm'].includes(ext);
    });
    res.json({ success: true, videos });
  } catch (error) {
    console.error("Error reading videos directory:", error);
    res.json({ success: false, videos: [] });
  }
});

app.get('/', (req, res) => {
  res.send('AR Hospital Backend is Running.');
});

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  
  socket.on('join_opd', (opdId) => {
    socket.join(`opd_${opdId}`);
    console.log(`Socket ${socket.id} joined opd_${opdId}`);
  });

  socket.on('leave_opd', (opdId) => {
    socket.leave(`opd_${opdId}`);
    console.log(`Socket ${socket.id} left opd_${opdId}`);
  });

  socket.on('doctor_status_changed', (data) => {
    // Broadcast to all clients (or specifically to the room)
    // We broadcast globally so Receptionist could potentially see it too, 
    // or other OPD dashboards can sync.
    io.emit('doctor_status_changed', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
