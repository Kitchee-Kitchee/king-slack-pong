var http = require('http');
var url = require('url');
var querystring = require('querystring');

function Client(serverUrl){
    var parsed_url = url.parse(serverUrl);
    this.request_options = {
        protocol: parsed_url.protocol,
        port: parsed_url.port,
        pathname: parsed_url.pathname,
        headers: {
            "Content-Type": "application/json"
        }
    };
    this.headers = {
        "Content-Type": "application/json"
    };
}

Client.prototype.get = function(path, parameters, options, callback){
    var opts = {
        method: 'GET'
    };
    Object.assign(opts, this.request_options, options);
    var query = querystring.stringify(parameters);
    opts.pathname = opts.pathname + path + '?' + query;
    var req = http.request(opts, callback);
    req.end();
}

function createMethodRequest(method){
    return function(path, parameters, options, callback, errCallback){
        var opts = {
            method: method
        };

        Object.assign(opts, this.request_options, options);
        opts.pathname = opts.pathname + path;

        var req = http.request(opts, callback);
        req.on('error', errCallback);

        req.write(JSON.stringify(parameters));
        req.end();
    }
}

Client.prototype.post = createMethodRequest('post');

Client.prototype.delete = createMethodRequest('delete');

Client.prototype.put = createMethodRequest('put');

Client.prototype.patch = createMethodRequest('patch');

module.exports = {
    client: Client
}
