Codefresh Consul backup to S3 bucket

config.js define consul address and s3 bucket


docker run example:

-----------
docker run --rm -v "/opt/codefresh/cf-backup-consul/aws-credentials:/root/.aws/credentials:ro" \
-v "/opt/codefresh/cf-backup-consul/config.js:/cf-backup-consul/config.js:ro" --net=host codefresh/cf-backup-consul:develop