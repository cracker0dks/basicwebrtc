function initEzWebRTC(initiator, config, id) {
    var _this = this;

    var rtcConfig = { //Default Values
        offerOptions : {
            offerToReceiveAudio: true, //Want audio
            offerToReceiveVideo: true  //Want video
        },
        stream: null,
        'iceServers': [
            {
                "urls": "stun:stun.l.google.com:19302"
            }
        ]
    }
    if (config) {
        for (var i in config) {
            rtcConfig[i] = config[i];
        }
    }

    var pc = new RTCPeerConnection(rtcConfig);

    pc.onnegotiationneeded = async function () {
        if(initiator) {
            negotiate()
        } else {
            _this.emitEvent("signaling", "renegotiate"); //Request the initiator for renegotiation
        }
    }

    pc.onicecandidate = function (e) {
        if (!pc || !e || !e.candidate) return;
       _this.emitEvent("signaling", e.candidate)
    };

    pc.onaddstream = function (event) {
        _this.emitEvent("stream", event.stream)
    };

    pc.oniceconnectionstatechange = async function (e) {
        console.log('ICE state: ' + pc.iceConnectionState);
        if (pc.iceConnectionState == "connected") {
            _this.emitEvent("connect", true)
        } else if (pc.iceConnectionState == 'disconnected') {
            _this.emitEvent("disconnect", true)
        } else if (pc.iceConnectionState == 'failed' && initiator) { //Try to reconnect from initator side
            await pc.setLocalDescription(await pc.createOffer({ iceRestart: true }))
            _this.emitEvent("signaling", pc.localDescription)
        }
    };

    if (rtcConfig.stream) {
        pc.addStream(rtcConfig.stream); //Add stream at start, this will trigger negotiation on initiator
    } else if(initiator) { //start negotiation without a stream if we are initiator
        negotiate(); 
    }

    this.signaling = async function (signalData) { //Handle signaling
        if (signalData == "renegotiate") { //Got renegotiate request, so do it
            negotiate();
        } else if (signalData && signalData.type == "offer") { //Got an offer -> Create Answer)
            if (pc.signalingState != "stable") { //If not stable ask for renegotiation
                await Promise.all([
                    pc.setLocalDescription({ type: "rollback" }), //Be polite
                    await pc.setRemoteDescription(new RTCSessionDescription(signalData))
                ]);
            } else {
                await pc.setRemoteDescription(new RTCSessionDescription(signalData))
            }
            await pc.setLocalDescription(await pc.createAnswer(rtcConfig.offerOptions));
            _this.emitEvent("signaling", pc.localDescription)
        } else if (signalData && signalData.type == "answer") { //STEP 5 (Initiator: Setting answer and starting connection)
            pc.setRemoteDescription(new RTCSessionDescription(signalData))
        } else if (signalData && signalData.candidate) { //is a icecandidate thing
            pc.addIceCandidate(new RTCIceCandidate(signalData));
        } 
    }

    async function negotiate() {
        const offer = await pc.createOffer(rtcConfig.offerOptions); //Create offer
        if (pc.signalingState != "stable") return;
        await pc.setLocalDescription(offer);
        _this.emitEvent("signaling", pc.localDescription)
    }

    this.addStream = function(stream) {
        pc.addStream(stream);
    }

    this.mappedEvents = {};
    this.on = function (eventname, callback) {
        if (_this.mappedEvents[eventname]) {
            _this.mappedEvents[eventname].push(callback)
        } else {
            _this.mappedEvents[eventname] = [callback];
        }
    };

    this.emitEvent = function (eventname) {
        for (var i in this.mappedEvents[eventname]) {
            _this.mappedEvents[eventname][i](arguments[1], arguments[2], arguments[3])
        }
    };
    return this;
}