[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/Amit-A/aws-es-kibana)

# AWS ES/Kibana Proxy

AWS ElasticSearch/Kibana Proxy to access your [AWS ES](https://aws.amazon.com/elasticsearch-service/) cluster.

This is the solution for accessing your cluster if you have [configured access policies](http://docs.aws.amazon.com/elasticsearch-service/latest/developerguide/es-createupdatedomains.html#es-createdomain-configure-access-policies) for your ES domain

## Why the fork

This is a simpler version of [aws-es-kibana](https://github.com/santthosh/aws-es-kibana) that just works.

## Usage

Run the docker container:

	docker run \
    -e AWS_ACCESS_KEY_ID='<Key ID>' \
    -e AWS_SECRET_ACCESS_KEY='<Key>' \
    -p 127.0.0.1:9200:9200 \
    Amit-A/aws-es-kibana -b 0.0.0.0 <cluster-endpoint>

If you want to protect your endpoint with basic auth, add:

    -e USER='<HTTP Auth Username>' \
    -e PASSWORD='<HTTP Auth Password>' \

## Credits

Adopted from this [gist](https://gist.github.com/nakedible-p/ad95dfb1c16e75af1ad5). Thanks [@nakedible-p](https://github.com/nakedible-p)
