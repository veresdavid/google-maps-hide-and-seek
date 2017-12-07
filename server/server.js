/*
	Google Maps Hide and Seek - Server
*/

// require modules

var express = require("express");
var http = require("http");
var googleMapsClient = require("@google/maps").createClient({
	key: "AIzaSyAQsbJwNydVL6T5XXphvS72dU2YdwxUq5c",
	Promise: Promise
});

// ================================================================================

// create server

var app = express();
var server = http.createServer(app).listen(3000);
var io = require("socket.io")(server);

// ================================================================================

// server global variables

var guestNumber = 1;

var connections = new Map();

var games = [];

// in meter
const HIDING_PLACE_RADIUS = 50;

// ================================================================================

// socket.io event handlers

io.on("connection", (socket) => {

	// offer the newly connected user a name, based on guestNumber
	socket.emit("chooseName", offerName());

	// assign event handlers

	// handle when client choose a name
	socket.on("chooseName", (name) => {
		chooseName(socket, name);
	});

});

// ================================================================================

// helper functions for socket.io event handlers

function assignCallbacks(socket){

	// remove chooseName callback
	socket.removeAllListeners("chooseName");

	// handle disconnect
	socket.on("disconnect", () => {
		disconnect(socket);
	});

	// handle when socket challenges another socket for a game
	socket.on("challenge", (name) => {
		challenge(socket, name);
	});

	// handle accept challenge
	socket.on("acceptChallenge", (name) => {
		acceptChallenge(socket, name);
	});

	// handle reject challenge
	socket.on("rejectChallenge", (name) => {
		rejectChallenge(socket, name);
	});

	// handle cancel challenge
	socket.on("cancelChallenge", (name) => {
		cancelChallenge(socket, name);
	});

	// handle picking hiding place
	socket.on("pickHidingPlace", (point) => {
		pickHidingPlace(socket, point);
	});

	// handle turn
	socket.on("turn", (point) => {
		turn(socket, point);
	});

}

function chooseName(socket, name){

	// check if name is not already in use
	if(connections.has(name)){

		// reject name
		socket.emit("rejectName");

		// offer guest name again
		socket.emit("chooseName", offerName());

		return;

	}

	// assign callbacks
	assignCallbacks(socket);

	// else accept user and save in connections
	socket.name = name;

	var connection = {
		name: name,
		socket: socket,
		inGame: false,
		game: null,
		invitations: [],
		waitings: []
	};

	connections.set(name, connection);

	// join the socket to the lobby
	socket.join("lobby");

	// inform everyone in the lobby
	sendLobbyUsersList(socket);

	// send welcome message to the socket
	sendWelcomeMessage(socket);

	// also increment guestNumber
	guestNumber++;

}

function disconnect(socket){

	// get usefull values
	var name = socket.name;
	var connection = connections.get(name);

	// if not assigned name yet, dont have to do anything
	if(socket.name == null){
		return;
	}

	if(connection.inGame){
		dodgeGame(socket);
	}else{
		disconnectFromLobby(socket);
	}

}

function dodgeGame(socket){

	// usefull variables
	var name = socket.name;
	var connection = connections.get(name);
	var game = connection.game;
	var playerIndex = game.players.indexOf(connection);
	var otherConnection = game.players[1 - playerIndex];

	// remove other player from game
	otherConnection.inGame = false;
	otherConnection.game = null;

	// remove game
	games.splice(games.indexOf(game), 1);

	// remove proper object from connections
	connections.delete(name);

	// inform other player about the dodge
	otherConnection.socket.emit("dodge");

	// put the other player back to the lobby
	otherConnection.socket.leave(game.room);
	otherConnection.socket.join("lobby");

	// send lobby list to lobby users
	sendLobbyUsersList(otherConnection.socket);

}

