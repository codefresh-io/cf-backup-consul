#!/usr/bin/env node
'use strict'
var config = require('./config');
var Q = require('q');
var request = require('request');
var fs = require('fs');
var path    = require('path');
var util = require('util');

// set logger
var winston = require('winston');
var logger = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)({
            timestamp: function() {return new Date().toISOString().replace(/T|Z/g, " ").trim();}
        })]
});

function restoreCatalog(nodesBackup, pattern){
    return Q.all(nodesBackup.map((node) => Q.delay(Math.floor(Math.random() * 1000))
        .then(() => {

            var nodeName    = node.Node.Node;
            var nodeAddress = node.Node.Address;
            if (pattern && !nodeName.match(pattern)) {
                console.log(util.format("Node %s is filtered", nodeName));
                return Q.resolve(true);
            }
            // logger.info("node = ", node) ;

            var services = Object.keys(node.Services).map(serviceId => node.Services[serviceId]);
            return Q.all(services.map(service => {
                                          return Q.resolve({
                                                               "Node":            nodeName,
                                                               "Address":         nodeAddress,
                                                               "TaggedAddresses": node.Node.TaggedAddresses,
                                                               "Service":         {
                                                                   "Service": service.Service,
                                                                   "ID":      service.ID,
                                                                   "Tags":    service.Tags || [],
                                                                   "Address": service.Address,
                                                                   "Port":    service.Port
                                                               }
                                                           }
                                                  )
                                                  .then(nodeServiceDef => {
                                                            var reqObj = {
                                                                headers: { 'content-type': 'application/json' },
                                                                url:     util.format('http://%s:%s/v1/catalog/register',
                                                                                     config.consul.host,
                                                                                     config.consul.port
                                                                ),
                                                                body:    JSON.stringify(nodeServiceDef)
                                                            };
                                                            return Q.nfcall(request.put, reqObj );
                                                            //return Q.resolve([200, 'true']);
                                                        }
                                                  )
                                                  .then(function (servRegisterResp) {
                                                            // consul response body servRegisterResp[1] should be 'true'
                                                            var servRegisterRespBody = servRegisterResp[1];
                                                            if (servRegisterRespBody === 'true') {
                                                                logger.info("Node Service has been registered in Consul: " + nodeName + "\n" + service );
                                                                return Q.resolve();
                                                            }
                                                            else {
                                                                return Q.reject(Error(servRegisterRespBody || 'empty consul response'));
                                                            }
                                                        }
                                                  )
                                      }
                         )
                    )
                    .catch(error => {
                               console.log("ERROR: node = ", nodeName, error.stack + "\n");
                               return Q.reject(error);
                           }
                    )
        }
    )));
}

function restoreKv(kvBackup, pattern) {
    return Q.all(kvBackup.map((kv) => Q.delay(Math.floor(Math.random() * 1000))
            .then(() => {

                      var key    = kv.Key;
                      var value = new Buffer(kv.Value, 'base64').toString() ;
                      if (pattern && !key.match(pattern)) {
                          console.log(util.format("Kv %s is filtered", key));
                          return Q.resolve(true);
                      }
                      var reqObj = {
                            url: util.format('http://%s:%s/v1/kv/%s', config.consul.host, config.consul.port, key),
                            body: value
                      };
                      //return Q.resolve([200, 'true'])
                      return Q.nfcall(request.put, reqObj )
                              .then(function (kvPutResp) {
                                        var kvPutRespBody = kvPutResp[1];
                                        if (kvPutRespBody === 'true') {
                                            logger.info("Kv has been put in Consul: " + key );
                                            return Q.resolve();
                                        }
                                        else {
                                            return Q.reject(Error(kvPutRespBody || 'empty consul response'));
                                        }
                                    }
                              );
                  }
            ).catch(error => {
                console.log("ERROR: key = ", kv, error.stack + "\n");
                return Q.reject(error);
            }
        )
    ));

}

function printUsage(){
   console.log(util.format("Usage: %s %s nodes|kv backup_file.json filterPattern", path.basename(process.argv[0]), path.basename(process.argv[1])));
}

var args = process.argv.slice(2);

if (args.length < 2 || args.length > 3) {
    printUsage();
    return;
}

var restoreType = args[0];
var backupFile = args[1];
var patternStr = args[2];

var backupObj = JSON.parse(fs.readFileSync(backupFile, 'utf8'));

var pattern = (patternStr ? new RegExp(patternStr) : undefined);

if (restoreType === 'nodes') {
    restoreCatalog(backupObj, pattern);
}
else if (restoreType === 'kv') {
    restoreKv(backupObj, pattern);
}


