const API_VERSION = 1.2;

const MY_UUID = uuidv4();
const MY_UUID_KEY = uuidv4();

var subdir = window.location.pathname.endsWith("/") ? window.location.pathname : window.location.pathname + "/";

var base64Domain = getUrlParam("base64domain", false);

//ALL # PARAMETERS
var socketDomain = getUrlParam("socketdomain", false); //Domainname with path
var camOnAtStart = getUrlParam("camon", false) == false ? false : true; //Defines if cam should be on at start (On is default)
var username = getUrlParam("username", "NA");
var roomname = getUrlParam("roomname", false);

if (!roomname) {
  roomname = "r" + Math.random().toString().replace(".", "")
  window.location = location.href + "#roomname=" + roomname
}

if (base64Domain && socketDomain) {
  socketDomain = atob(socketDomain);
}

var isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
if (isMobile) { //No Screenshare on mobile devices
  $("#screenBtnContainer").hide();
  $("#mediaControll").css({ width: "270px" })
}

const SocketIO_Options = { withCredentials: false }

var socket;
if (socketDomain) {
  socketDomain = socketDomain.replace('https://', '').replace('http://', '').split("#")[0];
  var domainSplit = socketDomain.split('/');
  socketDomain = 'https://' + domainSplit[0];
  domainSplit.shift();
  subdir = '/' + domainSplit.join('/');
  subdir = subdir.endsWith('/') ? subdir : subdir + '/';
  console.log('socketDomain', socketDomain);
  console.log('subdir', subdir);
  socket = io(socketDomain, { "path": subdir + "socket.io", ...SocketIO_Options })
} else {
  socket = subdir == "/" ? io("", SocketIO_Options) : io("", { "path": subdir + "/socket.io", ...SocketIO_Options }); //Connect to socketIi even on subpaths
}

var webRTCConfig = {};

var allUserStreams = {};
var pcs = {}; //Peer connections to all remotes
var socketConnected = false;
var micMuted = false;
var camActive = false;
var screenActive = false;
var chatActive = false;

socket.on("msg", function (msg) {
  var msg = msg.replace(/(<a href=")?((https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)))(">(.*)<\/a>)?/gi, function () { //Replace link in text with real link
    return '<a href="' + arguments[2] + '">' + (arguments[7] || arguments[2]) + '</a>'
  });
  $("#chatText").append(`<div>${msg}</div>`)
  $("#chatText").find("a").attr("target", "_blank")
  $("#chatText").animate({ scrollTop: $("#chatText")[0].scrollHeight }, 1);
  if (!$("#chatText").is(":visible")) {
    $("#addRemoveChatBtn").css({ "color": "#730303" });
  }
})

socket.on('connect_failed', function () {
  alert("Connection to socketserver failed! Please check the logs!")
  socketConnected = false;
});