function cancelInvitations(socket){

	var name = socket.name;
	var connection = connections.get(name);

	connection.invitations.forEach((invitation) => {

		var otherConnection = connections.get(invitation);

		otherConnection.waitings.splice(otherConnection.waitings.indexOf(name), 1);

		sendWaitings(otherConnection.socket, otherConnection.waitings);

	});

	connection.invitations = [];

}

function cancelWaitings(socket){

	var name = socket.name;
	var connection = connections.get(name);

	connection.waitings.forEach((waiting) => {

		var otherConnection = connections.get(waiting);

		otherConnection.invitations.splice(otherConnection.invitations.indexOf(name), 1);

		sendInvitations(otherConnection.socket, otherConnection.invitations);

	});

	connection.waitings = [];

}

function disconnectFromLobby(socket){

	var name = socket.name;

	// cancel all invitations and waitings
	cancelInvitations(socket);
	cancelWaitings(socket);

	// remove proper object from connections
	connections.delete(name);

	// send disconnect message
	sendDisconnectMessage(socket);

	// send lobby users list
	sendLobbyUsersList(socket);

}

// returning available guest name string
function offerName(){
	return "Guest" + guestNumber;
}

function getLobbyUsersList(){

	var lobbyUsersList = [];

	connections.forEach((value, key, map) => {
		if(!value.inGame){
			lobbyUsersList.push(key);
		}
	});

	return lobbyUsersList;

}

function sendLobbyUsersList(socket){

	// inform the socket itself
	socket.emit("lobbyUsers", getLobbyUsersList());

	// inform every other sockets
	socket.to("lobby").emit("lobbyUsers", getLobbyUsersList());

}

function sendWelcomeMessage(socket){

	socket.emit("welcome");

}

function sendDisconnectMessage(socket){

	socket.to("lobby").emit("userDisconnected", socket.name);

}

function sendWaitings(socket, waitings){
	socket.emit("waitings", waitings);
}

function sendInvitations(socket, invitations){
	socket.emit("invitations", invitations);
}

function challenge(socket, name){

	var challengerName = socket.name;
	var challengerConnection = connections.get(challengerName);

	// not the player itself
	if(challengerName === name){
		return;
	}

	// is there such user
	if(!connections.has(name)){
		return;
	}

	var otherConnection = connections.get(name);

	// not in game
	if(otherConnection.inGame){
		return;
	}

	// not already challenged
	if(challengerConnection.waitings.includes(name)){
		return;
	}

	// not already challenged by the other player
	if(challengerConnection.invitations.includes(name)){
		return;
	}

	// add items to sets
	challengerConnection.waitings.push(name);
	otherConnection.invitations.push(challengerName);

	// inform sockets
	sendWaitings(challengerConnection.socket, challengerConnection.waitings);
	sendInvitations(otherConnection.socket, otherConnection.invitations);

}

function acceptChallenge(socket, name){

	// get usefull variables
	var accepterName = socket.name;
	var accepterConnection = connections.get(accepterName);

	// is there such user
	if(!connections.has(name)){
		return;
	}

	var otherConnection = connections.get(name);

	// is there such challenge
	if(!accepterConnection.invitations.includes(name)){
		return;
	}

	// remove all invitations and waitings for both users
	cancelInvitations(accepterConnection.socket);
	cancelWaitings(accepterConnection.socket);
	cancelInvitations(otherConnection.socket);
	cancelWaitings(otherConnection.socket);

	// start new game
	newGame(accepterConnection, otherConnection);

}

function rejectChallenge(socket, name){

	var rejecterName = socket.name;
	var rejecterConnection = connections.get(rejecterName);

	// is there such user
	if(!connections.has(name)){
		return;
	}

	var otherConnection = connections.get(name);

	// is there such challenge
	if(!rejecterConnection.invitations.includes(name)){
		return;
	}

	rejecterConnection.invitations.splice(rejecterConnection.invitations.indexOf(name), 1);
	otherConnection.waitings.splice(otherConnection.waitings.indexOf(rejecterName), 1);

	sendInvitations(rejecterConnection.socket, rejecterConnection.invitations);
	sendWaitings(otherConnection.socket, otherConnection.waitings);

}

