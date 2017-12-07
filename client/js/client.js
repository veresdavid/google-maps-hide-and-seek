var socket = io("http://localhost:3000");

var myName;
var yourCounter;
var enemyCounter;
var map = null;
var currentMarker = null;
var myHidingPlace = null;
var enemyHidingPlace = null;
var myMarkers = [];
var enemyMarkers = [];

socket.on("chooseName", (nameOffer) => {

	$("#name").val(nameOffer);

	basicNoty("Please choose a username, or use the offered one.", 3000);

});

socket.on("rejectName", () => {

	basicNoty("Name is already in use!", 3000);

});

socket.on("lobbyUsers", (lobbyUsersList) => {

	$("#users").empty();

	var userList = $("<ul class=\"gameList\"></ul>");

	lobbyUsersList.forEach((user) => {
		
		var listItem = $("<li></li>");

		listItem.append(user);

		if(myName !== user){
			var challengeButton = $("<button>Play</button>").attr("onclick", "challenge('" + user + "')").attr("class", "lobbyButton");
			listItem.append(challengeButton);
		}

		userList.append(listItem);

	});

	$("#users").append(userList);

});

function challenge(user){
	socket.emit("challenge", user);
}

socket.on("welcome", () => {

	basicNoty("Welcome! You have joined to the lobby!", 3000);

	$("#nameChooser").css("display", "none");
	$("#lobby").css("display", "block");

});

socket.on("userDisconnected", (name) => {

	console.log(name + " has disconnected!");

});

socket.on("waitings", (waitings) => {

	$("#waitings").empty();

	var waitingsList = $("<ul class=\"gameList\"></ul>");

	waitings.forEach((user) => {
		
		var listItem = $("<li></li>");

		listItem.append(user);

		var cancelChallengeButton = $("<button>Cancel</button>").attr("onclick", "cancelChallenge('" + user + "')").attr("class", "lobbyButton");

		listItem.append(cancelChallengeButton);

		waitingsList.append(listItem);

	});

	$("#waitings").append(waitingsList);

});

function cancelChallenge(user){
	socket.emit("cancelChallenge", user);
}

socket.on("invitations", (invitations) => {

	$("#invitations").empty();

	var invitationsList = $("<ul class=\"gameList\"></ul>");

	invitations.forEach((user) => {
		
		var listItem = $("<li></li>");

		listItem.append(user);

		var acceptChallengeButton = $("<button>Accept</button>").attr("onclick", "acceptChallenge('" + user + "')").attr("class", "lobbyButton");
		var rejectChallengeButton = $("<button>Reject</button>").attr("onclick", "rejectChallenge('" + user + "')").attr("class", "lobbyButton");

		listItem.append(acceptChallengeButton);
		listItem.append(rejectChallengeButton);

		invitationsList.append(listItem);

	});

	$("#invitations").append(invitationsList);

});

function acceptChallenge(user){
	socket.emit("acceptChallenge", user);
}

function rejectChallenge(user){
	socket.emit("rejectChallenge", user);
}

socket.on("game", () => {

	$("#users").empty();
	$("#waitings").empty();
	$("#invitations").empty();
	$("#lobby").css("display", "none");
	$("#game").css("display", "block");
	$("#send").css("display", "block");

	map = null;
	yourCounter = 1;
	enemyCounter = 1;
	currentMarker = null;
	myHidingPlace = null;
	enemyHidingPlace = null;
	myMarkers = [];
	enemyMarkers = [];

	initMap();

});

socket.on("pickHidingPlace", () => {

	basicNoty("Pick your hiding place in the map!");

	$("#send").click(sendHidingPlace);

});

socket.on("hidingPlace", (point, radius) => {

	// place marker
	myHidingPlace = new google.maps.Marker({
		position: point,
		map: map,
		icon: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png"
	});

	// create info window
	var hidingPlaceInfoWindow = new google.maps.InfoWindow({
		content: "This is your hiding place!"
	});

	// create listener
	myHidingPlace.addListener("click", () => {
		hidingPlaceInfoWindow.open(map, myHidingPlace);
	});

	// draw radius
	new google.maps.Circle({
		strokeColor: "#0000FF",
		strokeOpacity: 0.8,
		strokeWeight: 2,
		fillColor: "#0000FF",
		fillOpacity: 0.35,
		map: map,
		center: point,
		radius: radius
	});

	$("#send").off("click");
	$("#send").click(sendTurn);

});

socket.on("enemyHidingPlace", (point, radius) => {

	// place marker
	enemyHidingPlace = new google.maps.Marker({
		position: point,
		map: map,
		icon: "http://maps.google.com/mapfiles/ms/icons/red-dot.png"
	});

	// create info window
	var hidingPlaceInfoWindow = new google.maps.InfoWindow({
		content: "This was your enemy's hiding place!"
	});

	// create listener
	enemyHidingPlace.addListener("click", () => {
		hidingPlaceInfoWindow.open(map, enemyHidingPlace);
	});

	// draw radius
	new google.maps.Circle({
		strokeColor: "#FF0000",
		strokeOpacity: 0.8,
		strokeWeight: 2,
		fillColor: "#FF0000",
		fillOpacity: 0.35,
		map: map,
		center: point,
		radius: radius
	});

});

