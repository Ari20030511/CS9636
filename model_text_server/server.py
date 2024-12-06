import socket
import threading

clients = {}  # Dictionary to map client sockets to their addresses
groups = {}   # Dictionary to manage groups {group_name: [list_of_clients]}

def broadcast_to_group(group_name, message, sender_socket=None):
    """Send a message to all clients in a specific group."""
    if group_name in groups:
        for client in groups[group_name]:
            if client != sender_socket:  # Don't send the message back to the sender
                try:
                    client.send(message)
                except:
                    groups[group_name].remove(client)

def broadcast_to_all(message, sender_socket=None):
    """Send a message to all connected clients."""
    for client in clients.keys():
        if client != sender_socket:  # Don't send the message back to the sender
            try:
                client.send(message)
            except:
                client.close()
                del clients[client]

def handle_client(client_socket, addr):
    print(f"Client {addr} connected.")
    clients[client_socket] = addr
    client_socket.send("Welcome! Use /join <group_name>, /dm <IP:PORT> <message>, or /all <message>.".encode('utf-8'))
    current_group = None

    while True:
        try:
            message = client_socket.recv(1024).decode('utf-8')
            if not message:
                break

            if message.startswith('/join'):
                # Join a group
                _, group_name = message.split(' ', 1)
                group_name = group_name.strip()

                if current_group:
                    groups[current_group].remove(client_socket)
                current_group = group_name
                if group_name not in groups:
                    groups[group_name] = []
                groups[group_name].append(client_socket)
                client_socket.send(f"Joined group: {group_name}".encode('utf-8'))

            elif message.startswith('/leave'):
                # Leave the current group
                if current_group:
                    groups[current_group].remove(client_socket)
                    client_socket.send(f"Left group: {current_group}".encode('utf-8'))
                    current_group = None
                else:
                    client_socket.send("You are not in any group.".encode('utf-8'))

            elif message.startswith('/dm'):
                # Direct message to another client
                parts = message.split(' ', 2)
                if len(parts) < 3:
                    client_socket.send("Usage: /dm <IP:PORT> <message>".encode('utf-8'))
                    continue
                _, target_addr, dm_message = parts
                target_addr = target_addr.strip()

                # Convert "IP:PORT" into a tuple
                try:
                    target_ip, target_port = target_addr.split(':')
                    target_port = int(target_port)
                except ValueError:
                    client_socket.send("Invalid address format. Use IP:PORT.".encode('utf-8'))
                    continue

                # Find the target client
                target_client = next((sock for sock, addr in clients.items() if addr == (target_ip, target_port)), None)
                if target_client:
                    target_client.send(f"DM from {clients[client_socket]}: {dm_message}".encode('utf-8'))
                else:
                    client_socket.send(f"No client with address {target_addr} found.".encode('utf-8'))

            elif message.startswith('/all'):
                # Broadcast to all clients
                _, broadcast_message = message.split(' ', 1)
                broadcast_to_all(f"Broadcast from {addr[0]}: {broadcast_message}".encode('utf-8'), client_socket)

            elif current_group:
                # Group messaging
                broadcast_to_group(current_group, f"{addr[0]}: {message}".encode('utf-8'), client_socket)

            else:
                client_socket.send("You must join a group or use /dm or /all.".encode('utf-8'))

        except Exception as e:
            print(f"Error with client {addr}: {e}")
            if current_group and client_socket in groups.get(current_group, []):
                groups[current_group].remove(client_socket)
            break

    client_socket.close()
    del clients[client_socket]
    print(f"Client {addr} disconnected.")

def start_server():
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind(('0.0.0.0', 5000))
    server.listen(5)
    print("Server started. Waiting for connections...")
    while True:
        client_socket, addr = server.accept()
        client_handler = threading.Thread(target=handle_client, args=(client_socket, addr))
        client_handler.start()

if __name__ == "__main__":
    start_server()