socket.on("connect", function () {
  socketConnected = true;

  socket.on("currentIceServers", function (newIceServers) {
    console.log("got newIceServers", newIceServers)
    webRTCConfig["iceServers"] = newIceServers;
  })

  socket.emit("registerUUID", { "UUID": MY_UUID, "UUID_KEY": MY_UUID_KEY }, function (err, alreadyRegistered) {
    if (err) {
      return console.log(err)
    }

    if (alreadyRegistered) {
      return console.log("We are alreadyregistered so don't do it again!")
    }

    socket.on("API_VERSION", function (serverAPI_VERSION) {
      if (API_VERSION != serverAPI_VERSION) {
        alert("SERVER has a different API Version (Client: v" + API_VERSION + " Server: v" + serverAPI_VERSION + ")! This can cause problems, so be warned!")
      }
    })

    socket.on("signaling", function (data) {
      var signalingData = data.signalingData;
      var fromUUID = data.fromUUID;
      if (!pcs[fromUUID]) {
        createRemoteSocket(false, fromUUID)
      }
      pcs[fromUUID].signaling(signalingData);

      if (data.username) {
        allUserStreams[fromUUID] = allUserStreams[fromUUID] ? allUserStreams[fromUUID] : {};
        allUserStreams[fromUUID]["username"] = data.username;
      }
    })

    socket.on("userJoined", function (content) {
      var userUUID = content["UUID"] || null;
      createRemoteSocket(true, userUUID)
    })

    socket.on("currentAudioLvl", function (content) {
      var fromUUID = content["fromUUID"] || null;
      let currentAudioLvl = content["currentAudioLvl"] || 0;
      let perCent = currentAudioLvl * 50;
      $("#" + fromUUID).find(".userPlaceholder").css({ "border": "2px solid rgb(255 255 255 / " + perCent + "%)" });
    })



    socket.on("userDiscconected", function (userUUID) {
      delete allUserStreams[userUUID];
      $('audio' + userUUID).remove();
      updateUserLayout();
    })

    if (camOnAtStart) {
      navigator.getUserMedia({
        video: true,
        audio: true
      }, function (stream) { //OnSuccess
        startUserMedia()
      }, function (error) { //OnError
        console.log('getUserMedia error! Got this error: ', error);
      });
    } else {
      startUserMedia()
    }

    function startUserMedia() {
      navigator.getUserMedia({
        video: false, // { 'facingMode': "user" }
        audio: { 'echoCancellation': true, 'noiseSuppression': true }
      }, function (stream) { //OnSuccess
        webRTCConfig["stream"] = stream;
        console.log('getUserMedia success! Stream: ', stream);

        var audioTracks = stream.getAudioTracks();

        if (audioTracks.length >= 1) {
          allUserStreams[MY_UUID] = {
            audiostream: stream,
            username: username
          }
        }

        if (audioTracks.length > 0) {
          console.log('Using audio device: ' + audioTracks[0].label);
          calcCurrentVolumeLevel(stream, function (currentAudioLvl) {
            socket.emit('currentAudioLvl', currentAudioLvl);
            var fromUUID = MY_UUID || null;
            let perCent = currentAudioLvl * 50;
            $("#" + fromUUID).find(".userPlaceholder").css({ "border": "2px solid rgb(255 255 255 / " + perCent + "%)" });
          });
        }

        joinRoom();
        updateUserLayout();
        if (camOnAtStart) { //enable cam on start if set
          setTimeout(function () {
            $("#addRemoveCameraBtn").click();
          }, 1000)
        }

      }, function (error) { //OnError
        alert("Could not get your Mic! You need at least one Mic!")
        console.log('getUserMedia error! Got this error: ', error);
      });
    }
  })
});

$(window).on("beforeunload", function () {
  if (socketConnected) {
    socket.emit('closeConnection', null);
  }
})

document.addEventListener('keydown', ev => {
  if (ev.key === "Escape") {
    const screenshareDialog = document.querySelector('div.screenshare-select-dialog-backdrop')
    if (!screenshareDialog.hidden) {
      const cancelButton = screenshareDialog.querySelector('#cancel-screenshare-select')
      cancelButton.click()
    }
  }
})

