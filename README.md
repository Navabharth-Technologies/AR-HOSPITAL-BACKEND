# **AR Hospital - Backend Services**

Welcome to the **AR Hospital Backend Services**, a centralized healthcare operations engine designed to power intelligent queue management, AI-driven patient announcements, digital signage, and real-time OPD coordination.


The backend consists of multiple integrated modules:

<h4>🏥 Queue Management:</h4> Handles patient token generation, queue progression, and OPD allocation.

<h4>🔊 AI Announcement Engine:</h4> Automates patient calling, token announcements, and queue updates.

<h4>📺 Digital Signage Services:</h4> Manages display panel data, video playlists, and live queue visualization.

<h4>⚙️ Real-Time Services:</h4> Provides instant synchronization across all connected devices and screens.


### 📂 Project Structure

| Component           | Path             | Technology           | Description                                                  |
| ------------------- | ---------------- | -------------------- | ------------------------------------------------------------ |
| API Server          | ./src            | Node.js / Express.js | Central REST APIs for queue, media, users, and announcements |
| Real-Time Engine    | ./socket         | Socket.io            | Live queue updates and display synchronization               |
| Database Layer      | ./database       | Microsoft SQL Server | Queue, patient, media, and analytics storage                 |
| Media Services      | ./services/media | Azure Blob Storage   | Video upload, deletion, and playlist management              |
| Announcement Engine | ./services/voice | Node.js Services     | AI voice announcement generation and queue broadcasting      |


### ✨ Core Features

### 🏥 Queue Management

<h5>Live Queue Operations</h5>

* Patient token generation
* Multi-OPD queue management
* Call next patient
* Recall patient
* Skip patient
* Consultation completion tracking

<h5>PDF Queue Import</h5>

* Upload patient data through PDF
* Automatic OPD-wise segregation
* Instant queue generation
* Real-time synchronization

### 🔊 AI Announcement Services

<h5<Automated Voice Announcements </h5>

* Token number announcements
* Patient name announcements
* OPD destination announcements
* Next patient queue notifications

<h5>Smart Audio Controls</h5>

* Dynamic announcement generation
* Queue-triggered announcements
* Real-time voice synchronization
* Multilingual support readiness

### 📺 Digital Signage Services

<h5>Display Panel Management</h5>

* Current token display
* Next token display
* Multi-OPD display support
* Real-time queue updates

<h5>Media Management</h5>

* Video upload
* Video deletion
* Playlist management
* Continuous loop playback
* Azure Blob Storage integration

### 📊 Analytics & Monitoring

<h5>Operational Insights</h5>

* Daily patient statistics
* Queue performance metrics
* OPD utilization reports
* Announcement activity logs
* System monitoring


### 🚀 Getting Started

<h6>Prerequisites</h6>

* Node.js (LTS Version)
* Microsoft SQL Server
* Android Studio

<h5>Production Start Command</h5>
```
npm install
npm start
```
<h5>Development Mode</h5>
```
npm install
npm run dev
```

## 🤝 Contribution & Maintenance

This project is maintained by the **Navabharath Technologies Development Team**. For support or feedback, please contact the repository administrator.


<br> © 2026 Navabharath Technologies. All Rights Reserved.
