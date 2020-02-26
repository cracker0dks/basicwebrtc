var subdir = window.location.pathname.endsWith("/") ? window.location.pathname : window.location.pathname + "/";
var socket = subdir == "/" ? io() : io("", { "path": subdir + "/socket.io" }); //Connect to socketIo even on subpaths

//Constants
var localStream = null;
var offerOptions = {
  offerToReceiveAudio: 1, //Want audio
  offerToReceiveVideo: 1  //Want video
};
var constraints = { video: true, audio: true };
var iceServers = {
  'iceServers': []
};

var pcs = {}; //Peer connections to all remotes

socket.on("connect", function () {
  console.log("CONNECTED!");

  //STEP 1 (Initiator: getting an offer req)
  socket.on("reqWebRTCOffer", async function (reqSocketId) { //Other client wants our offer!
    var pc = new RTCPeerConnection(iceServers);
    pcs[reqSocketId] = pc;

    pc.onnegotiationneeded = async function () {
      //Create offer
      console.log('PC initiator created offer!');
      await pc.setLocalDescription(await pc.createOffer(offerOptions))
      //STEP 2 (Initiator: SEND the SDP offer)
      console.log("Sending SDP offer!");
      socket.emit("sendSDPOffertoSocket", { reqSocketId: reqSocketId, sdpOffer: pc.localDescription });
    }

    console.log('Adding local stream to initiator PC');
    pc.addStream(localStream); //Set Local Stream

    pc.onicecandidate = function (e) {
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
  });

  //STEP 3 (Callee: Get Offer and Create Answer)
  socket.on("reqWebRTCAnswer", async function (content) {
    var sdpOffer = content["sdpOffer"];
    var reqSocketId = content["reqSocketId"];

    var pc = new RTCPeerConnection(iceServers);
    pcs[reqSocketId] = pc;

    pc.onicecandidate = function (e) {
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

    //STEP 4 (Callee: Create and send Answer)
    console.log('Set remote Success. Creating answer');
    if (pc.signalingState != "stable") { //If not stable ask for renegotiation
      await Promise.all([
        pc.setLocalDescription({ type: "rollback" }), //Be polite
        await pc.setRemoteDescription(new RTCSessionDescription(sdpOffer))
      ]);
    } else {
      await pc.setRemoteDescription(new RTCSessionDescription(sdpOffer))
    }

    await pc.setLocalDescription(await pc.createAnswer());
    console.log('Created answer!');
    socket.emit("sendSDPAnswertoSocket", { reqSocketId: reqSocketId, sdpAnswer: pc.localDescription });
  })


  //STEP 5 (Initiator: Setting answer and starting connection)
  socket.on("setWebRTCAnswer", function (content) {
    var sdpAnswer = content["sdpAnswer"];
    var reqSocketId = content["reqSocketId"];
    var pc = pcs[reqSocketId];

    console.log('set Sdp setting answer', sdpAnswer);
    pc.setRemoteDescription(new RTCSessionDescription(sdpAnswer))
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

  $("#startBtn").click(function () {
    constraints = { video: $("#mediaSelect").val() == 1, audio: {'echoCancellation': true} };
    $("#start").remove();
    $("#container").show();
    initLocalMedia();
  })

  function initLocalMedia() {
    navigator.getUserMedia(constraints,
      function (stream) { //OnSuccess
        localStream = stream;
        console.log('getUserMedia success! Stream: ', stream);
        console.log('LocalStream', localStream.getVideoTracks());

        var videoTracks = localStream.getVideoTracks();
        var audioTracks = localStream.getAudioTracks();

        var mediaDiv = $('<div><span class="htext">LOCAL</span><video autoplay controls muted></video></div>');
        mediaDiv.find("video")[0].srcObject = localStream;
        if (videoTracks.length == 0) {
          mediaDiv = $('<div style="padding-top:10px;"><span style="position: relative; top: -22px;">LOCAL: </span><audio autoplay controls muted></audio></div>');
          mediaDiv.find("audio")[0].srcObject = localStream;
        }

        $("#localMedia").append(mediaDiv)

        if (videoTracks.length > 0) {
          console.log('Using video device: ' + videoTracks[0].label);
        }
        if (audioTracks.length > 0) {
          console.log('Using audio device: ' + audioTracks[0].label);
        }

        joinRoom();
      },
      function (error) { //OnError
        alert("Could not get your Camera / Mic!")
        console.log('getUserMedia error! Got this error: ', error);
      }
    );
  }
});

if(localStream) {
  joinRoom();
}

function joinRoom() {
  //Only join the room if local media is active!
  var roomname = getUrlParam("roomname", "unknown");
  socket.emit("joinRoom", roomname, function (newIceServers) {
    iceServers["iceServers"] = newIceServers;
    console.log("got newIceServers", newIceServers)
  });
}

function gotRemoteStream(event, socketId) {
  var videoTracks = event.stream.getVideoTracks();
  var audioTracks = event.stream.getAudioTracks();

  console.log("videoTracks", videoTracks)
  console.log("audioTracks", audioTracks)
  
  $("#" + socketId).remove();
  if (videoTracks.length >= 1 && audioTracks.length >= 1) {
    var div = $('<div" id="' + socketId + '"><span class="htext">REMOTE</span>' +
      '<video autoplay controls></video>' +
      '</div>')
    $("#remoteMedia").append(div)


    div.find("video")[0].srcObject = event.stream;
  } else {
    var div = $('<div style="padding-top:10px;" id="' + socketId + '"><span style="position: relative; top: -22px;">REMOTE: </span>' +
      '<audio autoplay controls></audio>' +
      '</div>')
    $("#remoteMedia").append(div)

    div.find("audio")[0].srcObject = event.stream;
  }
};

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