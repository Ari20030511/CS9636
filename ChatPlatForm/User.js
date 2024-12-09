class User {
    constructor(username, clients) {
        this.username = username;
        this.clients = clients;
        this.friends = [];
        this.groups = [];
    }

    send(message, recipient) {
        if (this.friends.includes(recipient)) {
            if (this.clients[recipient]) {
                this.clients[recipient].send(`${this.username}: ${message}`);
            } else {
                console.log(`User ${recipient} is not connected.`);
            }
        } else {
            console.log(`Cannot send message. ${recipient} is not in your friends list.`);
        }
    }

    addFriend(friendUsername) {
        if (!this.friends.includes(friendUsername)) {
            this.friends.push(friendUsername);
            console.log(`${friendUsername} added to friends list.`);
        }
    }

    removeFriend(friendUsername) {
        this.friends = this.friends.filter(friend => friend !== friendUsername);
        console.log(`${friendUsername} removed from friends list.`);
    }

    createGroup(groupName) {
        if (!this.groups.includes(groupName)) {
            this.groups.push(groupName);
            console.log(`Group ${groupName} created.`);
        }
    }

    addGroup(groupName) {
        if (!this.groups.includes(groupName)) {
            this.groups.push(groupName);
            console.log(`Added to group ${groupName}.`);
        }
    }

    removeGroup(groupName) {
        this.groups = this.groups.filter(group => group !== groupName);
        console.log(`Removed from group ${groupName}.`);
    }
}

module.exports = User;