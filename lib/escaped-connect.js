var _ = require('underscore');
var proxy = new (require('http-proxy').RoutingProxy);
var urlu = require('url');

var defaults = {
	site: null,
	render: 'http://escapedfragment.com'
};

module.exports = function(options) {
	options = _.defaults(options, defaults);

	if (options.site) {
		options.site = urlu.parse(options.site);
	}

	options.render = urlu.parse(options.render);

	return function(req, res, next) {
		if (req._escaped) return next();
		req._escaped = true;

		if (!/_escaped_fragment_=/.test(req.url)) {
			return next();
		}

		var site = options.site;

		if (!site) {
			var url = urlu.parse(req.url);
			site = urlu.parse('http:' + '//' + req.headers['host'] + url.pathname + url.search);
		}

		req.headers['X-Escaped-Site'] = site.protocol + '//' + site.host;

		proxy.proxyRequest(req, res, {
			host: options.render.hostname,
			port: options.render.port
		});

		proxy.on('end', next);
	}
};
