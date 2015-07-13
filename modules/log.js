var path = require("path")
	,log4js = require("log4js")
	,fs = require("fs");

function Log(config){
	this.config = {
		"name":"app"
		,"level":"warn"
		,"dir":"private/log"
	};

    if(Object.prototype.toString.call(config) === "[object Object]"){
    	for(var n in config){
    		if(config.hasOwnProperty(n)){
    			this.config[n] = config[n];
    		}
    	}
    }
    var tmp = path.join(this.config.dir);
    if(!fs.existsSync(tmp)){
    	fs.mkdirSync(tmp);
    }
    tmp = null;
    log4js.clearAppenders();
}

var LP = Log.prototype;

LP.getLogger = function(cat){
	var conf = this.config,
		logger;
	cat = "["+cat+"]";
	log4js.loadAppender("dateFile");
	log4js.addAppender(
		log4js.appenderMakers.dateFile(
			{
				"filename":conf.name,
				"pattern":".yyyyMMddhh.log",
				"alwaysIncludePattern":true
			}
			,{
				"cwd":conf.dir
			}
		)
		,cat
	);

	log4js.addAppender(
		log4js.appenders.console()
		,cat
	);

	logger = log4js.getLogger(cat);
	logger.setLevel(conf.level);

	return logger;
}

module.exports = Log;