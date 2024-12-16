const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const url = require('url');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
const server = app.listen(3000);
const wss = new WebSocket.WebSocketServer({
    server: server
});

let clients = {};  // Store clients by their usernames
let groups = {};  // Store groups with group name as key and group data as value

// Temporary storing user's username && password
let database_users = [
    { username: 'user1', password: 'pass1' },
    { username: 'user2', password: 'pass2' },
    { username: 'user3', password: 'pass3' }
];

// Function to check if username and password are correct
function checkUserPass(username, password) {
    for (let i = 0; i < database_users.length; i++) {
        if (database_users[i].username === username) {
            return database_users[i].password === password;
        }
    }
    return false;
}

// HTTP login request
app.post('/login', (req, res) => {
    if (!(req.body.username && req.body.password))
        return res.status(400).json({ success: false, message: "Please complete the login form!" });

    let username = req.body.username;
    let password = req.body.password;
    let login_result = checkUserPass(username, password);

    if (login_result) {
        return res.status(201).json({ success: true, message: 'Log in successful!' });
    } else {
        return res.status(500).json({ success: false, message: 'Log in failed!' });
    }
});

wss.on('connection', (ws, req) => {
 
    const username = new URLSearchParams(req.url.substring(1)).get('username');

    if (!username) {
        ws.close(1008, 'Username is required to connect.');
        return;
    }

    if (!users[username]) {
        users[username] = new User(username, {});
    }

    const user = users[username];
    clients[username] = ws;

    console.log(`User ${username} connected.`);

    // Handle incoming messages
    ws.on('message', (message) => {
        message = message.toString(); // Ensure message is a string

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
        }

        // Handle /create-group to create a new group
        else if (message.startsWith('/create-group')) {
            const groupName = message.split(' ')[1];

            if (!groups[groupName]) {
                groups[groupName] = {
                    admin: username,
                    members: [username],
                    messages: []
                };
                ws.send(`Group '${groupName}' created. You are the admin.`);
            } else {
                ws.send(`Group '${groupName}' already exists.`);
            }
        }

        // Handle /join to request joining a group
        else if (message.startsWith('/join')) {
            const groupName = message.split(' ')[1];

            if (groups[groupName]) {
                // Notify the admin of the request to join
                const admin = groups[groupName].admin;
                clients[admin].send(`${username} wants to join the group '${groupName}'. Use /add-member <username> to add them.`);
                ws.send(`Your request to join '${groupName}' has been sent to the admin.`);
            } else {
                ws.send(`Group '${groupName}' does not exist.`);
            }
        }

        // Handle /add-member to add a user to a group (only admin)
        else if (message.startsWith('/add-member')) {
            const groupName = message.split(' ')[1];
            const newUser = message.split(' ')[2];

            if (groups[groupName] && groups[groupName].admin === username) {
                if (clients[newUser]) {
                    groups[groupName].members.push(newUser);
                    clients[newUser].send(`${username} has added you to the group '${groupName}'.`);
                    ws.send(`You have added ${newUser} to '${groupName}'.`);
                } else {
                    ws.send(`User ${newUser} is not connected.`);
                }
            } else {
                ws.send('You do not have permission to add members to this group.');
            }
        }

        // Handle /remove-member to remove a user from a group (only admin)
        else if (message.startsWith('/remove-member')) {
            const groupName = message.split(' ')[1];
            const userToRemove = message.split(' ')[2];

            if (groups[groupName] && groups[groupName].admin === username) {
                const index = groups[groupName].members.indexOf(userToRemove);
                if (index !== -1) {
                    groups[groupName].members.splice(index, 1);
                    clients[userToRemove].send(`You have been removed from the group '${groupName}'.`);
                    ws.send(`You have removed ${userToRemove} from '${groupName}'.`);
                } else {
                    ws.send(`${userToRemove} is not a member of the group.`);
                }
            } else {
                ws.send('You do not have permission to remove members from this group.');
            }
        }

        // Handle group messages, only send to group members
        else if (message.startsWith('/group-message')) {
            const parts = message.split(' ');
            const groupName = parts[1];
            const groupMessage = parts.slice(2).join(' ');

            if (groups[groupName] && groups[groupName].members.includes(username)) {
                groups[groupName].messages.push({ sender: username, message: groupMessage });
                groups[groupName].members.forEach(member => {
                    clients[member].send(`[Group ${groupName}] ${username}: ${groupMessage}`);
                });
            } else {
                ws.send(`You are not a member of the group '${groupName}'.`);
            }
        }

        else {
            ws.send('Unknown command.');
        }
    });

    ws.on('close', () => {
        delete clients[username]; // Remove client when they disconnect
        // Also remove client from any group they were part of
        for (let groupName in groups) {
            const group = groups[groupName];
            const index = group.members.indexOf(username);
            if (index !== -1) {
                group.members.splice(index, 1);
            }
        }
    });
});

console.log('Server started on ws://localhost:5000');
