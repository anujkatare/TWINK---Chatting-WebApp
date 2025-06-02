const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// In-memory storage for users (temporary)
const users = new Map();

// Serve static files from the public directory
app.use(express.static('public'));

// Handle socket connections
io.on('connection', (socket) => {
    console.log('A user connected with socket ID:', socket.id);

    // Handle signup
    socket.on('signup', (data, callback) => {
        console.log('Signup attempt received:', { mobile: data.mobile, name: data.name });
        
        try {
            // Validate input data
            if (!data.name || !data.mobile || !data.password) {
                console.log('Validation failed: Missing fields');
                socket.emit('signup error', 'All fields are required');
                if (callback) callback({ status: 'error', message: 'All fields are required' });
                return;
            }

            // Validate mobile number format
            if (!/^[0-9]{10}$/.test(data.mobile)) {
                console.log('Validation failed: Invalid mobile format');
                socket.emit('signup error', 'Please enter a valid 10-digit mobile number');
                if (callback) callback({ status: 'error', message: 'Invalid mobile number format' });
                return;
            }

            // Check if mobile number already exists
            if (users.has(data.mobile)) {
                console.log('Signup failed: Mobile number already exists');
                socket.emit('signup error', 'Mobile number already registered');
                if (callback) callback({ status: 'error', message: 'Mobile number already registered' });
                return;
            }

            // Store user data
            users.set(data.mobile, {
                name: data.name,
                mobile: data.mobile,
                password: data.password // In real app, this should be hashed
            });

            console.log('New user created successfully:', data.mobile);
            socket.emit('signup success');
            if (callback) callback({ status: 'success' });
        } catch (error) {
            console.error('Signup error details:', error);
            socket.emit('signup error', 'An error occurred during signup. Please try again.');
            if (callback) callback({ status: 'error', message: 'Server error during signup' });
        }
    });

    // Handle login
    socket.on('login', (data, callback) => {
        console.log('Login attempt received:', { mobile: data.mobile });
        
        try {
            if (!data.mobile || !data.password) {
                socket.emit('login error', 'Mobile number and password are required');
                if (callback) callback({ status: 'error', message: 'Mobile number and password are required' });
                return;
            }

            const user = users.get(data.mobile);
            if (!user || user.password !== data.password) {
                socket.emit('login error', 'Invalid mobile number or password');
                if (callback) callback({ status: 'error', message: 'Invalid credentials' });
                return;
            }

            // Store user data in socket
            socket.user = {
                id: data.mobile, // Using mobile as ID temporarily
                name: user.name,
                mobile: user.mobile
            };

            socket.emit('login success', socket.user);
            io.emit('user joined', { username: user.name });
            if (callback) callback({ status: 'success' });
        } catch (error) {
            console.error('Login error:', error);
            socket.emit('login error', 'An error occurred during login');
            if (callback) callback({ status: 'error', message: 'Server error during login' });
        }
    });

    // Handle chat messages
    socket.on('chat message', (data) => {
        if (socket.user) {
            console.log('Received message:', {
                content: data.content,
                media: data.media ? 'Media present' : 'No media',
                userId: socket.user.id,
                username: socket.user.name
            });

            // Broadcast the message to all connected clients
            io.emit('chat message', {
                content: data.content,
                media: data.media,
                userId: socket.user.id,
                username: socket.user.name,
                timestamp: new Date()
            });
        }
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
        if (socket.user) {
            io.emit('user left', { username: socket.user.name });
        }
        console.log('User disconnected:', socket.id, 'Reason:', reason);
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 