function cancelChallenge(socket, name){

	var cancellerName = socket.name;
	var cancellerConnection = connections.get(cancellerName);

	// is there such user
	if(!connections.has(name)){
		return;
	}

	var otherConnection = connections.get(name);

	// is there such challenge
	if(!cancellerConnection.waitings.includes(name)){
		return;
	}

	cancellerConnection.waitings.splice(cancellerConnection.waitings.indexOf(name), 1);
	otherConnection.invitations.splice(otherConnection.invitations.indexOf(cancellerName), 1);

	sendWaitings(cancellerConnection.socket, cancellerConnection.waitings);
	sendInvitations(otherConnection.socket, otherConnection.invitations);

}

// ================================================================================

// game logic

function newGame(player1, player2){

	// player1 and player2 objects are connections, elements of the connections map

	// set inGame flag to true
	player1.inGame = true;
	player2.inGame = true;

	// create new game object
	var game = {
		players: [player1, player2],
		turn: 0,
		ready: [false, false],
		hidingPlaces: new Array(2),
		room: player1.name + "-vs-" + player2.name
	};

	// store game object
	games.push(game);

	// store game reference for connections
	player1.game = game;
	player2.game = game;

	// remove them from the lobby
	player1.socket.leave("lobby");
	player2.socket.leave("lobby");

	// add players to game room chat
	player1.socket.join(game.room);
	player2.socket.join(game.room);

	// inform users in lobby
	player1.socket.to("lobby").emit("lobbyUsers", getLobbyUsersList());

	// inform players about starting the game
	player1.socket.emit("game", player2.name);
	player2.socket.emit("game", player1.name);

	// ask players to pick hiding place
	player1.socket.emit("pickHidingPlace");
	player2.socket.emit("pickHidingPlace");

}

function pickHidingPlace(socket, point){

	var name = socket.name;
	var connection = connections.get(name);

	// check if in game
	if(!connection.inGame){
		return;
	}

	// already picked hiding place
	var game = connection.game;
	var playerIndex = game.players.indexOf(connection);
	if(game.ready[playerIndex]){
		return;
	}

	// save data
	game.hidingPlaces[playerIndex] = point;
	game.ready[playerIndex] = true;

	// inform player
	socket.emit("hidingPlace", point, HIDING_PLACE_RADIUS);

	// if both of the two players are ready, lets start the game
	if(game.ready[0] && game.ready[1]){
		nextTurn(game);
	}

}

function nextTurn(game){

	var currentPlayer = game.players[game.turn];
	var waitingPlayer = game.players[1 - game.turn];

	currentPlayer.socket.emit("turn");
	waitingPlayer.socket.emit("waiting");

}

async function turn(socket, point){

	var name = socket.name;
	var currentPlayer = connections.get(name);

	// in game
	if(!currentPlayer.inGame){
		return;
	}

	var game = currentPlayer.game;

	// all players ready
	if(!(game.ready[0] && game.ready[1])){
		return;
	}

	// current players turn
	var playerIndex = game.players.indexOf(currentPlayer);
	if(playerIndex != game.turn){
		return;
	}

	// get distance information
	var distanceInformation = await getDistanceInformation(point, game.hidingPlaces[1 - playerIndex]);

	// if error occurs, repeat turn
	if(distanceInformation == null){

		socket.emit("repeatTurn");

		nextTurn(game);

	}else{

		// send hint to the current player
		sendHint(currentPlayer.socket, point, game.hidingPlaces[1 - playerIndex], distanceInformation);

		// send data to the other player
		var otherPlayer = game.players[1 - playerIndex];
		otherPlayer.socket.emit("enemyTurnResult", point);

		// check if not game over yet
		if(distanceInformation.value <= HIDING_PLACE_RADIUS){

			// game over
			gameOver(game, currentPlayer, otherPlayer);

		}else{

			// next turn
			game.turn = 1 - game.turn;
			nextTurn(game);

		}

	}

}

