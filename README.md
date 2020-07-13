# basicWebRTC

Basic p2p group webRTC 

## Install ##

1. run: npm i
2. run: node server.js
3. surf to: https://IP:3001


Set own ice Servers at: /iceservers.json

### All get parameters ###
* `username` -> Change your username shown
* `roomname` -> Change the name of the room
* `camon` -> Start session with cam on
* `socketDomain` -> Change if you want to use a different socketServer
* `base64domain` -> true if socketDomain is given in base64 format

Example: change the roomname: https://IP:3001/?roomname=yourSecretRoom&camon=true
