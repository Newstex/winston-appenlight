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

winston.transports.AppEnlight = function (options, logger) {
	winston.Transport.call(this, _.pick(options, 'level'));

	// Default options
	this.defaults = {
		log_level: 'info',
		namespace: 'node',
		tags: {},
		extra: [],
	};

	// For backward compatibility with deprecated `globalTags` option
	options.tags = options.tags || options.globalTags;
	this.options = _.defaultsDeep(options, this.defaults);

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
	meta = meta || {};
	var request_id = meta.request_id;
	if(meta.req && meta.req.id){
		request_id = meta.req.id;
	}
	// Add Meta "tags"
	var tags = flattenObject(meta, _.toPairs(this.options.tags));

	if(request_id){
		tags.push(['request_id', request_id]);
	}

	try {
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
		request({
			method: 'POST',
			uri: this.options.host,
			headers: {
				'X-appenlight-api-key': this.options.key,
			},
			json: [{
				log_level: level,
				message: msg,
				namespace: this.options.namespace,
				request_id: request_id,
				server: require('os').hostname(),
				date: new Date().toISOString(),
				tags: tags,
			}],
		}, function(e,r,b){
			if(!/^OK/.test(b)){
				console.error('AppEnlight Error:', b);
			}
			callback(null, true);
		});
	} catch(err) {
		console.error(err);
		callback(null, true);
	}
};

module.exports = winston.transports.AppEnlight;
