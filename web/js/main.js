var subdir = window.location.pathname.endsWith("/") ? window.location.pathname : window.location.pathname + "/";
var socket = subdir == "/" ? io() : io("", { "path": subdir + "/socket.io" }); //Connect to socketIo even on subpaths

//Constants
var localStream = null;
var offerOptions = {
  offerToReceiveAudio: 1, //Want audio
  offerToReceiveVideo: 1  //Want video
};
var constraints = { video: true, audio: true };
var servers = { 'iceServers': [{ 'url': 'stun:stun.l.google.com:19302' }] };

var pcs = {}; //Peer connections to all remotes

socket.on("connect", function () {
  console.log("CONNECTED!");

  //STEP 1 (Initiator: getting an offer req)
  socket.on("reqWebRTCOffer", function (reqSocketId) { //Other client wants our offer!
    var pc = new RTCPeerConnection(servers);
    pcs[reqSocketId] = pc;

    pc.addStream(localStream); //Set Local Stream
    console.log('Adding local stream to initiator PC');

    pc.onicecandidate = function (e) {
      if (!pc || !e || !e.candidate) return;
      console.log("send new ice candidate offer!");
      socket.emit("sendNewIceCandidate", { reqSocketId: reqSocketId, candidate: e.candidate });
    };

    pc.oniceconnectionstatechange = function (e) {
      console.log('ICE state: ' + pc.iceConnectionState);
      if (pc.iceConnectionState == 'disconnected') {
        $("#" + reqSocketId).remove();
        console.log("ICE state: ", pc.iceConnectionState)
      }
    };

    pc.onaddstream = function (event) {
      gotRemoteStream(event, reqSocketId);
    };

    pc.createOffer(offerOptions).then(
      function (desc) { //on success
        console.log('PC initiator created offer', desc);
        pc.setLocalDescription(desc).then(
          function () { },
          onSetSessionDescriptionError
        );
        //STEP 2 (Initiator: SEND the SDP offer)
        console.log("Sending SDP offer!");
        socket.emit("sendSDPOffertoSocket", { reqSocketId: reqSocketId, sdpOffer: desc });
      },
      function (error) {
        console.log('Error setting SDP: ' + error.toString(), error);
      }
    );
  });

  //STEP 3 (Callee: Get Offer and Create Answer)
  socket.on("reqWebRTCAnswer", function (content) {
    var sdpOffer = content["sdpOffer"];
    var reqSocketId = content["reqSocketId"];

    var pc = new RTCPeerConnection(servers);
    pcs[reqSocketId] = pc;

    pc.onicecandidate = function (e) {
      //STEP 2 (Initiator: SEND the offer 2sec after first candidate)
      if (!pc || !e || !e.candidate) return;
      console.log("send new ice candidate answer!");
      socket.emit("sendNewIceCandidate", { reqSocketId: reqSocketId, candidate: e.candidate });
      
    };

    pc.oniceconnectionstatechange = function (e) {
      console.log('ICE state: ' + pc.iceConnectionState);
      if (pc.iceConnectionState == 'disconnected') {
        $("#" + reqSocketId).remove();
        console.log("ICE state: ", pc.iceConnectionState)
      }
    };

    pc.onaddstream = function (event) {
      gotRemoteStream(event, reqSocketId);
    };
    pc.addStream(localStream); //add local stream to peer
    console.log("ADD OFFFER", sdpOffer)
    pc.setRemoteDescription(new RTCSessionDescription(sdpOffer)).then(function () { //Success
      console.log('Set remote Success. Creating answer');
      setTimeout(function () {
        pc.createAnswer().then(function (desc) {
          console.log('Created answer', desc);
          //STEP 4 (Callee: Send Answer)
          socket.emit("sendSDPAnswertoSocket", { reqSocketId: reqSocketId, sdpAnswer: desc });
          pc.setLocalDescription(desc).then(
            function () { },
            onSetSessionDescriptionError
          );
        }, function (error) {
          console.log('Error setting SDP: ' + error.toString(), error);
        });
      }, 3000)

    }, onSetSessionDescriptionError);
  })

  //STEP 5 (Initiator: Setting answer and starting connection)
  socket.on("setWebRTCAnswer", function (content) {
    var sdpAnswer = content["sdpAnswer"];
    var reqSocketId = content["reqSocketId"];
    var pc = pcs[reqSocketId];

    console.log('set Sdp setting answer', sdpAnswer);
    pc.setRemoteDescription(new RTCSessionDescription(sdpAnswer)).then(
      function () {
        console.log("setRemoteDescription was successful");
      },
      onSetSessionDescriptionError
    );
  });

  socket.on("addNewIceCandidate", function (content) {
    var candidate = content["candidate"];
    var reqSocketId = content["reqSocketId"];
    var pc = pcs[reqSocketId];
    pc.addIceCandidate(new RTCIceCandidate({
      sdpMLineIndex: candidate.sdpMLineIndex,
      candidate: candidate.candidate
    }));
  });

  initLocalMedia();

  function initLocalMedia() {
    navigator.getUserMedia(constraints,
      function (stream) { //OnSuccess
        localStream = stream;
        console.log('getUserMedia success! Stream: ', stream);
        console.log('LocalStream', localStream.getVideoTracks());

        var localVideo = document.getElementById('local');
        localVideo.srcObject = localStream;
        var videoTracks = localStream.getVideoTracks();
        var audioTracks = localStream.getAudioTracks();
        if (videoTracks.length > 0) {
          console.log('Using video device: ' + videoTracks[0].label);
        }
        if (audioTracks.length > 0) {
          console.log('Using audio device: ' + audioTracks[0].label);
        }

        //Join the room if local media is active!
        var roomname = getUrlParam("roomname", "unknown");
        socket.emit("joinRoom", roomname);
      },
      function (error) { //OnError
        alert("Could not get your Camera / Mic!")
        console.log('getUserMedia error! Got this error: ', error);
      }
    );
  }
});

function gotRemoteStream(event, socketId) {
  var div = $('<div id="' + socketId + '">' +
    '<video autoplay controls></video>' +
    '</div>')
  $("#media").append(div)
  div.find("video")[0].srcObject = event.stream;
};

//Error
function onSetSessionDescriptionError(error) {
  console.log("Set session desc. error!", error);
}

function getUrlParam(parameter, defaultvalue) {
  var urlparameter = defaultvalue;
  if (window.location.href.indexOf(parameter) > -1) {
    urlparameter = getUrlVars()[parameter];
  }
  return urlparameter;
}

function getUrlVars() {
  var vars = {};
  var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function (m, key, value) {
    vars[key] = value;
  });
  return vars;
}