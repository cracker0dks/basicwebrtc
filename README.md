# basicWebRTC

Setup your own Videoconference Server for 1on1 and group calls! All Calls are encrypted Peer 2 Peer!

## Functions
* Audio
* Video
* 1on1 and group Calls
* Screenshare

## Install ##

1. Install node and clone this repo
2. run: npm i
3. run: node server.js
4. surf to: http://IP:3001

### All User parameters ###
* `username` -> Change your username shown
* `roomname` -> Change the name of the room
* `camon` -> Default is on. Set to false to start session audio only
* `socketdomain` -> Change if you want to use a different socketServer (Can also include path: `https://domainname.tld/path/sub/`)
* `base64domain` -> true if socketDomain is given in base64 format

Example: change the roomname: https://IP:3001/#roomname=yourSecretRoom

### Config Server Listen IP & Port

Change the env variables: listen_ip ("0.0.0.0" default) and listen_port (3001 default)

### Behind a nginx reverse Proxy
```
location /basicwebrtc/ {
	resolver 127.0.0.1 valid=30s;
	proxy_set_header HOST $host;
	proxy_http_version 1.1;
	proxy_set_header Upgrade $http_upgrade;
	proxy_set_header Connection upgrade;
	proxy_pass http://127.0.0.1:8080/;
}
```
## STUN and TURN Configuration ##
If your clients are behind firewalls you might need to setup a TURN Server so the connection can fallback to that (Connection is e2e encrypted in any case).

If you have your STUN/TURN Server, isert the urls into:
/iceservers.json

### Setup your own TURN Server with docker ###
This setup is using COTURN inside docker.
The server is listening on Ports 443 and 4433 because on many firewalls only webtraffic is allowed. So you need to set this up on a second server.

If your server ip is 10.10.10.10 and your want to name it "myturnserver" run it like this:

Run `docker run -d --net=host --restart=always rofl256/turnserver usernameAdmin passwordAdmin realm "10.10.10.10" "10.10.10.10" "10.10.10.10" authSecret`

Don't forget to change the admin username, password and authSecret. 

For more configurations of this  take a look at repo of the container (https://github.com/cracker0dks/turn-server-docker-image) and the COTURN repo itself: https://github.com/coturn/coturn

If you have the turn server running, make a new entry into /iceservers.json
```
[
    {
        "url": "stun:10.10.10.10:443"
    },
    {
        "url": "turn:10.10.10.10:443",
        "turnServerCredential": "authSecret",
        "username": "webrtcuser"
    }
]
```
Change the ips and authSecret as defined on docker run. The username can be set to anything you want or leave it like this then restart the basicwebrtc server.
