#!/bin/bash
set -e

echo "* * * * *

  Installing dependencies...

* * * * *"

npm install

echo "* * * * *

  Building, tagging, and pushing the docker image...

* * * * *"

docker login -u $DOCKER_ID -p $DOCKER_PASSWORD
docker build . --tag $DOCKER_ID/aws-es-kibana:$TRAVIS_COMMIT --tag $DOCKER_ID/aws-es-kibana:latest --compress
docker push $DOCKER_ID/aws-es-kibana:$TRAVIS_COMMIT

echo "* * * * *

  Done!

* * * * *"