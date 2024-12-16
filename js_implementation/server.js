const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 5000 });

let clients = {};  // Store clients by their usernames
let groups = {};  // Store groups with group name as key and group data as value

// Helper function to generate a unique 8-digit username
function generateUsername() {
    let username;
    do {
        username = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
    } while (clients[username]);
    return username;
}

wss.on('connection', (ws) => {
    let username = generateUsername();  // Assign a unique 8-digit username to the client
    clients[username] = { ws, groups: [] };  // Store client with the generated username and group memberships

    // Notify the client of their unique username
    ws.send(`Welcome! Your unique username is ${username}. You can now send direct messages using /dm <username> <message>.`);

    // Handle incoming messages
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
                clients[targetUser].ws.send(`${username}: ${dmMessage}`);
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
                clients[admin].ws.send(`${username} wants to join the group '${groupName}'. Use /add-member <username> to add them.`);
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
                    clients[newUser].ws.send(`${username} has added you to the group '${groupName}'.`);
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
                    clients[userToRemove].ws.send(`You have been removed from the group '${groupName}'.`);
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
                    clients[member].ws.send(`[Group ${groupName}] ${username}: ${groupMessage}`);
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
        delete clients[username];  // Remove client when they disconnect
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
