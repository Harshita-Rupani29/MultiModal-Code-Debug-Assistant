// socketSetup.js
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const DebugSession = require('./models/debugSession'); 
const User = require('./models/user'); 

/**
 
 * @param {string} userId - The ID of the authenticated user.
 * @param {string} sessionId - The ID of the debug session to join.
 * @returns {Promise<boolean>} - True if the user can join, false otherwise.
 */
const canUserJoinDebugSession = async (userId, sessionId) => {
    if (!userId) {
        return false;
    }

    try {
        const session = await DebugSession.findById(sessionId);

        if (!session) {
            console.log(`Debug Session ${sessionId} not found.`);
            return false;
        }

        if (session.user_id === userId) {
            return true;
        }


        console.log(`User ${userId} is not authorized for session ${sessionId}. Session owner: ${session.user_id}`);
        return false; 
    } catch (err) {
        console.error("Error checking debug session authorization:", err);
        return false;
    }
};

/**
 * Sets up and configures the Socket.IO server.
 * @param {http.Server} server - The HTTP server instance to attach Socket.IO to.
 */
module.exports.setupSocket = (server) => {
    const io = new Server(server, {
        cors: {
            origin: process.env.CLIENT_URL || "http://localhost:3000",
            methods: ["GET", "POST", "PUT", "DELETE"],
            credentials: true, 
        }
    });

    io.use(async (socket, next) => {
        const token = socket.handshake.auth.token; 

        if (!token) {
            socket.isAuthenticated = false;
            socket.userId = null;
            socket.userHandle = 'Guest'; 
            console.log(`Socket connection: Unauthenticated connection ${socket.id}`);
            return next();
        }

        try {
            const decodedToken = jwt.verify(token, process.env.JWT_KEY);

            socket.isAuthenticated = true;
            socket.userId = decodedToken.userId; 
            if (user) {
                socket.userHandle = user.first_name || user.email; 
            } else {
                socket.userHandle = `User-${socket.userId}`;
            }

            console.log(`Socket connection: Authenticated ${socket.id} for User ID: ${socket.userId}`);
            next();
        } catch (err) {
            console.error(`Socket authentication failed for ${socket.id}: ${err.message}`);
            
            socket.isAuthenticated = false;
            socket.userId = null;
            socket.userHandle = 'Guest';
            return next(new Error("Authentication failed: Invalid token."));
        }
    });

    io.on('connection', (socket) => {
        const { userId, userHandle, isAuthenticated } = socket;
        console.log(`User ${userHandle} (${userId || 'Unauthenticated'}) connected with socket ID: ${socket.id}`);

        let currentSessionId = null; 

        socket.emit('connected', { socketId: socket.id, userId, userHandle, isAuthenticated });

        socket.on('joinSession', async (sessionId) => {
            if (!isAuthenticated) {
                socket.emit('authError', { message: 'You must be logged in to join a session.' });
                return;
            }

            const isAuthorized = await canUserJoinDebugSession(userId, sessionId);

            if (isAuthorized) {
                if (currentSessionId && currentSessionId !== sessionId) {
                    socket.leave(currentSessionId);
                    console.log(`User ${userHandle} left previous session room: ${currentSessionId}`);
                  
                    io.to(currentSessionId).emit('userLeftSession', { userId, userHandle, socketId: socket.id });
                }

                socket.join(sessionId);
                currentSessionId = sessionId; 
                console.log(`User ${userHandle} joined session room: ${sessionId}`);
                
                io.to(sessionId).emit('userJoinedSession', { userId, userHandle, socketId: socket.id, message: `${userHandle} has joined the session.` });


            } else {
                console.log(`User ${userHandle} (ID: ${userId}) unauthorized to join session: ${sessionId}`);
                socket.emit('authError', { message: 'Unauthorized to join this session.' });
            }
        });

        // Event: Leave a debug session room
        socket.on('leaveSession', (sessionId) => {
            if (currentSessionId === sessionId) {
                socket.leave(sessionId);
                currentSessionId = null; 
                console.log(`User ${userHandle} left session room: ${sessionId}`);
              
                io.to(sessionId).emit('userLeftSession', { userId, userHandle, socketId: socket.id });
            } else {
                console.warn(`User ${userHandle} tried to leave session ${sessionId} but was not in it or it's not their current session.`);
            }
        });

        // Event: Handle code changes for live sharing
        socket.on('codeChange', ({ sessionId, codeContent, language }) => {
            if (!isAuthenticated || currentSessionId !== sessionId) {
                console.warn(`Attempted unauthorized/out-of-room code change by ${userHandle} for ${sessionId}.`);
                return;
            }
            // Broadcast the code change to all other clients in the same session room
            socket.to(sessionId).emit('codeUpdate', { codeContent, language, userId, userHandle });
        });

        // Event: Handle cursor movements for synchronized cursors
        socket.on('cursorActivity', ({ sessionId, cursorPosition }) => {
            if (!isAuthenticated || currentSessionId !== sessionId) {
                return;
            }
            // Broadcast cursor activity to all other clients in the same session room
            socket.to(sessionId).emit('cursorUpdate', { cursorPosition, userId, userHandle });
        });

        socket.on('selectionChange', ({ sessionId, selection }) => {
            if (!isAuthenticated || currentSessionId !== sessionId) {
                return;
            }
            socket.to(sessionId).emit('selectionUpdate', { selection, userId, userHandle });
        });

        // General disconnection handler
        socket.on('disconnect', () => {
            console.log(`User ${userHandle} (${userId || 'Unauthenticated'}) disconnected with socket ID: ${socket.id}`);
            // If the user was in a session, notify others they left
            if (currentSessionId) {
                io.to(currentSessionId).emit('userLeftSession', { userId, userHandle, socketId: socket.id });
            }
        });
    });
};