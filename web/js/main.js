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

//HTML Stuff
var errordiv = document.getElementById('errorMsg');
var msgdiv = document.getElementById('okMsg');
var SdpText = document.getElementById('sdpMessage');
var localVideo = document.getElementById('local');
var remoteVideo = document.getElementById('remote');

var pcs = {};

socket.on("connect", function () {
  console.log("CONNECTED!");
  var roomname = getUrlParam("roomname", "unknown");
  socket.emit("joinRoom", roomname);

  //STEP 1 (Initiator: getting an offer req)
  socket.on("reqWebRTCOffer", function (reqSocketId) { //Other client wants our offer!
    var pc = new RTCPeerConnection(servers);
    pcs[reqSocketId] = pc;

    //Setting ICE Callbacks  
    pc.onicecandidate = function (e) {
      //STEP 2 (Initiator: SEND the offer after ICE finished!)
      console.log("ICE CANIDATE", e)
      if (e.candidate === null) {
        send_sdp_to_remote_peer();
      }
    };
    pc.oniceconnectionstatechange = function (e) {
      console.log('ICE state: ' + pc.iceConnectionState);
      if (pc.iceGatheringState === 'complete') {
        send_sdp_to_remote_peer();
      }
    };

    var isSdpSent = false;

    setTimeout(function () {
      send_sdp_to_remote_peer()
    }, 5000)

    function send_sdp_to_remote_peer() {
      if (isSdpSent) return;
      console.log("SEND complete SDP", pc.localDescription);
      isSdpSent = true;
      socket.emit("sendSDPOffertoSocket", { reqSocketId: reqSocketId, sdpOffer: pc.localDescription });
    }

    pc.onaddstream = gotRemoteStream; //When the connection is ready call this!

    pc.addStream(localStream); //Set Local Stream
    console.log('Adding local stream to initiator PC');

    pc.createOffer(offerOptions).then(
      function (desc) { //on success
        console.log('PC initiator created offer', desc);
        pc.setLocalDescription(desc).then(
          function () { },
          onSetSessionDescriptionError
        );
        console.log("SDP offer should be sent to the callee PC");
      },
      function (error) {
        console.log('Error setting SDP: ' + error.toString(), error);
      }
    );
    console.log("GIVE!")
  });

  //STEP 3 (Callee: Get Offer and Create Answer)
  socket.on("reqWebRTCAnswer", function (content) {
    var sdpOffer = content["sdpOffer"];
    var reqSocketId = content["reqSocketId"];

    var pc = new RTCPeerConnection(servers);
    pcs[reqSocketId] = pc;

    pc.onaddstream = gotRemoteStream; //When the connection is ready call this!
    pc.addStream(localStream); //Set Local Stream

    pc.setRemoteDescription(new RTCSessionDescription(sdpOffer)).then(
      function () { //Success
        console.log('Set remote Success. Creating answer');
        pc.createAnswer().then(
          function (desc) {
            console.log('Created answer', desc);
            //STEP 4 (Callee: Send Answer)
            socket.emit("sendSDPAnswertoSocket", { reqSocketId: reqSocketId, sdpAnswer: desc });
            pc.setLocalDescription(desc).then(
              function () { },
              onSetSessionDescriptionError
            );
          },
          function (error) {
            console.log('Error setting SDP: ' + error.toString(), error);
          }
        );
      },
      onSetSessionDescriptionError
    );
  })

  //STEP 5 (Initiator: Setting answer and starting connection)
  socket.on("setWebRTCAnswer", function (content) {
    console.log("SET ASNNNNNNNNNNNNNNN")
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

  initLocalMedia();
})

function initLocalMedia() {
  navigator.getUserMedia(constraints,
    function (stream) { //OnSuccess
      localStream = stream;
      console.log('getUserMedia success! Stream: ', stream);
      console.log('LocalStream', localStream.getVideoTracks());

      localVideo.srcObject = localStream;
      msgdiv.innerHTML = '<p> ABFAHRT!</p>';
      var videoTracks = localStream.getVideoTracks();
      var audioTracks = localStream.getAudioTracks();
      if (videoTracks.length > 0) {
        console.log('Using video device: ' + videoTracks[0].label);
      }
      if (audioTracks.length > 0) {
        console.log('Using audio device: ' + audioTracks[0].label);
      }
    },
    function (error) { //OnError
      console.log('getUserMedia error! Got this error: ', error);
      errordiv.innerHTML = '<p> Errore! ' + error.name + '</p>';
    }
  );
}

//Callbacks

function gotRemoteStream(e) {
  console.log("Got remote stream!", e);

  remoteVideo.srcObject = e.stream;

}

function onSetSessionDescriptionError(error) {
  console.log("Set session desc. error!", error);
}


//HELPERS
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