socket.on("turn", () => {
	basicNoty("Its your turn!");
});

socket.on("waiting", () => {
});

socket.on("turnResult", (point, hint) => {

	var marker = new google.maps.Marker({
		position: point,
		map: map,
		icon: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png"
	});

	myMarkers.push(marker);

	var info = "This was your #" + yourCounter + " marker.<br/><b>Hint:</b> " + hint;

	var markerInfoWindow = new google.maps.InfoWindow({
		content: info
	});

	marker.addListener("click", () => {
		markerInfoWindow.open(map, marker);
	});

	basicNoty(hint, 3000);

	yourCounter++;

});

socket.on("enemyTurnResult", (point) => {

	var marker = new google.maps.Marker({
		position: point,
		map: map,
		icon: "http://maps.google.com/mapfiles/ms/icons/red-dot.png"
	});

	enemyMarkers.push(marker);

	var info = "This was your enemy's #" + enemyCounter + " marker.";

	var markerInfoWindow = new google.maps.InfoWindow({
		content: info
	});

	marker.addListener("click", () => {
		markerInfoWindow.open(map, marker);
	});

	enemyCounter++;

});

socket.on("repeatTurn", () => {
	basicNoty("Some error occured, please try again!");
});

socket.on("win", () => {
	basicNoty("Congratulations! You have found your enemy!");
	$("#back").css("display", "block");
	$("#back").click(backToLobby);
	$("#send").css("display", "none");
	connectMarkers(myMarkers, "#0000FF");
	connectMarkers(enemyMarkers, "#FF0000");
});

socket.on("lose", () => {
	basicNoty("Sadly, your opponent has found you. Good luck next time");
	$("#back").css("display", "block");
	$("#back").click(backToLobby);
	$("#send").css("display", "none");
	connectMarkers(myMarkers, "#0000FF");
	connectMarkers(enemyMarkers, "#FF0000");
});

function backToLobby(){
	$("#game").css("display", "none");
	$("#lobby").css("display", "block");
	$("#back").off("click");
	$("#back").css("display", "none");
}

socket.on("dodge", () => {
	basicNoty("Your opponent has left. We bringing you back to the lobby.");
	$("#game").css("display", "none");
	$("#lobby").css("display", "block");
});

socket.on("ping", () => {
	socket.emit("pong");
});

function sendName(){

	var name = $("#name").val();
	socket.emit("chooseName", name);
	myName = name;

}

function sendHidingPlace(){

	var point = {
		lat: currentMarker.getPosition().lat(),
		lng: currentMarker.getPosition().lng()
	};

	socket.emit("pickHidingPlace", point);

}

function sendTurn(){

	var point = {
		lat: currentMarker.getPosition().lat(),
		lng: currentMarker.getPosition().lng()
	};

	socket.emit("turn", point);

}

// google maps api functions

function initMap() {

	var deik = {lat: 47.542229, lng: 21.6397644};

	map = new google.maps.Map(document.getElementById("map"), {
		zoom: 16,
		center: deik
	});

	var deikMarker = new google.maps.Marker({
		position: deik,
		map: map,
		icon: "http://maps.google.com/mapfiles/ms/icons/yellow-dot.png"
	});

	var deikInfoWindow = new google.maps.InfoWindow({
		content: "<b>This is our lovely Faculty of Informatics, where we learn about a lot of interesting stuff, like Google Maps, or Python 3!</b>"
	});

	deikMarker.addListener("click", () => {
		deikInfoWindow.open(map, deikMarker);
	});

	currentMarker = new google.maps.Marker({
		position: deik,
		map: map
	});

	map.setOptions({draggableCursor: "crosshair"});

	google.maps.event.addListener(map, "rightclick", function(event) {
		var lat = event.latLng.lat();
		var lng = event.latLng.lng();
		currentMarker.setPosition({lat: lat, lng: lng});
	});

}

function connectMarkers(markers, color){

	var latLngs = [];

	markers.forEach((marker) => {
		latLngs.push({lat: marker.getPosition().lat(), lng: marker.getPosition().lng()});
	});

	var path = new google.maps.Polyline({
		path: latLngs,
		geodesic: true,
		strokeColor: color,
		strokeOpacity: 1.0,
		strokeWeight: 2
	});

	path.setMap(map);

}

// fancy notification
function basicNoty(message, time){

	var n = new Noty({
	text: message,
	animation: {
		open: "animated bounceInRight",
		close: "animated bounceOutRight"
	},
	theme: "metroui"
	}).show();

	n.setTimeout(time);

}