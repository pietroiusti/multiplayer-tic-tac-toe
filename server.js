const http = require('http');
const fs = require('fs');

var WebSocket = require('ws');

const server = http.createServer((req, res) => {
  switch (req.url) {

  case '/':
    fs.readFile('./public/index.html', (err, page) => {
      if (err) {
	res.writeHead(404);
	res.end(JSON.stringify(err));
	return;
      }
      res.writeHead(200);
      res.end(page);
    });
    break;

  case '/tictactoe.js':
    fs.readFile('./public/tictactoe.js', (err, script) => {
      if (err) {
	res.writeHead(404);
	res.end(JSON.stringify(err));
	return;
      }
      res.writeHead(200, {
	'Content-Type': 'text/css'
      });
      res.end(script);
    });
    break;

  case '/style.css':
    fs.readFile('./public/style.css', (err, style) => {
      if (err) {
	res.writeHead(404);
	res.end(JSON.stringify(err));
	return;
      }
      res.writeHead(200, {
	'Content-Type': 'text/css'
      });
      res.end(style);
    });
    break;

  default:
    res.writeHead(404);
    res.end('Nothing here\n');
  }
});

server.listen(9898);

const wss = new WebSocket.Server({ server });

let rooms = [
  {
    number: '666',
    users: [{ws: {}, username: 'peppino'}]
  },
  {
    number: '777',
    users: [{ws: {}, username: 'Gianni'}, {ws: {}, username: 'Bernardo'}]
  }
];

wss.on('connection', (ws) => {
  ws.on('message', (action) => {
    action = JSON.parse(action);
    switch (action.type) {
    case 'joinRoom':
      handleJoinRoomAction(action, ws);
      console.log(rooms);
      break;
    case 'exitRoom':
      break;
    default:
      console.log('? 1');
    }
  });

  ws.on('close', (e) => {
    console.log('Client has disconnected');

    for (let i = 0; i < rooms.length; i++) {
      if (rooms[i].users.length === 1) {
	if (rooms[i].users[0].ws === ws) {
	  console.log(`${rooms[i].users[0].username} abandoned`);
	  let r = rooms.slice();
	  r.splice(i, 1);
	  rooms = r;
	}
      } else if (rooms[i].users.length === 2) {
	if (rooms[i].users[0].ws === ws) {
	  console.log(`${rooms[i].users[0].username} abandoned`);
	  let r = rooms.slice();
	  r[i].users.shift();
	  rooms = r;
	}
	else if (rooms[i].users[1].ws === ws) {
	  console.log(`${rooms[i].users[0].username} abandoned`);
	  let r = rooms.slice();
	  r[i].users.pop();
	  rooms = r;
	}
      }
    }
    console.log(rooms);
  });
});

function handleJoinRoomAction(action, ws) {
  if (!action.username || !action.room) {
    console.log('Missing information');
    return;
  }

  let room = roomExists(rooms, action.room);
  if (!room) {
    rooms.push({
      number: action.room,
      users: [{ws: ws, username: action.username}]
    });
  } else {
    if (room.users.length === 1) {
      room.users.push({ws: ws, username: action.username});
    } else {
      console.log('room is full');
    }
  }
}

function roomExists(rooms, number) {
  return rooms.filter((room) => {
    if (room.number === number)
      return true;
    else
      return false;
  })[0];
};
