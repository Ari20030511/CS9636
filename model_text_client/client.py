import socket
import threading

def receive_messages(sock):
    while True:
        try:
            message = sock.recv(1024).decode('utf-8')
            if not message:
                break
            print(message)
        except ConnectionResetError:
            print("Disconnected from server.")
            break

def start_client():
    client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    client.connect(('127.0.0.1', 5000))
    print("Connected to the server.")

    receive_thread = threading.Thread(target=receive_messages, args=(client,))
    receive_thread.start()

    while True:
        try:
            message = input("You: ")
            if message.lower() == 'exit':
                print("Exiting chat...")
                client.close()
                break
            client.send(message.encode('utf-8'))
        except KeyboardInterrupt:
            print("\nExiting chat...")
            client.close()
            break

if __name__ == "__main__":
    start_client()
