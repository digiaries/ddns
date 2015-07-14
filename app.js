
var express = require("express")
	,config = require("./config")
	,app = express()
	,errorHandler = require("errorhandler")
	,log = require("./modules/log");

// nodejs 版本
var nodeVer = process.version;
nodeVer = nodeVer.split(".");
nodeVer[1] = Number(nodeVer[1]);

// 如果node的版本小于12，则手动导入 promise 模块
if (nodeVer[1] < 12) {
    global.Promise = require("promise");
}
nodeVer = null;

// 日志
var theLog = new log({
	"name":config.name
	,"level":config.isProd ? "warn" : "all"
});
var logger = theLog.getLogger("global");

app.set("logger",logger);


// 未知异常
process.on("uncaughtException", function (err) {
	logger.error("Uncaught exception:\n",err.stack);
	app.listen(config.port);
});

app.disable("x-powered-by");

// 请求超时控制
app.use(function(req, res, next){
	if(config.resTimeout){
		res.setTimeout(config.resTimeout,function(){
			res.send(200,{
				"success":false
				,"msg":"Error: Timeout,Response aborted."
				,"result":{
					"items":null
				}
			});
			res.end();
			req = res = next = null;
		});
	}
	next();
});

var url = require("url");
// 修复post数据
app.use (function(req, res, next) {
	req.rawBody = "";
	req.setEncoding("utf-8");
	req.on("data",function(chunk){
		req.rawBody += chunk;
	});
	req.on("end",function() {
		var tmp = url.parse("/?"+req.rawBody,true);
		req.rawBody = tmp.query;
		tmp = null;
		next();
	});
});

// 加载所有支持的类型
var path = require("path");
var fs = require("fs");
var _p = path.resolve("./types");
var files = fs.readdirSync(_p);
var ddnsTypes = {};
files.forEach(function(item) {
	var tmpPath = _p + "/" + item;
	var stats = fs.statSync(tmpPath);
	if (!stats.isDirectory()) {
		ddnsTypes.__defineGetter__(item.replace(".js", ""), function () {
			return require(path.resolve(tmpPath));
		});
	}
});

// 卖萌用的
app.get(/^\/$/, function(req, res){
	res.send("In the pipe,five by five.");
});

// 执行某个类型的 ddns
app.get("/ddns/:type", function(req, res){
	console.log(req.params);
	var handler = ddnsTypes[req.params.type];
	var status = false;
	if (handler) {
		status = handler(req,config[req.params.type],app);
	}
	res.status(200).send("ddns   ",status)
});

// 某个 ddns 的状态
app.get("/ddns/:type/status", function(req, res){
	console.log(req.params);
	res.send("ddns status");
});

app.use(errorHandler());

module.exports = app;

if (require.main === module) {
	app.listen(config.port);
	console.log(
		"DDNS [%s] online,listening on port %d"
		,config.isProd ? "PRODUCTION" : "DEVELOPMENT"
		,config.port
	);
}