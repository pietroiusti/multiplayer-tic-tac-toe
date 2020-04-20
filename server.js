'use strict';
const functions = require('./public/modules/functions.js');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

/*             */
/* HTTP SERVER */
/*             */
const httpServer = http.createServer((req, res) => {

  let filePath = '.' + req.url;
  if (filePath === './')
    filePath = './index.html';

  let extname = String(path.extname(filePath)).toLowerCase();

  let mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm'
  };

  let contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile('./public/' + filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
	fs.readFile('./404.html', (error) => {
	  res.writeHead(404, {'Content-Type': 'text/html'});
	  res.end(content, 'utf-8');
	});
      } else {
	res.write(500);
	res.end(`Error: ${error.code}\n`);
      }
    } else {
      res.writeHead(200, {'Content-Type': contentType});
      res.end(content, 'utf-8');
    }
  });

}).listen(process.env.PORT || 9898);

/*                  */
/* WEBSOCKET SERVER */
/*                  */
const wss = new WebSocket.Server({ httpServer });

let rooms = [
  // {
  //   number: '666',
  //   next: 'X',
  //   users: [{ws: {...}, mark: 'X'}]
  //   board: ...
  // },
  // {
  //   number: '777',
  //   next: 'O',
  //   users: [{ws: {...}, mark: 'X'}, {ws: {}, mark: 'O'}]
  //   board: ...
  // }
];

wss.on('connection', (ws) => {

  ws.on('message', (req) => {
    req = JSON.parse(req);
    switch (req.type) {
    case 'connection': {
      connect(ws, req.roomNumber);
      break;
    }
    case 'move':  {
      let room = roomExists(rooms, req.roomNumber);
      makeMove(ws, room, req.cell);
      break;
    }
    case 'newGame': {
      let room = roomExists(rooms, req.roomNumber);
      startNewGame(room);
      break;
    }
    default: {
      console.log('? 1');
    }}
  });

  ws.on('close', (e) => {
    disconnectUser(ws);
  });

});

function connect(ws, roomNumber) {
  if (! /^\d+$/.exec(roomNumber)) {//check whether input is a number
    ws.send(JSON.stringify({
      type: 'room number error'
    }));
    return;
  }

  let room = roomExists(rooms, roomNumber);

  if (!room) {
    room = new Room( roomNumber,
		     [{ws: ws, mark: 'X'}],
		     Board.empty(),
		     'X',
		     null );
    rooms.push(room);
    ws.send(JSON.stringify({
      type: 'create room',
      room: room.hideWs()
    }));
  } else {
    if (room.users.length === 1) {
      let updatedRoom = room.update({users: [room.users[0], {ws: ws, mark: room.users[0].mark === 'X' ? 'O' : 'X'}]});

      rooms = rooms.filter((r) => r.number !== room.number);
      room = updatedRoom;
      rooms.push(room);
      room.users[0].ws.send(JSON.stringify({ //an opponent is joining the client's room
	type: 'second user access',
	room: room.hideWs()
      }));

      room.users[1].ws.send(JSON.stringify( //client is joining an opponent's room
	{
	  type: 'join existing room',
	  room: room.hideWs()
	}
      ));
    } else {
      ws.send(JSON.stringify({
	type: 'room full'
      }));
    }
  }
}

function makeMove(ws, room, cell) {
  let user = room.users.filter(u => u.ws === ws)[0];
  if (room && room.users.length === 2 && room.board.cells[cell] === null &&
      room.next === user.mark &&
      !functions.draw(room.board.cells) && !functions.winner(room.board.cells)) {
    let updatedRoom = room.update({next: room.next === 'X' ? 'O' : 'X',
				   board: room.board.update(cell, user.mark)});
    rooms = rooms.filter((r) => r.number !== room.number);
    room = updatedRoom;
    rooms.push(room);
    room.users.forEach(u => {
      u.ws.send(JSON.stringify({
      	type: 'update',
      	room: room.hideWs()
      }));
    });
  }
}

function startNewGame(room) {
  let updatedRoom = room.update({board: Board.empty()});
  rooms = rooms.filter((r) => r.number !== room.number);
  room = updatedRoom;
  rooms.push(room);

  room.users.forEach((u) => {
    u.ws.send(JSON.stringify({
      type: 'resetBoard',
      room: room.hideWs()
    }));
  });
}

function disconnectUser(ws) {
  for (let i = 0; i < rooms.length; i++) {
    if (rooms[i].users.length === 1) {
      if (rooms[i].users[0].ws === ws) {
	rooms.splice(i, 1);
      }
    } else {
      rooms[i] = rooms[i].update({
	users: rooms[i].users.filter((u) => !(u.ws === ws))
      });

      rooms[i] = rooms[i].update({board: Board.empty()});
      rooms[i].users[0].ws.send(JSON.stringify({
	type: 'userLeft',
	room: rooms[i].hideWs()
      }));
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

class Room {
  constructor(number, users, board, next) {
    this.number = number;
    this.users = users;
    this.board = board;
    this.next = next;
  }
  update(config) {
    return Object.assign(new Room(), this, config);
  }
  hideWs () { // create copy of room without ws data
    return new Room( this.number,
		     this.users
		     ?
		     this.users.length === 1
		     ?
		     [ {ws: 'hidden', mark: this.users[0].mark}]
		     :
		     [
		       {ws: 'hidden', mark: this.users[0].mark},
		       {ws: 'hidden', mark: this.users[1].mark}
		     ]
		     : this.users,
		     this.board,
		     this.next,
		   );
  }
}

class Board {
  constructor(cells) {
    this.cells = cells;
  }
  static empty() {
    return new Board(new Array(9).fill(null));
  }
  update(cell, value) {
    let cells = this.cells.slice();
    cells[cell] = value;
    return new Board(cells);
  }
}
