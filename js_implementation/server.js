const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 5000 });

let clients = {};  // Store clients by their usernames

// Helper function to generate a unique 8-digit username
function generateUsername() {
    let username;
    do {
        // Generate a random 8-digit number as a string
        username = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
    } while (clients[username]);  // Ensure the username is unique
    return username;
}

wss.on('connection', (ws) => {
    let username = generateUsername();  // Assign a unique 8-digit username to the client
    clients[username] = ws;  // Store client with the generated username

    // Notify the client of their unique username
    ws.send(`Welcome! Your unique username is ${username}. You can now send direct messages using /dm <username> <message>.`);

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
