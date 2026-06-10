**AR Hospital - Backend Services**

Welcome to the **AR Hospital Backend Services**, a centralized healthcare operations engine designed to power intelligent queue management, AI-driven patient announcements, digital signage, and real-time OPD coordination.


The backend consists of multiple integrated modules:

🏥 Queue Management: Handles patient token generation, queue progression, and OPD allocation.

🔊 AI Announcement Engine: Automates patient calling, token announcements, and queue updates.

📺 Digital Signage Services: Manages display panel data, video playlists, and live queue visualization.

⚙️ Real-Time Services: Provides instant synchronization across all connected devices and screens.


📂 **Project Structure**

| Component           | Path             | Technology           | Description                                                  |
| ------------------- | ---------------- | -------------------- | ------------------------------------------------------------ |
| API Server          | ./src            | Node.js / Express.js | Central REST APIs for queue, media, users, and announcements |
| Real-Time Engine    | ./socket         | Socket.io            | Live queue updates and display synchronization               |
| Database Layer      | ./database       | Microsoft SQL Server | Queue, patient, media, and analytics storage                 |
| Media Services      | ./services/media | Azure Blob Storage   | Video upload, deletion, and playlist management              |
| Announcement Engine | ./services/voice | Node.js Services     | AI voice announcement generation and queue broadcasting      |


✨ **Core Features**

🏥 **Queue Management**

**Live Queue Operations**

* Patient token generation
* Multi-OPD queue management
* Call next patient
* Recall patient
* Skip patient
* Consultation completion tracking

**PDF Queue Import**

* Upload patient data through PDF
* Automatic OPD-wise segregation
* Instant queue generation
* Real-time synchronization

🔊 **AI Announcement Services**

Automated Voice Announcements

* Token number announcements
* Patient name announcements
* OPD destination announcements
* Next patient queue notifications

**Smart Audio Controls**

* Dynamic announcement generation
* Queue-triggered announcements
* Real-time voice synchronization
* Multilingual support readiness

📺 **Digital Signage Services**

**Display Panel Management**

* Current token display
* Next token display
* Multi-OPD display support
* Real-time queue updates

Media Management

* Video upload
* Video deletion
* Playlist management
* Continuous loop playback
* Azure Blob Storage integration

📊 **Analytics & Monitoring**

**Operational Insights**

* Daily patient statistics
* Queue performance metrics
* OPD utilization reports
* Announcement activity logs
* System monitoring


🚀 **Getting Started**

Prerequisites

* Node.js (LTS Version)
* Microsoft SQL Server
* Android Studio

**Production Start Command**
```
npm install
npm start
```
**Development Mode**
```
npm install
npm run dev
```

🤝 **Contribution & Maintenance**

This project is maintained by the **Navabharath Technologies Development Team(TokensBoy)**. For support or feedback, please contact the repository administrator.


© 2026 Tokensboy. All Rights Reserved.
