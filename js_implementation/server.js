const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const url = require('url');

// const WebSocket = require('ws');
// const wss = new WebSocket.Server({ port: 5000 });

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
const server = app.listen(5000);
const wss = new WebSocket.WebSocketServer({
    server: server
});


let clients = {};  // Store clients by their usernames

// Temporary storing user's username && password
let database_users = [
    {
        username: 'user1',
        password: 'pass1'
    },
    {
        username: 'user2',
        password: 'pass2'
    },
    {
        username: 'user3',
        password: 'pass3'
    }
];

// Helper function to generate a unique 8-digit username
function generateUsername() {
    let username;
    do {
        // Generate a random 8-digit number as a string
        username = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
    } while (clients[username]);  // Ensure the username is unique
    return username;
}

// Function to check if username and password given correctly in the database
function checkUserPass(username, password) {
    for (let i = 0; i < database_users.length; i++) {
        if (database_users[i].username === username) {
            if (database_users[i].password === password) {
                return true;
            } else {
                return false;
            }
        }
    };

    return false
}

// HTTP login request
app.post('/login', (req, res) => {
    // Validate If input existed
    if (!(
        req.body.username &&
        req.body.password
    ))
        return res.status(400).json({ success: false, message: "Pleases complete the login form!" });

    // Find user in database
    let username = req.body.username;
    let password = req.body.password;
    let login_result = checkUserPass(username, password);

    // Return login result
    if (login_result) {
        return res.status(201).json({ success: true, message: 'Log in successful!' });
    } else {
        return res.status(500).json({ success: false, message: 'Log in fails!' });
    }
});

wss.on('connection', (ws, req) => {
    /*
    let username = generateUsername();  // Assign a unique 8-digit username to the client
    clients[username] = ws;  // Store client with the generated username

    // Notify the client of their unique username
    ws.send(`Welcome! Your unique username is ${username}. You can now send direct messages using /dm <username> <message>.`);
    */

    let username = (url.parse(req.url, true).query).username; // Get username from request link
    clients[username] = ws;  // Store client with the generated username

    // Notify the client with their username
    ws.send(`Welcome, ${username}! You can now send direct messages using /dm <username> <message>.`);

    // When a message is received
    ws.on('message', (message) => {
        message = message.toString();  // Ensure message is a string

        console.log(`Received message from ${username}: ${message}`);

        // Handle /dm command for direct messaging
        if (message.startsWith('/dm')) {
            const parts = message.split(' ');
            const targetUser = parts[1]; // The recipient's username
            const dmMessage = parts.slice(2).join(' '); // The message content

            if (clients[targetUser]) {
                // Send the message to the specific client
                clients[targetUser].send(`${username}: ${dmMessage}`);
                ws.send(`You sent a DM to ${targetUser}: ${dmMessage}`);
            } else {
                ws.send(`User ${targetUser} is not connected.`);
            }
        } else if (message.startsWith('/all')) {
            // Send message to all connected clients
            wss.clients.forEach(client => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(`${username}: ${message.substring(5)}`);
                }
            });
        } else {
            // Broadcast to all clients if it's a regular message
            wss.clients.forEach(client => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(`${username}: ${message}`);
                }
            });
        }
    });

    ws.on('close', () => {
        delete clients[username];  // Remove client when they disconnect
    });
});

console.log('Server started on ws://localhost:5000');
