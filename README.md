# 📋 Task Manager — Backend

A robust **Node.js + Express.js** REST API with **Socket.IO** real-time support, **MongoDB** database, JWT authentication, role-based access control, and email notifications.

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| Node.js | Runtime environment |
| Express.js v5 | Web framework |
| MongoDB + Mongoose | Database & ODM |
| Socket.IO | Real-time communication |
| JWT (jsonwebtoken) | Authentication |
| bcryptjs | Password hashing |
| Nodemailer | Email notifications |
| Multer | File uploads |
| dotenv | Environment variables |
| Nodemon | Development hot-reload |

---

## 📁 Project Structure

```
backend/
├── server.js               # Entry point — Express + Socket.IO setup
├── package.json
├── .env                    # Environment variables (not committed)
├── .gitignore
├── uploads/                # Uploaded files (not committed)
├── public/                 # Public static assets
└── src/
    ├── config/             # Database connection
    ├── controllers/        # Route handler logic
    ├── middlewares/        # Auth, role, error middlewares
    ├── models/             # Mongoose models
    ├── routes/             # API route definitions
    ├── seed/               # Database seeders (superAdmin, permissions)
    ├── services/           # Business logic / email services
    └── utils/              # Helper utilities
```

---

## ⚙️ Prerequisites

Make sure you have the following installed on your machine:

- **Node.js** v18 or higher → [Download](https://nodejs.org/)
- **MongoDB** (local) or a **MongoDB Atlas** connection string
- **npm** (comes with Node.js)
- **Git**

---

## 🚀 Setup & Installation

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd Task_manager/backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Create the `.env` File

Create a `.env` file in the `backend/` root directory:

```bash
# Copy the example below and fill in your values
```

```env
# Server
PORT=5000
NODE_ENV=development

# MongoDB
MONGO_URI=mongodb://127.0.0.1:27017/databasename

# JWT
JWT_SECRET=your_super_secret_jwt_key_here

# Email Configuration (Gmail)
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_gmail_app_password
EMAIL_FROM=your_email@gmail.com
EMAIL_FROM_NAME=Task Manager App

# Super Admin Credentials (auto-seeded on first run)
SUPER_ADMIN_EMAIL=admin@example.com
SUPER_ADMIN_PASSWORD=YourStrongPassword@123

# Frontend URL (used for CORS and email redirect links)
FRONTEND_URL=http://localhost:5173
```

> **⚠️ Important:**
> - For `EMAIL_PASS`, use a **Gmail App Password**, not your regular password.
> - To generate a Gmail App Password: Google Account → Security → 2-Step Verification → App Passwords.
> - Never commit your `.env` file to GitHub. It is already listed in `.gitignore`.

---

### 4. Start MongoDB

If you are using **local MongoDB**, make sure it is running:

```bash
# On Windows
net start MongoDB

# Or using mongosh to verify
mongosh
```

If you are using **MongoDB Atlas**, paste your connection string as `MONGO_URI` in the `.env` file.

---

### 5. Seed Permissions (Optional but Recommended)

Run this **once** to populate the database with default permissions:

```bash
node src/seed/permissions.js
```

> The **Super Admin** is seeded automatically on the first server start — no manual step needed.

---

### 6. Run the Development Server

```bash
npm run dev
```

The server will start at: **http://localhost:5000**

You should see:
```
MongoDB Connected
Server running in development mode on port 5000
```

---

### 7. Run in Production

```bash
npm start
```

---

## 🔌 API Endpoints Overview

| Prefix | Description |
|---|---|
| `POST /api/auth` | Login, Register, Logout, Password Reset |
| `GET/POST/PUT/DELETE /api/users` | User management |
| `GET/POST/PUT/DELETE /api/roles` | Role management |
| `GET/POST/PUT/DELETE /api/permissions` | Permission management |
| `GET/POST/PUT/DELETE /api/tasks` | Task management |
| `GET/POST/PUT/DELETE /api/taskStatus` | Task status management |
| `GET/POST/PUT/DELETE /api/projects` | Project management |
| `GET/POST/PUT/DELETE /api/documents` | Document management |
| `GET/POST/PUT/DELETE /api/documentPages` | Document pages |
| `GET/POST/PUT/DELETE /api/companies` | Company management |
| `GET/POST/PUT/DELETE /api/subscriptions` | Subscription management |
| `GET/POST/PUT/DELETE /api/modules` | Module management |
| `GET /uploads/:filename` | Serve uploaded files |

---

## 📜 Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server with hot-reload (nodemon) |
| `npm start` | Start production server |
| `node src/seed/permissions.js` | Seed default permissions into the database |

---

## 🌐 Real-Time (Socket.IO)

The backend uses **Socket.IO** for real-time features. The Socket.IO server runs on the same port as the HTTP server (`5000`). The frontend connects using `socket.io-client`.

---

## 🔒 Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `PORT` | ✅ | Port the server runs on (default: 5000) |
| `MONGO_URI` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ | Secret key for signing JWT tokens |
| `NODE_ENV` | ✅ | `development` or `production` |
| `EMAIL_SERVICE` | ✅ | Email service (e.g., `gmail`) |
| `EMAIL_USER` | ✅ | Sender email address |
| `EMAIL_PASS` | ✅ | Gmail App Password |
| `EMAIL_FROM` | ✅ | From email address |
| `EMAIL_FROM_NAME` | ✅ | Display name for emails |
| `SUPER_ADMIN_EMAIL` | ✅ | Super admin email (auto-seeded) |
| `SUPER_ADMIN_PASSWORD` | ✅ | Super admin password (auto-seeded) |
| `FRONTEND_URL` | ✅ | Frontend URL for CORS & email links |

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **ISC License**.
