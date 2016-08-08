/**
 * AppEnlight transport.
 *
 * @author: Chris Moyer <cmoyer@newstex.com>
 */
'use strict';
var util = require('util');
var winston = require('winston');
var request = require('request');
var _ = require('lodash');
var Batcher = require('batcher');

winston.transports.AppEnlight = function (options, agent) {
	var self = this;
	winston.Transport.call(this, _.pick(options, 'level'));

	// Default options
	this.defaults = {
		log_level: 'info',
		namespace: 'node',
		tags: {},
		extra: [],
	};
	this.agent = agent;

	// For backward compatibility with deprecated `globalTags` option
	options.tags = options.tags || options.globalTags;
	this.options = _.defaultsDeep(options, this.defaults);

	// Allow queing up logs to send in a batch
	this.logBatch = new Batcher(5000); // Send once every 5 seconds
	this.logBatch.on('ready', function sendLogs(logs){
		try{
			request({
				method: 'POST',
				uri: self.options.host || self.options.base_url + '/logs?protocol_version=0.5',
				headers: {
					'X-appenlight-api-key': self.options.key,
				},
				json: logs,
			}, function(e,r,b){
				if(!/^OK/.test(b)){
					console.error('AppEnlight Log Error:', b);
				}
			});
		} catch(e){
			console.error('AppEnlight Log Exception:', e);
		}
	});


};

//
// Inherit from `winston.Transport` so you can take advantage
// of the base functionality and `.handleExceptions()`.
//
util.inherits(winston.transports.AppEnlight, winston.Transport);

//
// Expose the name of this Transport on the prototype
winston.transports.AppEnlight.prototype.name = 'AppEnlight';

/**
 * Takes a meta object and "flattens" it into dot-separated tags
 */
function flattenObject(meta, tags, prefix){
	_.forEach(meta, function(val, key){
		if(prefix){
			key = [prefix, key].join('.');
		}
		if(_.isObject(val)){
			flattenObject(val, tags, key);
		} else {
			tags.push([key, util.format(val)]);
		}
	});
	return tags;
}

winston.transports.AppEnlight.prototype.log = function (level, msg, meta, callback) {
	try {
		// Allow stripping out color codes from log messages
		if(this.options.decolorize){
			msg = msg.replace(/\u001b\[[0-9]{1,2}m/g, '');
		}
		meta = _.extend({}, meta);
		// Request ID can be passed in as metadata
		var request_id = meta.request_id;
		if(meta.req && meta.req.id){
			request_id = meta.req.id;
		}
		// Allow pulling the request ID right from the "AppEnlight Agent"
		if(!request_id && this.agent !== undefined && this.agent.currentTransaction !== undefined){
			request_id = this.agent.currentTransaction.req.id;
		}
		// Add Meta "tags"
		var tags = flattenObject(meta, _.toPairs(this.options.tags));

		if(request_id){
			tags.push(['request_id', request_id]);
		}

		if(level == 'error') {
			// Support exceptions logging
			if (meta instanceof Error) {
				if (msg == '') {
					msg = meta;
				} else {
					meta.message = msg + '. cause: ' + meta.message;
					msg = meta;
				}
			}
		}
		this.logBatch.push({
			log_level: level,
			message: msg,
			namespace: this.options.namespace,
			request_id: request_id,
			server: require('os').hostname(),
			date: new Date().toISOString(),
			tags: tags,
		});
	} catch(err) {
		console.error('AppEnlight Logging Error', err);
	}
	callback(null, true);
};

module.exports = winston.transports.AppEnlight;
