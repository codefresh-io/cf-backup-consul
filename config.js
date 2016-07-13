/**
 * Default config file for local env - to be replaces by configuration manager
 */
path = require('path');

var config = {
    consul: {
        host: 'consul',
        port: '8500',
        aclToken: ''
    },
    tmpdir: '/tmp/consul-backup',
    s3bucket: 'cf-backup-consul'
};

module.exports = config;
