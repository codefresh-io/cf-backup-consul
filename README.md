# Codefresh Consul backup to S3 bucket and restore

config.js define consul address and s3 bucket

### Backup

docker run example:

```bash
docker run --rm -v "/opt/codefresh/cf-backup-consul/aws-credentials:/root/.aws/credentials:ro" \
-v "/opt/codefresh/cf-backup-consul/config.js:/cf-backup-consul/config.js:ro" --net=host codefresh/cf-backup-consul:develop
```

### Restore

##### download consul-backup-*-zip from s3

```bash
aws s3 cp s3://cf-backup-consul/google_production/consul-backup-2016-07-19_9-57-02-cf-usc1b-consul-3.zip /tmp/
unzip consul-backup-2016-07-19_9-57-02-cf-usc1b-consul-3.zip

```

##### restore 

set consul path in config.js

Usage: node restore.js nodes|kv backup_file.json filterPattern

Example:
```bash

# restore all nodes 
./restore.js nodes /tmp/2016-07-25_9-57-02-nodes_services.json 

# restore specific nodes by regexp
./restore.js nodes /tmp/2016-07-25_9-57-02-nodes_services.json 'docker-node-(0001|0005)'


# restore all kv
 ./restore.js kv ~/consul_restore/2016-07-25_9-57-02-kv.json 

# restore specific kv by regexp
 ./restore.js kv ~/consul_restore/2016-07-25_9-57-02-kv.json 'services/docker-node/(node-ironsource-52-19-18-28|.*-0001)'

```


