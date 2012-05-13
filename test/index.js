require('should');
var request = require('request');
var http = require('http');
var log = new (require('log'));
var express = require('express');

describe("escaped-connect", function() {
	it("should not proxy everything", function(done) {
		after(function() {
			app.close();
			render.close();
		});

		var app = express.createServer();
		app.use(require('../lib/escaped-connect.js')({ render: 'http://localhost:9748' }));
		app.get('*', function(req, res, next) {
			res.end("not proxied");
		});
		app.listen(9749);

		var render = express.createServer();

		render.get("*", function(req, res) {
			res.end("proxied");
		});
		render.listen(9748);

		request({
			url: "http://localhost:9749"
		}, function(err, res, body) {
			if (err) return done(err);

			res.statusCode.should.equal(200);
			body.should.equal("not proxied");

			done();
		});
	});

	it("should proxy fragments", function(done) {
		after(function() {
			app.close();
			render.close();
		});

		var app = express.createServer();
		app.use(require('../lib/escaped-connect.js')({ render: 'http://localhost:9748' }));
		app.get('*', function(req, res, next) {
			res.end("not proxied");
		});
		app.listen(9749);

		var render = express.createServer();

		render.get("*", function(req, res) {
			res.end("proxied");
		});
		render.listen(9748);

		request({
			url: "http://localhost:9749/?_escaped_fragment_=key=value"
		}, function(err, res, body) {
			if (err) return done(err);

			res.statusCode.should.equal(200);
			body.should.equal("proxied");

			done();
		});
	});
});

describe('escaped-proxy', function() {
	var renderPort = 9521;
	var escapedPort = 9522;
	var escaped = null;
	var server = null;
	var sitePort = 9523;

	afterEach(function(done) {
		var next = function() {
			if (escaped == null && server == null) {
				done();
			}
		};

		if (!server && (!escaped || !escaped.server)) return done();

		if (escaped && escaped.server) {
			escaped.server.on("close", function() {
				escaped = null;
				next();
			});

			escaped.server.close();
		}

		if (server) {
			server.on("close", function() {
				server = null;
				next();
			});

			server.close();
		}
	});

	it('should proxy the correct requests for rendering', function(done) {
		var url = '/?_escaped_fragment_=key=value';

		server = http.createServer(function(req, res) {
			req.url.should.equal(url);
			req.headers.should.have.property('x-escaped-site');
			req.headers['x-escaped-site'].should.equal('http://localhost:' + sitePort);

			res.end('success');
		});

		server.listen(renderPort);

		escaped = require('../lib/escaped.js')({
			port: escapedPort,
			render: 'http://localhost:' + renderPort,
			site: 'http://localhost:' + sitePort
		});

		log.info("Requesting " + url);

		request('http://localhost:' + escapedPort + url, function(err, res, body) {
			if (err) return done(err);

			res.statusCode.should.equal(200);
			body.should.equal("success");

			done();
		});
	});

	it('should proxy the correct requests for non-rendernig', function(done) {
		var url = '/index.html?q=123';

		server = http.createServer(function(req, res) {
			req.url.should.equal(url);
			req.headers.should.not.have.property('x-escaped-site');

			res.end('success');
		});

		server.listen(sitePort);

		escaped = require('../lib/escaped-proxy.js')({
			port: escapedPort,
			render: 'http://localhost:' + renderPort,
			site: 'http://localhost:' + sitePort
		});

		log.info("Requesting " + url);

		request('http://localhost:' + escapedPort + url, function(err, res, body) {
			if (err) return done(err);

			res.statusCode.should.equal(200);
			body.should.equal("success");

			done();
		});
	});
});