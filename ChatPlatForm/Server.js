const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const User = require('./User');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2');

// Create a connection to the database
const db = mysql.createConnection({
    host: 'localhost', // The host of your MySQL server
    user: 'root', // Your MySQL username (usually 'root' for local development)
    password: '', // Your MySQL password
    database: 'chat_app' // The name of your database (make sure it's 'chat_app' as created earlier)
});

// Connect to MySQL
db.connect((err) => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('Connected to the MySQL database');
});

// Initialize Express app
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(bodyParser.json());

// Serve static files (your frontend)
app.use(express.static(path.join(__dirname, 'public')));

const server = app.listen(3000, () => {
    console.log('Server started on http://localhost:3000');
});

// Create WebSocket server
const wss = new WebSocket.Server({ server: server });

let users = {};
let clients = {}; // Store WebSocket connections by username



// Handle WebSocket connections
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

    ws.send(JSON.stringify({ sender: 'Server', message: `Welcome, ${username}!` }));
    db.query(`SELECT ch.message, ch.timestamp, ch.sender_id, u.username AS sender_name, ch.receiver_id FROM chat_history ch JOIN users u ON ch.sender_id = u.id WHERE ch.sender_id = (SELECT id FROM users WHERE username = ?) OR ch.receiver_id = (SELECT id FROM users WHERE username = ?) ORDER BY ch.timestamp ASC;`, [username, username], (err, results) => {
        if (err) {
            console.error('Error fetching chat history:', err);
            return;
        }

        ws.send(JSON.stringify({
            sender: 'Server',
            message: 'Here is your chat history:',
            chatHistory: results
        }));
    });

    // Fetch friends list from the database
    db.query(
        `SELECT u.username FROM users u WHERE u.id IN (
            SELECT f.friend_id FROM friends f WHERE f.user_id = (SELECT id FROM users WHERE username = ?)
        );`,
        [username],
        (err, friendResults) => {
            if (err) {
                console.error('Error fetching friends:', err);
                return;
            }

            // Extract usernames and ensure the result is an array
            const friends = Array.isArray(friendResults)
                ? friendResults.map(friend => friend.username)
                : [];

            if (!Array.isArray(friends)) {
                console.error('Friends list is not an array!!!!', friends); // Log the incorrect format
                process.stdout.write('This is an alternative to console.logdfdfdsdfas\n');
            } else {
                console.log('Processed friends array:', friends); // Log the valid array
                process.stdout.write('This is an alternative to console.log\n');
            }

            // Update the User instance with friends data
            if (!users[username]) {
                users[username] = new User(username, {}); // Ensure the User instance exists
            }
            users[username].friends = friends; // Assign the friends list

            // Send the friends list to the connected client
            ws.send(
                JSON.stringify({
                    sender: 'Server',
                    message: 'Here is your friends list:',
                    friends: friends, // Send the processed array
                })
            );
        }
    );


    // Handle incoming messages
    ws.on('message', (data) => {
        try {
            const parsedData = JSON.parse(data);
            const { action, recipient, message, friendUsername } = parsedData;

            if (action === 'sendMessage') {
                if (user.friends.includes(recipient)) {
                    if (clients[recipient] && clients[recipient].readyState === WebSocket.OPEN) {
                        clients[recipient].send(JSON.stringify({ sender: username, message }));

                        // Save the chat history in the database
                        db.query(
                            'INSERT INTO chat_history (sender_id, receiver_id, message) SELECT (SELECT id FROM users WHERE username = ?), (SELECT id FROM users WHERE username = ?), ?',
                            [username, recipient, message],
                            (err) => {
                                if (err) {
                                    console.error('Error saving chat history:', err);
                                }
                            }
                        );
                    } else {
                        ws.send(JSON.stringify({
                            sender: 'Server',
                            message: `User ${recipient} is not online.`,
                        }));
                    }
                } else {
                    ws.send(JSON.stringify({
                        sender: 'Server',
                        message: `You can only message your friends.`,
                    }));
                }
            } else if (action === 'addFriend') {
                    // Ensure the friend exists
                    db.query('SELECT * FROM users WHERE username = ?', [friendUsername], (err, friendResults) => {
                        if (err) {
                            return ws.send(JSON.stringify({ sender: 'Server', message: 'Database error' }));
                        }

                        if (friendResults.length === 0) {
                            return ws.send(JSON.stringify({
                                sender: 'Server',
                                message: `User ${friendUsername} does not exist.`
                            }));
                        }
                        if (!users[friendUsername]) {
                            users[friendUsername] = new User(friendUsername, []);  // Initialize with an empty friends array
                        }
                        // Add the friend to both users' friend lists
                        db.query(
                           'INSERT INTO friends (user_id, friend_id) SELECT (SELECT id FROM users WHERE username = ?), (SELECT id FROM users WHERE username = ?);',
                            [friendUsername, username],
                            (err) => {
                                if (err) {
                                    return ws.send(JSON.stringify({ sender: 'Server', message: 'Error adding friend' }));
                                }
                            }
                        );

                        db.query(
                            'INSERT INTO friends (user_id, friend_id) SELECT (SELECT id FROM users WHERE username = ?), (SELECT id FROM users WHERE username = ?);',
                            [username, friendUsername],
                            (err) => {
                                if (err) {
                                    return ws.send(JSON.stringify({ sender: 'Server', message: 'Error adding friend' }));
                                }
                            }
                        );

                        user.friends.push(friendUsername);
                        users[friendUsername].friends.push(username);

                        // Send the updated friends list to both users
                        const updatedFriendsList = user.friends;

                        // Send the updated friend list to the user who added the friend
                        ws.send(JSON.stringify({
                            sender: 'Server',
                            message: `${friendUsername} added as a friend.`,
                            friends: updatedFriendsList
                        }));

                        // Send the updated friend list to the friend who was added
                        if (clients[friendUsername]) {
                            clients[friendUsername].send(JSON.stringify({
                                sender: 'Server',
                                message: `${username} added you as a friend.`,
                                friends: users[friendUsername].friends
                            }));
                        }
                    });
}

        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    // Handle user disconnect
    ws.on('close', () => {
        delete clients[username];
        console.log(`User ${username} disconnected.`);
    });
});


// Simplified registration endpoint with MySQL
app.post('/register', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Please complete the registration form!' });
    }

    // Check if the username already exists
    db.query('SELECT * FROM users WHERE username = ?', [username], (err, results) => {
        if (err) {
            console.error('Error checking username:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }

        if (results.length > 0) {
            return res.status(400).json({ success: false, message: 'Username already exists.' });
        }

        // Hash the password before saving it
        bcrypt.hash(password, 10, (err, hashedPassword) => {
            if (err) {
                console.error('Error hashing password:', err);
                return res.status(500).json({ success: false, message: 'Error hashing password' });
            }

            // Insert the new user into the database
            db.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], (err) => {
                if (err) {
                    console.error('Error inserting user:', err);
                    return res.status(500).json({ success: false, message: 'Error inserting user into the database' });
                }

                res.status(201).json({ success: true, message: 'Registration successful!' });
            });
        });
    });
});


// Simplified login endpoint with MySQL
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Authenticate user (this is just an example, you should use proper authentication)
    db.query('SELECT * FROM users WHERE username = ?', [username], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }

        if (results.length === 0 || !bcrypt.compareSync(password, results[0].password)) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        res.status(200).json({ success: true, message: 'Login successful!' });
    });
});