$(document).ready(function () {
  $("#muteUnmuteMicBtn").click(function () {
    if (!micMuted) {
      $("#muteUnmuteMicBtn").html('<i class="fas fa-microphone-alt-slash"></i>');
      if (allUserStreams[MY_UUID] && allUserStreams[MY_UUID]["audiostream"]) {
        allUserStreams[MY_UUID]["audiostream"].getAudioTracks()[0].enabled = false;
      }
    } else {
      $("#muteUnmuteMicBtn").html('<i class="fas fa-microphone-alt"></i>');
      if (allUserStreams[MY_UUID] && allUserStreams[MY_UUID]["audiostream"]) {
        allUserStreams[MY_UUID]["audiostream"].getAudioTracks()[0].enabled = true;
      }
    }
    micMuted = !micMuted;
  })

  $("#addRemoveChatBtn").click(function () {

    if (chatActive) {
      $("#chatDiv").hide();
      $("#addRemoveChatBtn").css({ color: "black" });
      chatActive = false;
    } else {
      $("#addRemoveChatBtn").css({ color: "#030356" });
      $("#chatDiv").show();
      chatActive = true;
      $("#chatInputText").focus();
    }

  })

  $("#chatSendBtn").click(function () {
    sendMsg()
  })

  $(document).on('keypress', function (e) {
    if (e.which == 13 && $("#chatSendBtn").is(":visible")) {
      sendMsg();
    }
  });

  function sendMsg() {
    console.log("send")
    let msg = $("#chatInputText").val().trim();
    socket.emit('sendMsg', msg);
    $("#chatInputText").val("")
  }

  $("#addRemoveScreenBtn").click(async function () {
    if (camActive) {
      $("#addRemoveCameraBtn").click();
    }
    if (!screenActive) {
      $("#addRemoveScreenBtn").css({ color: "#030356" });

      var config = {
        screen: true
      };

      try {
        if (window.x_extended && window.x_extended.desktopCapturer) {
          var desktopCapturer = window.x_extended.desktopCapturer;
          desktopCapturer.getSources({ types: ['window', 'screen'] }).then(async sources => {
            try {
              const sourceid = await electron_select_screen_to_share(sources)
              const source = sources.find(({ id }) => id == sourceid)
              const stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                  mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: source.id
                  }
                }
              })
              handleScreenStream(stream)
            } catch (e) {
              console.error(e)
              handleError(e)
            }
          })

        } else {
          stream = await _startScreenCapture();
          handleScreenStream(stream)
        }

        async function handleScreenStream(stream) {
          for (var i in pcs) { //Add stream to all peers
            pcs[i].addStream(stream);
          }

          console.log('getUserMedia success! Stream: ', stream);
          console.log('LocalStream', stream.getVideoTracks());

          var videoTracks = stream.getVideoTracks();

          if (videoTracks.length >= 1) {
            allUserStreams[MY_UUID] = allUserStreams[MY_UUID] ? allUserStreams[MY_UUID] : {};
            allUserStreams[MY_UUID]["videostream"] = stream;
          }

          if (videoTracks.length > 0) {
            console.log('Using video device: ' + videoTracks[0].label);
          }
          screenActive = true;
          updateUserLayout();
        }

      } catch (e) {
        console.log('getUserMedia error! Got this error: ', e);
        alert("Could not get your Screen!")
        $("#addRemoveScreenBtn").css({ color: "black" });
        return;
      }

      function _startScreenCapture() {
        if (navigator.getDisplayMedia) {
          return navigator.getDisplayMedia(config);
        } else if (navigator.mediaDevices.getDisplayMedia) {
          return navigator.mediaDevices.getDisplayMedia(config);
        } else {
          return navigator.mediaDevices.getUserMedia(config);
        }
      }

    } else {
      $("#addRemoveScreenBtn").css({ color: "black" });
      for (var i in pcs) { //remove stream from all peers
        pcs[i].removeStream(allUserStreams[MY_UUID]["videostream"]);
      }
      const tracks = allUserStreams[MY_UUID]["videostream"].getVideoTracks()
      tracks.forEach(track => track.stop())
      delete allUserStreams[MY_UUID]["videostream"];
      socket.emit('removeCamera', true)
      updateUserLayout();
      screenActive = false;
    }
  });

  $("#addRemoveCameraBtn").click(function () {
    if (screenActive) {
      $("#addRemoveScreenBtn").click();
    }


    if (!camActive) {
      $("#addRemoveCameraBtn").css({ color: "#030356" });
      navigator.getUserMedia({
        video: { 'facingMode': "user" },
        audio: false
      }, function (stream) { //OnSuccess
        for (var i in pcs) { //Add stream to all peers
          pcs[i].addStream(stream);
        }

        console.log('getUserMedia success! Stream: ', stream);
        console.log('LocalStream', stream.getVideoTracks());

        var videoTracks = stream.getVideoTracks();

        if (videoTracks.length >= 1) {
          allUserStreams[MY_UUID] = allUserStreams[MY_UUID] ? allUserStreams[MY_UUID] : {};
          allUserStreams[MY_UUID]["videostream"] = stream;
        }

        if (videoTracks.length > 0) {
          console.log('Using video device: ' + videoTracks[0].label);
        }

        updateUserLayout();
        camActive = true;
      }, function (error) { //OnError
        alert("Could not get your Camera! Be sure you have one connected and it is not used by any other process!")
        console.log('getUserMedia error! Got this error: ', error);
        $("#addRemoveCameraBtn").css({ color: "black" });
      });
    } else {
      $("#addRemoveCameraBtn").css({ color: "black" });
      for (var i in pcs) { //remove stream from all peers
        pcs[i].removeStream(allUserStreams[MY_UUID]["videostream"]);
      }
      if (allUserStreams[MY_UUID]["videostream"]) {

        const tracks = allUserStreams[MY_UUID]["videostream"].getVideoTracks()
        tracks.forEach(track => track.stop())
      }
      delete allUserStreams[MY_UUID]["videostream"];
      socket.emit('removeCamera', true)
      updateUserLayout();
      camActive = false;
    }
  });


  $("#cancelCallBtn").click(function () {
    if (window.x_extended && typeof window.x_extended.close === "function") { //Close window if we run in electron app
      window.x_extended.close()
    } else {
      $('body').append('<div id="topDiv"></div>');
      $('body').append('<div id="centerDiv"></div>');
      $('body').append('<div id="bottomDiv"></div>');

      $('div#topDiv').animate({
        //51% for chrome
        height: "50%"
        , opacity: 1
      }, 500);
      $('div#bottomDiv').animate({
        //51% for chrome
        height: "50%"
        , opacity: 1
      }, 500, function () {
        $('div#centerDiv').css({ display: "block" }).animate({
          width: "0%",
          left: "50%"
        }, 400, function () {
          setTimeout(function () {
            location = "./endcall.html";
          }, 500)
        });
      }
      );
    }
  })
})

