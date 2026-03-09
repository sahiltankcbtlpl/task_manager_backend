const express = require('express');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const connectDB = require('./src/config/db');

// Load env vars
dotenv.config();

// Connect to database
connectDB().then(() => {
    // Seed Super Admin
    const seedSuperAdmin = require('./src/seed/superAdmin');
    seedSuperAdmin();
});

const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: true, // Allow all origins (or specify your frontend URL)
        methods: ['GET', 'POST'],
        credentials: true
    }
});

io.on('connection', (socket) => {
    // console.log('New client connected:', socket.id); // Valid connection log

    socket.on('disconnect', () => {
        // console.log('Client disconnected:', socket.id);
    });
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({
    origin: true, // Allow all origins (or specify your frontend URL)
    credentials: true
}));

// Serve uploaded files
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const permissionRoutes = require('./src/routes/permissionRoutes');
const roleRoutes = require('./src/routes/roleRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/taskStatus', require('./src/routes/taskStatusRoutes'));
app.use('/api/tasks', require('./src/routes/taskRoutes'));
app.use('/api/projects', require('./src/routes/projectRoutes'));
app.use('/api/documents', require('./src/routes/documentRoutes'));

// Basic route
app.get('/', (req, res) => {
    res.send('API is running...');
});

// Error handling middleware (placeholder)
app.use((err, req, res, next) => {
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    res.status(statusCode);
    res.json({
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
