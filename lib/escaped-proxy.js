var log = new (require('log'));
var _ = require('underscore');
var http = require('http');
var proxy = new (require('http-proxy').RoutingProxy);
var url = require('url');

var defaults = {
	render: 'http://localhost:8050',
	site: 'http://localhost:8080',
	port: 80,
	filter: /\?_escaped_fragment_=/
};

module.exports = function(options) {
	options = _.defaults(options, defaults);

	var escaped = {
		options: options,

		sendError: function(res, msg, code) {
			code = code || 503;
			msg = msg || "Unable to render.";

			log.error("Sending error to client,", code, ":", msg);

			res.writeHead(code, { 'Content-Type': 'text/plain' });
			res.end(msg);
		},

		renderClient: function(req, res) {
			if (req.method != 'GET') {
				escaped.sendError(res, 'Unable to accept request for rendering with http method ' + req.method);
				return;
			}

			if (req.headers['X-Escaped-Site']) {
				escaped.sendError(res, 'Unable to accept possibly circular request for ' + req.headers['X-Escaped-Site']);
				return;
			}

			log.info('Proxying request ' + req.url + ' for rendering to ' + options.render.href);

			req.headers['X-Escaped-Site'] = options.site.protocol + '//' + options.site.host;

			proxy.proxyRequest(req, res, {
				host: options.render.hostname,
				port: options.render.port
			});
		},

		siteClient: function(req, res) {
			log.info('Proxying request ' + req.url + ' to real site ' + options.site.href);

			proxy.proxyRequest(req, res, {
				host: options.site.hostname,
				port: options.site.port
			});
		},

		handleClient: function(req, res) {
			if (options.filter.test(req.url)) {
				escaped.renderClient(req, res);
			} else {
				escaped.siteClient(req, res);
			}
		}
	};

	if (typeof options.site == 'string') {
		options.site = url.parse(options.site);
	}

	if (typeof options.render == 'string') {
		options.render = url.parse(options.render);
	}

	escaped.server = http.createServer(escaped.handleClient);

	log.info("Listening on " + options.port);
	escaped.server.listen(options.port);

	return escaped;
};