//This is where the WEBRTC Magic happens!!!
function createRemoteSocket(initiator, UUID) {
  pcs[UUID] = new initEzWebRTC(initiator, webRTCConfig); //initiator
  pcs[UUID].on("signaling", function (data) {
    socket.emit("signaling", { destUUID: UUID, signalingData: data })
  })
  pcs[UUID].on("stream", function (stream) {
    gotRemoteStream(stream, UUID)
  });
  pcs[UUID].on("streamremoved", function (stream, kind) {
    console.log("STREAMREMOVED!")
    if (kind == "video") {
      delete allUserStreams[UUID]["videostream"];
      updateUserLayout();
    }
  });
  pcs[UUID].on("closed", function (stream) {
    delete allUserStreams[UUID];
    $('audio' + UUID).remove();
    updateUserLayout();
    console.log("disconnected!");
  });
  pcs[UUID].on("connect", function () {
    if (allUserStreams[MY_UUID]["videostream"]) {
      setTimeout(function () {
        pcs[UUID].addStream(allUserStreams[MY_UUID]["videostream"])
      }, 500)
    }
  });
  pcs[UUID].on("iceFailed", function () {
    console.log("Error: Ice failed to to UUID: ", UUID);
  });
}

function gotRemoteStream(stream, UUID) {
  var videoTracks = stream.getVideoTracks();
  var audioTracks = stream.getAudioTracks();

  console.log("videoTracks", videoTracks)
  console.log("audioTracks", audioTracks)

  $("#" + UUID).remove();
  allUserStreams[UUID] = allUserStreams[UUID] ? allUserStreams[UUID] : {};
  if (videoTracks.length >= 1) { //Videosteam
    allUserStreams[UUID]["videostream"] = stream;
  } else {
    allUserStreams[UUID]["audiostream"] = stream;
  }

  updateUserLayout();
};

