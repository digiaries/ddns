var meta = require("./package.json");
var priveConf = require("./conf/config.json");

var CONF = {
	"name":meta.name
	,"version":meta.version
	,"resTimeout":6000
	,"port":40001
	,"isProd":false
	,"debug":true
	,"data":{
		"ddns":"./data/ddns.json"
	}
};

if (priveConf) {
	// 合并独立配置
	Object.keys(priveConf).forEach(function(key){
		CONF[key] = priveConf[key];
	});
}

module.exports = CONF;