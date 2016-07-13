'use strict';
var config = require('./config');
var Q = require('q');
var request = require('request');
var fs = require('fs');
var path    = require('path');
var util = require('util');
var dateformat = require('dateformat');
var AdmZip = require('adm-zip');
var os = require("os");

// set logger
var winston = require('winston');
var logger = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)({
            timestamp: function() {return new Date().toISOString().replace(/T|Z/g, " ").trim();}
        })]
});

class ConsulBackup {

    constructor() {
        this.fsPrefix = dateformat(new Date(), 'yyyy-mm-dd_H-MM-ss');
    }

    backupKv(){
        var self = this;
        return Q.all([
            Q.nfcall(request.get, util.format('http://%s:%s/v1/kv/?recurse', config.consul.host, config.consul.port))
                .then(kvResp => Q.resolve(kvResp[0].body)),
            Q.nfcall(request.get, {json: true, url: util.format('http://%s:%s/v1/catalog/nodes', config.consul.host, config.consul.port)})
                .then(nodesResp => Q.resolve(nodesResp[1]))
                .then(nodesData => {
                    return Q.all(nodesData.map((node) => Q.delay(Math.floor(Math.random() * 1000))
                                        .then(() => Q.nfcall(request.get, {json:true, url:util.format('http://%s:%s/v1/catalog/node/%s', config.consul.host, config.consul.port, node.Node)}))
                                        .then(nodesServicesResp => {
                                            return Q.resolve(nodesServicesResp[0].body )})
                    ))}
                )
                .then(nodesServicesObj => Q.resolve(JSON.stringify(nodesServicesObj)))
        ])
        .spread(function(kvData, nodesData){
            // Creating Zip file
            var kvFile = self.fsPrefix + '-kv.json';
            var nodesServicesFile = self.fsPrefix + '-nodes_services.json';
            var consulBackupFile = path.join(config.tmpdir, util.format('consul-backup-%s-%s.zip', self.fsPrefix, os.hostname()));
            var zip = new AdmZip();
            zip.addFile(kvFile, new Buffer(kvData));
            zip.addFile(nodesServicesFile, new Buffer(nodesData));
            return Q.ninvoke(zip, 'writeZip', consulBackupFile);
        })
        .catch(error => {
                logger.error(error.stack + "\n" );
            }
        );
    }
}

var Backup = new ConsulBackup();
Backup.backupKv();