function updateUserLayout() {
  if (document.fullscreenElement) { //Dont do things on fullscreen
    return;
  }
  var streamCnt = 0;
  var allUserDivs = {};
  for (var i in allUserStreams) {
    var userStream = allUserStreams[i];
    streamCnt++;

    var uDisplay = userStream["username"] && userStream["username"] != "NA" ? userStream["username"].substr(0, 2).toUpperCase() : i.substr(0, 2).toUpperCase();
    var userDiv = $('<div class="videoplaceholder" style="position:relative;" id="' + i + '">' +
      '<div class="userPlaceholderContainer" style="width:100%; height:100%; position:absolute; overflow:hidden; background: #474747;">' +
      '<div class="userPlaceholder">' + uDisplay + '</div>' +
      '</div>' +
      '</div>')

    if (userStream["audiostream"] && i !== MY_UUID) {
      if ($("#audioStreams").find('#audio' + i).length == 0) {
        let audioDiv = $('<div id="audio' + i + '" style="display:none;"><audio autoplay></audio></div>');
        audioDiv.find("audio")[0].srcObject = userStream["audiostream"];
        $("#audioStreams").append(audioDiv);
      }
    }

    if (userStream["videostream"]) {
      var mirrorStyle = ""
      if (i == MY_UUID && !screenActive) {
        mirrorStyle = "transform: scaleX(-1);"
      }
      var userDisplayName = userStream["username"] && userStream["username"] != "NA" ? (userStream["username"].charAt(0).toUpperCase() + userStream["username"].slice(1)) : i.substr(0, 2).toUpperCase();
      userDiv.append(`<div class="userCont" style="position: absolute; width: 100%; height: 100%;">
          <div id="video${i}" style="top: 0px; width: 100%;">
            <div style="position: absolute; color: white; top: 7px; left: 7px; font-size: 1.3em; z-index:10; text-shadow: 1px 0 0 #000, 0 -1px 0 #000, 0 1px 0 #000, -1px 0 0 #000;">
              ${userDisplayName}
            </div>
            <video style="${mirrorStyle}" autoplay muted></video>
            <button title="Enable Picture in Picture" style="cursor:pointer; position:absolute; top:5px; right:10px; background:transparent; border:0px;" class="pipBtn">
              <img style="width: 30px;" src="./images/picInPic.png">
            </button>
          </div>
        </div>`);
      userDiv.find("video")[0].srcObject = userStream["videostream"];
      userDiv.find(".userPlaceholderContainer").hide();

      if(mirrorStyle != "" || !document.pictureInPictureEnabled) {
        userDiv.find(".pipBtn").hide();
      }

      userDiv.find(".pipBtn").click(function () {
        if (document.pictureInPictureElement) {
          document.exitPictureInPicture();
        } else {
          if (document.pictureInPictureEnabled) {
            userDiv.find("video")[0].requestPictureInPicture();
          }
        }
      });

      userDiv.on

      if (i != MY_UUID) {
        userDiv.find("video").css({ "cursor": "pointer" })
        userDiv.find("video").click(function () {
          openFullscreen(this);
        })
      }
    }

    allUserDivs[i] = userDiv;
  }

  $("#mediaDiv").empty();

  if (streamCnt == 2) { //Display 2 users side by side
    for (var i in allUserDivs) {
      if (i == MY_UUID) {
        allUserDivs[i].css({ width: '20%', height: '30%', position: 'absolute', left: '20px', bottom: '30px', 'z-index': '1' });
      } else {
        allUserDivs[i].css({ width: '100%', height: '100%', float: 'left' });
      }

      $("#mediaDiv").append(allUserDivs[i])
    }

  } else {
    var lineCnt = Math.round(Math.sqrt(streamCnt));
    for (var i = 1; i < lineCnt + 1; i++) {
      $("#mediaDiv").append('<div id="line' + i + '"></div>')
    }
    let userPerLine = streamCnt <= 2 ? 1 : Math.ceil(streamCnt / lineCnt);
    let cucnt = 1;
    for (var i in allUserDivs) {
      var cLineNr = Math.ceil(cucnt / userPerLine);
      allUserDivs[i].css({ width: 100 / userPerLine + '%', height: 100 / lineCnt + '%', float: 'left' });
      $("#line" + cLineNr).append(allUserDivs[i])
      cucnt++;
    }

    var lastLineElsCnt = $("#line" + lineCnt).find(".videoplaceholder").length;
    // console.log(lastLineElsCnt, userPerLine)
    if (lastLineElsCnt != userPerLine) {
      var p = (100 / userPerLine) / 2;
      $("#line" + lineCnt).find(".videoplaceholder").css({ "left": p + "%" })
    }
  }

  $.each($(".userCont"), function () {
    var w = $(this).width();
    var h = $(this).height();
    $(this).find("video").css({ "max-width": w + 'px', "max-height": h + 'px' })
    $(this).find("video")[0].play();
  })
}

