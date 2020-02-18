//Constants
var localStream = null;
var pc = null;
var offerOptions = {
  offerToReceiveAudio: 1, //Want audio
  offerToReceiveVideo: 1  //Want video
};
var constraints = { video: true, audio: true };

//HTML Stuff
var callBtn = document.getElementById('call');
var hangupBtn = document.getElementById('hangup');
var sdpAnswerBtn = document.getElementById('setSdpAnswer');
var sdpOfferBtn = document.getElementById('setSdpOffer');
var errordiv = document.getElementById('errorMsg');
var msgdiv = document.getElementById('okMsg');
var SdpText = document.getElementById('sdpMessage');
var localVideo = document.getElementById('local');
var remoteVideo = document.getElementById('remote');

callBtn.disabled = false;
hangupBtn.disabled = true;
callBtn.onclick = call;
hangupBtn.onclick = hangup;
sdpAnswerBtn.onclick = setSdpAnswer;
sdpOfferBtn.onclick = setSdpOffer;

initPeerConnection();

function initPeerConnection() {
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
      var servers = { 'iceServers': [{ 'url': 'stun:stun.l.google.com:19302' }] };
      pc = new RTCPeerConnection(servers);
      //Setting ICE Callbacks  
      pc.onicecandidate = function (e) {
        onIceCandidate(pc, e);
      };
      pc.oniceconnectionstatechange = function (e) {
        onIceStateChange(pc, e);
      };

      pc.onaddstream = gotRemoteStream; //When the connection is ready call this!

      pc.addStream(localStream); //Set Local Stream
      console.log('Adding local stream to initiator PC');
    },
    function (error) { //OnError
      console.log('getUserMedia error! Got this error: ', error);
      errordiv.innerHTML = '<p> Errore! ' + error.name + '</p>';
    }
  );
}

//---------------UI Stuff------------------------
//Called when the "Call" button is pressed!
function call() {
  callBtn.disabled = true;
  hangupBtn.disabled = false;

  pc.createOffer(offerOptions).then(
    function (desc) { //on success
      console.log('PC initiator created offer', desc);
      pc.setLocalDescription(desc).then(
        function () { },
        onSetSessionDescriptionError
      );
      console.log("SDP offer should be sent to the callee PC");
    },
    onCreateSessionDescriptionError //On error
  );
}

function hangup() {
  pc.close();
  pc = null;
  hangupBtn.disabled = true;
  callBtn.disabled = false;
}

//Callee logic
function setSdpOffer() {
  console.log('set Sdp offer button clicked');
  sdpOffer = new RTCSessionDescription(JSON.parse(SdpText.value));

  pc.setRemoteDescription(sdpOffer).then(
    function () { //Success
      console.log('Set remote Success. Creating answer');
      pc.createAnswer().then(
        function (desc) {
          console.log('Created answer', desc);
          msgdiv.innerHTML = '<pre>' + desc.sdp + '</pre>';
          pc.setLocalDescription(desc).then(
            function () { },
            onSetSessionDescriptionError
          );
        },
        onCreateSessionDescriptionError
      );
    },
    onSetSessionDescriptionError
  );
}

//Initiator logic
function setSdpAnswer() {
  var sdpAnswer = new RTCSessionDescription(JSON.parse(SdpText.value));
  console.log('set Sdp answer button clicked. Setting answer', sdpAnswer);
  pc.setRemoteDescription(sdpAnswer).then(
    function () {
      console.log("setRemoteDescription was successful");
    },
    onSetSessionDescriptionError
  );
}

//Callbacks

function gotRemoteStream(e) {
  console.log("Got remote stream!", e);

  remoteVideo.srcObject = e.stream;

}

//ICE Callbacks
function onIceCandidate(pc, event) {
  msgdiv.innerHTML = '<pre>' + JSON.stringify(pc.localDescription) + '</pre>';
}

function onAddIceCandidateSuccess(pc) {
  console.log('addIceCandidate success');
}

function onIceStateChange(pc, event) {
  if (pc) {
    console.log('ICE state: ' + pc.iceConnectionState);
  }
}

//Error Handling
function onCreateSessionDescriptionError(error) {
  console.log('Error setting SDP: ' + error.toString(), error);
  errordiv.innerHTML = 'Error setting SDP';
}

function onSetSessionDescriptionError(error) {
  console.log("Set session desc. error!", error);
}

function onAddIceCandidateError(pc, error) {
  console.log('failed to add ICE Candidate: ' + error.toString());
}
