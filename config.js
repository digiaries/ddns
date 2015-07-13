var meta = require("./package.json");

var CONF = {
	"name":meta.name
	,"version":meta.version
	,"resTimeout":4000
	,"port":40001
	,"isProd":false
};

module.exports = CONF;