function joinRoom() {
  //Only join the room if local media is active!
  var roomname = getUrlParam("roomname", "unknown");
  socket.emit("joinRoom", { roomname: roomname, username: username }, function () {
    console.log("joined room", roomname)
  });
}

var resizeTimeout = null;
window.onresize = function (event) {
  if (resizeTimeout) {
    clearTimeout(resizeTimeout);
  }

  resizeTimeout = setTimeout(function () {
    updateUserLayout();
  }, 2000)
};

//Secreenshare On Browser
function openFullscreen(elem) {
  if (elem.requestFullscreen) {
    elem.requestFullscreen();
  } else if (elem.mozRequestFullScreen) { /* Firefox */
    elem.mozRequestFullScreen();
  } else if (elem.webkitRequestFullscreen) { /* Chrome, Safari and Opera */
    elem.webkitRequestFullscreen();
  } else if (elem.msRequestFullscreen) { /* IE/Edge */
    elem.msRequestFullscreen();
  }
}

//Screenshare in Electron
/**
 * @returns Promise<stream id to share>
 */
async function electron_select_screen_to_share(sources) {
  const screenshareDialog = document.querySelector('div.screenshare-select-dialog-backdrop')

  let fail, success;
  const resultPromise = new Promise((resolve, reject) => {
    fail = reject
    success = resolve
  })

  const options = screenshareDialog.querySelector("div.screenshare-options")
  // remove old options
  while (options.firstChild) {
    options.removeChild(options.firstChild);
  }
  const closeCallback = (screenid) => {
    screenshareDialog.hidden = true
    success(screenid)
  }
  // add new options
  for (let source of sources) {
    console.log(source)
    const option = document.createElement('div')
    option.classList.add('screenshare-option')
    const thumbnail = document.createElement('img')
    thumbnail.classList.add('thumbnail')
    //thumbnail.style = 'background-image: url(' + source.thumbnail.toDataURL() + ');'
    thumbnail.src = source.thumbnail.toDataURL()
    thumbnail.title = source.id
    option.appendChild(thumbnail)
    const name = document.createElement('p')
    name.innerText = source.name
    name.title = source.name
    option.appendChild(name)
    option.onclick = closeCallback.bind(null, source.id)
    options.appendChild(option)
  }

  const cancelButton = screenshareDialog.querySelector('#cancel-screenshare-select')
  cancelButton.onclick = _ => {
    screenshareDialog.hidden = true
    fail(new Error("User canceled"))
  }

  screenshareDialog.hidden = false
  return resultPromise
}