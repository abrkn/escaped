var _ = require('underscore');
var proxy = new (require('http-proxy').RoutingProxy);
var urlu = require('url');
var log = new (require('log'));

var defaults = {
	site: null,
	//render: 'http://escapedfragment.com'
	render: 'http://vidlink.eu:4500',
	spiderTrap: false,
	spiderTraps: /^\/?$/,
	spiders: /(googlebot|msnbot|bingbot|slurp|yahoo|ask\.com|gigabot|speedy|mediapartners)/i,
	includeLocal: false
};

module.exports = function(options) {
	options = _.defaults(options || {}, defaults);

	if (options.site) {
		options.site = urlu.parse(options.site);
	}

	options.render = urlu.parse(options.render);

	return function(req, res, next) {
		if (req._escaped) return next();
		req._escaped = true;

		if (/\?_escaped_fragment_=/.test(req.url)) {
			log.debug("Proxying fragment url: " + req.url);
		} else if (options.spiderTrap && req.headers['user-agent'] && options.spiders.test(req.headers['user-agent']) && options.spiderTraps.test(req.url)) {
			log.info("Spider trapping " + req.headers["user-agent"] + " for url " + req.url);
		} else {
			return next();
		}

		var site = options.site;

		if (!site) {
			var url = urlu.parse(req.url);
			site = urlu.parse('http:' + '//' + req.headers['host'] + url.pathname + url.search);
		}

		if (/^(localhost|127\.0\.0\.1)$/.test(site.hostname) && !options.includeLocal) {
			log.info("Skipping localhost.");
			return next();
		}

		req.headers['X-Escaped-Site'] = site.protocol + '//' + site.host;

		proxy.proxyRequest(req, res, {
			host: options.render.hostname,
			port: options.render.port
		});
	}
};
