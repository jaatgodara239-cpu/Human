const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let waitingQueue = [];
const activePairs = new Map();

io.on('connection', (socket) => {
  socket.on('find_partner', () => {
    if (waitingQueue.includes(socket.id)) return;

    if (waitingQueue.length > 0) {
      const partnerId = waitingQueue.shift();
      const partnerSocket = io.sockets.sockets.get(partnerId);

      if (partnerSocket) {
        const roomId = `room_${socket.id}_${partnerId}`;
        socket.join(roomId);
        partnerSocket.join(roomId);

        activePairs.set(socket.id, { partnerId, roomId });
        activePairs.set(partnerId, { partnerId: socket.id, roomId });

        io.to(roomId).emit('chat_start', 'Connected to a stranger. Say hi!');
      } else {
        waitingQueue.push(socket.id);
        socket.emit('status', 'Looking for a partner...');
      }
    } else {
      waitingQueue.push(socket.id);
      socket.emit('status', 'Waiting for someone to join...');
    }
  });

  socket.on('send_message', (text) => {
    const pair = activePairs.get(socket.id);
    if (pair && text.trim().length > 0) {
      socket.to(pair.roomId).emit('receive_message', text.slice(0, 500));
    }
  });

  const handleLeave = () => {
    waitingQueue = waitingQueue.filter((id) => id !== socket.id);
    const pair = activePairs.get(socket.id);
    if (pair) {
      socket.to(pair.roomId).emit('partner_left', 'Stranger has left.');
      const partnerSocket = io.sockets.sockets.get(pair.partnerId);
      if (partnerSocket) {
        partnerSocket.leave(pair.roomId);
        activePairs.delete(pair.partnerId);
      }
      socket.leave(pair.roomId);
      activePairs.delete(socket.id);
    }
  };

  socket.on('leave_chat', handleLeave);
  socket.on('disconnect', handleLeave);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server active on port ${PORT}`));
    
