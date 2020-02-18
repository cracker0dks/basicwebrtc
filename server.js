//@ts-check

//------------------------------
// BASIC WEBRTC SIGNALING SERVER
//------------------------------

//Define https & websocket Port
const HTTPS_PORT = 3001;

//Get dummy cert files for https
var fs = require('fs');
var privateKey = fs.readFileSync('./cert/key.pem');
var certificate = fs.readFileSync('./cert/cert.pem');

//Require modules
var https = require('https');
var express = require('express');
var io = require('socket.io')

//SpinUP Webserver with socketIO
var app = express();
app.use(express.static(__dirname + '/web'));

var server = https.createServer({
    key: privateKey,
    cert: certificate
}, app).listen(HTTPS_PORT);

var ioServer = io.listen(server);
console.log("SIGNALINGSERVER RUNNING ON PORT: " + HTTPS_PORT);

ioServer.sockets.on('connection', function (socket) {
    console.log("NEW USER!");

    socket.on("disconnect", function () {
        console.log("USER GONE!");
    })

    socket.on("joinRoom", function (roomname) {
        console.log("joinRoom", roomname)
        socket.join(roomname);
        socket.to(roomname).emit("reqWebRTCOffer", socket.id); //Ask anyone in the room to initiate a connection
    })

    socket.on("sendSDPOffertoSocket", function (content) {
        var reqSocketId = content.reqSocketId;
        var sdpOffer = content.sdpOffer;
        ioServer.to(reqSocketId).emit('reqWebRTCAnswer', { sdpOffer: sdpOffer, reqSocketId: socket.id });
    })

    socket.on("sendSDPAnswertoSocket", function (content) {
        var reqSocketId = content.reqSocketId;
        var sdpAnswer = content.sdpAnswer;
        ioServer.to(reqSocketId).emit('setWebRTCAnswer', { sdpAnswer: sdpAnswer, reqSocketId: socket.id });
    })
    
})
//Listen for IO connections and do signaling

