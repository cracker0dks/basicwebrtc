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
var io = require('socket.io');
var crypto = require('crypto');

//SpinUP Webserver with socketIO
var app = express();
app.use(express.static(__dirname + '/web'));

var server = https.createServer({
    key: privateKey,
    cert: certificate
}, app).listen(HTTPS_PORT);

var icesevers = JSON.parse(fs.readFileSync("./iceservers.json", 'utf8'));


var ioServer = io.listen(server);
console.log("--------------------------------------------");
console.log("SIGNALINGSERVER RUNNING ON PORT: " + HTTPS_PORT);
console.log("--------------------------------------------");

//Listen for IO connections and do signaling
ioServer.sockets.on('connection', function (socket) {
    console.log("NEW USER!");

    socket.on("disconnect", function () {
        console.log("USER GONE!");
    })

    socket.on("joinRoom", function (roomname, callback) {
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
        callback(returnIce)
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

    socket.on("sendNewIceCandidate", function (content) {
        var reqSocketId = content.reqSocketId;
        var candidate = content.candidate;
        ioServer.to(reqSocketId).emit('addNewIceCandidate', { candidate: candidate, reqSocketId: socket.id });
    })

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