function gameOver(game, winner, loser){

	// winner and loser are connection objects

	// usefull variables
	var game = winner.game;
	var winnerIndex = game.players.indexOf(winner);
	var loserIndex = 1 - winnerIndex;

	// iform them about the result
	winner.socket.emit("win");
	loser.socket.emit("lose");

	// revel hiding places
	winner.socket.emit("enemyHidingPlace", game.hidingPlaces[loserIndex], HIDING_PLACE_RADIUS);
	loser.socket.emit("enemyHidingPlace", game.hidingPlaces[winnerIndex], HIDING_PLACE_RADIUS);

	// set inGame flag to false and remomve game object reference
	winner.inGame = false;
	winner.game = null;
	loser.inGame = false;
	loser.game = null;

	// remove game object from games list
	games.splice(games.indexOf(game), 1);

	// join back to lobby
	winner.socket.leave(game.room);
	loser.socket.leave(game.room);
	winner.socket.join("lobby");
	loser.socket.join("lobby");

	// send lobby list to all lobby users
	sendLobbyUsersList(winner.socket);

}

function sendHint(socket, point, hidingPlace, distanceInformation){

	// generate a random number
	var hintNumber = Math.floor(Math.random() * 4);

	switch(hintNumber){
		case 0:
			sendDistanceHint(socket, point, distanceInformation);
			break;
		case 1:
			sendLatitudeHint(socket, point, hidingPlace);
			break;
		case 2:
			sendLongitudeHint(socket, point, hidingPlace);
			break;
		case 3:
			sendAddressHint(socket, point, hidingPlace);
			break;
	}

}

function sendDistanceHint(socket, point, distanceInformation){

	var hint = "Distance from other players hiding place: " + distanceInformation.text + ".";
	socket.emit("turnResult", point, hint);

}

function sendLatitudeHint(socket, point, hidingPlace){

	var direction = (point.lat < hidingPlace.lat) ? "north" : "south";
	var hint = "Go " + direction + " to find your opponent.";
	socket.emit("turnResult", point, hint);

}

function sendLongitudeHint(socket, point, hidingPlace){

	var direction = (point.lng < hidingPlace.lng) ? "east" : "west";
	var hint = "Go " + direction + " to find your opponent.";
	socket.emit("turnResult", point, hint);

}

function getRandomAddressComponentFromJsonResponse(json){

	var addressComponents = [];

	var resultIndex = Math.floor(Math.random() * json.results.length);

	json.results[resultIndex].address_components.forEach((addressComponent) => {
		if(!addressComponent.types.includes("street_number")){
			addressComponents.push(addressComponent.long_name);
		}
	});

	var addressComponentIndex = Math.floor(Math.random() * addressComponents.length);

	return addressComponents[addressComponentIndex];

}

function sendAddressHint(socket, point, hidingPlace){

	var query = {
		latlng: hidingPlace
	};

	googleMapsClient.reverseGeocode(query, (err, response) => {

		var addressComponent = null;

		if(!err){
			addressComponent = getRandomAddressComponentFromJsonResponse(response.json);
		}

		var hint = (addressComponent == null) ? "" : ("You can find your opponent here: " + addressComponent + ".");

		socket.emit("turnResult", point, hint);

	});

}

async function getDistanceInformation(point, hidingPlace){

	var query = {
		origins: [point],
		destinations: [hidingPlace],
		units: "metric"
	};

	var jsonResponse = null;

	var prom = await googleMapsClient.distanceMatrix(query).asPromise().then((val) => { jsonResponse = val.json; });

	if(jsonResponse == null ||  jsonResponse.status != "OK"){
		return null;
	}

	var firstElement = jsonResponse.rows[0].elements[0];

	if(firstElement.status != "OK"){
		return null;
	}

	var result = {
		value: firstElement.distance.value,
		text: firstElement.distance.text
	};

	return result;

}

// ================================================================================