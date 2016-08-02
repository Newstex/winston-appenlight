# winston-appenlight
AppEnlight Transport for Winston

## Usage

Just like with any other Winston transport, this can be set up by passing it as a new "transport":

	var AppEnlight = require('winston-appenlight');

	var logger = new winston.Logger({
		transports: [
			new AppEnlight({
				level: 'info',
				namespace: 'MY_APP_NAMESPACE',
				key: 'MY_AE_KEY',
				host: 'OPTIONAL_AE_CUSTOM_URL', // Default https://api.appenlight.com/api/logs?protocol_version=0.5
				// Optional global tags to send along with every request
				tags: {
					app: 'OptionalAppName',
					node_env: process.env.NODE_ENV,
					// extra tags here
				},
			}),
		],
	});

However, if used in conjunction with *express-appenlight* you'll want to pass in the agent from express-appenlight as the second argument:

	var logger = new winston.Logger({
		transports: [
			new AppEnlight(APPENLIGHT_CONFIG, require('express-appenlight').agent),
		],
	});

This adds the *request_id* that's used in express-appenlight along with all log requests. If you have your own req.id already set, both express-appenlight and winston-appenlight will use that ID instead of generating a new one.


This can be very useful if you want to tie front-end logging with back-end logging:

	// Adds a request ID which will be used for winston
	// on the back-end, and allow us to use that same
	// request ID on any front-end logging
	app.use(function(req, res, next){
		req.id = uuid.v4();
		res.setHeader('X-Request-ID', req.id);
		next();
	});
