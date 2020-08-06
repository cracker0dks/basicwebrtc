//@ts-check

//------------------------------
// BASIC WEBRTC SIGNALING SERVER
//------------------------------

//Define https & websocket Port
const HTTP_PORT = parseInt(process.env.listen_port) > 0 ? parseInt(process.env.listen_port) : 3001;

//Define API Version
const API_VERSION = 1.1;

//Get dummy cert files for https
var fs = require('fs');

//Require modules
var http = require('http');
var express = require('express');
var io = require('socket.io');
var crypto = require('crypto');

//SpinUP Webserver with socketIO
var app = express();
app.use(express.static(__dirname + '/web'));

var server = http.createServer(app).listen(HTTP_PORT);

var icesevers = JSON.parse(fs.readFileSync("./iceservers.json", 'utf8'));

var ioServer = io.listen(server);
console.log("--------------------------------------------");
console.log("SIGNALINGSERVER RUNNING ON PORT: " + HTTP_PORT);
console.log("--------------------------------------------");

var registerdUUIDs = {};
var socketID_UUIDMatch = {};

//Listen for IO connections and do signaling
ioServer.sockets.on('connection', function (socket) {
    socket.emit('API_VERSION', API_VERSION);

    let roomOfUser = null;
    let nameOfUser = "NA";
    let MY_UUID = null;
    console.log("NEW USER!");

    socket.on("registerUUID", function (content, callback) {
        const UUID = content["UUID"] || null;
        const UUID_KEY = content["UUID"] || null;
        if (UUID && UUID_KEY) {
            if (!registerdUUIDs[UUID] || registerdUUIDs[UUID] == UUID_KEY) {
                const alreadyRegistred = registerdUUIDs[UUID] == UUID_KEY;
                registerdUUIDs[UUID] = UUID_KEY;
                socketID_UUIDMatch[UUID] = socket.id;
                MY_UUID = UUID;
                callback(null, alreadyRegistred);
            } else {
                callback("UUID_KEY was not correct!")
            }
        } else {
            callback("UUID or UUID_KEY was empty on registerUUID!")
        }
    });

    socket.on("closeConnection", function () {
        socket.to(roomOfUser).emit('userDiscconected', MY_UUID);
    });

    socket.on("joinRoom", function (content, callback) {
        var roomname = content["roomname"] || "";
        var username = content["username"] || "";
        if (!roomOfUser) {
            roomOfUser = roomname;
            nameOfUser = username;
            socket.to(roomname).emit('userJoined', { UUID: MY_UUID });
            console.log("joinRoom", roomname, MY_UUID);
            socket.join(roomname);
        }
    })

    socket.on("signaling", function (content) {
        var destSocketId = socketID_UUIDMatch[content.destUUID];
        var signalingData = content.signalingData;

        ioServer.to(destSocketId).emit('signaling', { signalingData: signalingData, fromUUID: MY_UUID, username: nameOfUser });
    });

    //Return the current iceServers
    var returnIce = [];
    for (var i in icesevers) {
        if (icesevers[i].turnServerCredential) { //Generate a temp user and password with this turn server creds if given
            var turnCredentials = getTURNCredentials(icesevers[i].username, icesevers[i].turnServerCredential);
            returnIce.push({
                url: icesevers[i].url,
                credential: turnCredentials.password,
                username: turnCredentials.username,
            });
        } else {
            returnIce.push(icesevers[i]);
        }
    }
    socket.emit('currentIceServers', returnIce);
})

function getTURNCredentials(name, secret) {
    var unixTimeStamp = parseInt((Date.now() / 1000) + "") + 12 * 3600,   // this credential would be valid for the next 12 hours
        username = [unixTimeStamp, name].join(':'),
        password,
        hmac = crypto.createHmac('sha1', secret);
    hmac.setEncoding('base64');
    hmac.write(username);
    hmac.end();
    password = hmac.read();
    return {
        username: username,
        password: password
    };
}