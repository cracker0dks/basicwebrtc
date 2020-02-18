#!/bin/bash
echo "GOGO FOR THE LIVE BUILD!"
cd /home/basicwebrtc
git pull origin master
docker build -t basicwebrtc .
docker rm -f basicwebrtc
docker run --name=basicwebrtc --net=dockernet --restart=always -d basicwebrtc
echo "-<-<-< DONE ->->->"
echo "REMOVING UNTAGged DOCKER IMAGES"
docker rmi -f $(docker images | grep "<none>" | awk "{print \$3}")
