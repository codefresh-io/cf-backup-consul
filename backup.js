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
var AWS = require('aws-sdk');

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
        this.consulBackupFile = util.format('consul-backup-%s-%s.zip', this.fsPrefix, os.hostname())
    }

    getKv(){
       return Q.nfcall(request.get, util.format('http://%s:%s/v1/kv/?recurse', config.consul.host, config.consul.port))
            .then(kvResp => Q.resolve(kvResp[0].body));
    }

    getNodesServices(){
        return  Q.nfcall(request.get, {json: true, url: util.format('http://%s:%s/v1/catalog/nodes', config.consul.host, config.consul.port)})
            .then(nodesResp => Q.resolve(nodesResp[1]))
            .then(nodesData => {
                return Q.all(nodesData.map((node) => Q.delay(Math.floor(Math.random() * 1000))
                .then(() => Q.nfcall(request.get, {json:true, url:util.format('http://%s:%s/v1/catalog/node/%s', config.consul.host, config.consul.port, node.Node)}))
                .then(nodesServicesResp => {
                    return Q.resolve(nodesServicesResp[0].body )})

                ))}
            )
            .then(nodesServicesObj => Q.resolve(JSON.stringify(nodesServicesObj)));
    }

    getServicesHealth() {
        return  Q.nfcall(request.get, {json: true, url: util.format('http://%s:%s/v1/catalog/services', config.consul.host, config.consul.port)})
            .then(serviceResp =>  Q.resolve(Object.keys(serviceResp[1])))
            .then(servicesList => {
                return Q.all(servicesList.map((service) => Q.delay(Math.floor(Math.random() * 1000))
                .then(() => Q.nfcall(request.get, {json:true, url:util.format('http://%s:%s/v1/health/service/%s', config.consul.host, config.consul.port, service)}))
                .then(serviceHealthResp => {
                    return Q.resolve(serviceHealthResp[0].body )})

                ))}
            )
            .then(serviceHealthObj => Q.resolve(JSON.stringify(serviceHealthObj)));
    }

    backupKv(){
        var self = this;
        return Q.all([ self.getKv(), self.getNodesServices(), self.getServicesHealth()])

        .spread(function(kvData, nodesData, serviceHealthData){
            // Creating Zip file
            var kvFile = self.fsPrefix + '-kv.json';
            var nodesServicesFile = self.fsPrefix + '-nodes_services.json';
            var servicesHealthFile = self.fsPrefix + '-services-health.json';

            var consulBackupZip = new AdmZip();
            consulBackupZip.addFile(kvFile, new Buffer(kvData));
            consulBackupZip.addFile(nodesServicesFile, new Buffer(nodesData));
            consulBackupZip.addFile(servicesHealthFile, new Buffer(serviceHealthData));
            return Q.resolve(consulBackupZip);
        })
        .then(function(consulBackupZip){

            var s3 = new AWS.S3();
            var s3UploadParams = {Bucket: config.s3bucket, Key: self.consulBackupFile, Body: consulBackupZip.toBuffer()};
            var options = {partSize: 10 * 1024 * 1024, queueSize: 1};
            logger.info(`Uploading file ${self.consulBackupFile} to s3:/${config.s3bucket}`);
            return Q.ninvoke(s3, 'upload', s3UploadParams);
        })
        .then((consulBackupFile) => logger.info(`Uploaded successfully - s3:/${config.s3bucket}/${self.consulBackupFile}`))
        .catch(error => {
                logger.error(error.stack + "\n" );
            }
        );
    }
}

logger.info("\nStarting consul backup ...");
var Backup = new ConsulBackup();
Backup.backupKv();