var request = require("request");
// require('request').debug = true;
var dns = require("dns");
var qs = require("querystring");
var storage = require("../modules/data");
var common = require("../modules/common");
var crypto = require("crypto");
var logger;

/**
 * 伪数组转为数组的方法
 * @param  {Object} dat 原始数据
 * @return {Array}      数组对象
 */
function toArray (dat) {
	return Array.prototype.slice.call(dat);
}

/**
 * 封装一个 promise 形式的 request 方法
 * @return {Promise} pormise链式对象
 */
function requestWapper () {
	var args = toArray(arguments);
	var p = new Promise(function (resolve, reject) {
		args.push(function (err, res, body) {
			if (err) {
				reject(err,res);
			} else {
				resolve(body,res);
			}
		});
		request.apply(request, args);
	});
	return p;
}

/**
 * 尝试格式化 json 数据
 * @param  {String} str 原始数据
 * @return {Object}     json 数据对象
 */
function getJson (str) {
	var data;
	try {
		data = JSON.parse(str);
	}catch(e){
		logger.error(e);
		data = null;
	}
	return data;
}

/**
 * 设置请求到接口的请求头
 * @return {Object} 请求头设定
 */
function getJsonHeader () {
	return {
		"User-Agent":"HoneycombsDdns/0.1(digiaries@hotmail.com)"
		,"content-type":"application/x-www-form-urlencoded"
	};
}

/**
 * 空函数
 */
function noop () {}

// 缓存对象
var LRU = require("lru-cache");
var DNSPOD_CACHE = LRU({
	"max":20
	,"maxAge":1000 * 60 * 60 * 24
});

DNSPOD_CACHE.set("ddns_dnspod_status",{});

/**
 * 刷新的构造函数
 * @param {Object}   conf 配置对象
 * @param {Function} cb   完成后的回调函数
 */
function FreshDns (conf,cb) {

	for (var n in conf) {
		switch (n) {
			case "l":
				this.hosts = conf[n] || [];
			break;

			case "tid":
				this.tid = conf[n] && conf[n][0] || "";
			break;

			case "token":
				this.token = conf[n] && conf[n][0] || "";
			break;

			case "debug":
				this.showDebug = true;
			break;

			case "ip":
				this.n_ip = conf[n];
			break;
		}
	}

	this.req = conf.req || null;

	this.login_token = this.tid+","+this.token;

	this.freshStatus = {};
	this.o_ip = "";
	this.n_ip = this.n_ip || "";

	this.cb = cb || noop;

	this.hosts.forEach(function (host) {
		this.debug("Host >>> ",host);
		this.setStatus(host, false)
			.fresh(host);
	}.bind(this));
}

var FDP = FreshDns.prototype;

/**
 * 默认配置
 * @type {Object}
 */
FDP.config = {
	"url":{
		"domainInfo":"Domain.Info"
		,"recordList":"Record.List"
		,"recordDdns":"Record.Ddns"
	}
	,"dnspodApi":"https://dnsapi.cn/"
};

/**
 * 当前更新状态
 * @param {String}  host   域名
 * @param {Boolean} status
 */
FDP.setStatus = function (host, status) {
	this.freshStatus[host] = status;
	return this;
};

function getNewIp(FD){
	if (FD && FD.n_ip) {
		// 有指定则直接返回
		return Promise.resolve(FD.n_ip);
	}

	if (FD && FD.req) {
		var ip = common.getIp(FD.req);
		if (ip) {
			return Promise.resolve(ip);
		}
	}
	return requestWapper({
		"url": "http://members.3322.org/dyndns/getip"
	});
}

/**
 * 获取新旧ip
 * @param  {String} host 域名
 * @return {Object}      Promise 对象
 */
FDP.getIp = function (host) {
	var me = this;
	var p = new Promise(function (resolve, reject) {
		if (me.o_ip && me.n_ip) {
			me.debug("IP ready.");
			resolve();
		} else {
			me.debug("Get IP.");
			getNewIp(me)
			.then(function (re) {
				me.n_ip = String(re).trim();
				me.debug('New IP >>> ',me.n_ip);
				dns.lookup(host, function (err, add) {
					me.o_ip = add || '';
					if (err) {
						if (me.debug) {
							logger.debug(err);
						}
						reject(err);
					} else {
						me.debug('Old IP >>> ',me.o_ip);
						resolve();
					}
				});
			});
		}	
	});
	return p;
};

/**
 * 刷新某个 host
 * @param  {String}    host 域名
 * @return {Undefined}      无返回值
 */
FDP.fresh = function (host) {
	var me = this;
	this.debug("Fresh >>> ",host);
	this.getIp(host)
		.then(function () {
			
			if (me.n_ip !== me.o_ip) {
				me.debug('IP changed.');
				me.updateDns(host);
			} else {
				me.debug('IP unchange.');
				me.setStatus(host, true);
				var status = DNSPOD_CACHE.get("ddns_dnspod_status");
				
				var hasSubDomain = host.match(/\./g);
				hasSubDomain = hasSubDomain && hasSubDomain > 2 ? true : false;
				var hostName = hasSubDomain ? host.substr(host.indexOf(".")+1) : host;
				var domain_status = status[hostName] || {};
				var len = Object.keys(domain_status).length;

				var re = {
					"success":len
					,"fail":0
					,"len":len
					,"detail":domain_status
				};
				me.cb(re);

			}
		});
};

/**
 * 获取 dnspod 的相关请求 api
 * @param  {String} type api 名称
 * @return {String}      真正的 API 地址
 */
FDP.getReqUrl = function (type) {
	return this.config.dnspodApi + this.config.url[type];
};

/**
 * 生成 post 数据
 * @param  {Object} dat 要发送到接口的数据
 * @return {String}     请求数据字符串
 */
FDP.getPostData = function (dat) {

	var data = {
		"login_token":this.login_token
		,"format":"json"
	};

	Object.keys(dat).forEach(function (key) {
		data[key] = dat[key];
	});

	return decodeURIComponent(qs.stringify(data));
};

/**
 * 获取域名信息
 * @param  {String} hostName 域名
 * @return {Object}          Promise 对象
 */
FDP.getDomainInfo = function (hostName) {
	var domainData = touchData(true);
	var domainInfo = domainData && domainData[hostName] || null;

	if (domainInfo && domainInfo.id) {
		this.debug("Get domain id form cache, domain id is : ",domainInfo.id);
		return Promise.resolve(domainInfo.id);
	}

	var me = this;
	return requestWapper({
		"uri":this.getReqUrl("domainInfo")
		,"method":"post"
		,"headers":getJsonHeader()
		,"body":this.getPostData({"domain":hostName})
	})
	.then(function(re){
		var resp = getJson(re);
		var domain_id;
		if (resp && resp.status.code === "1") {
			domain_id = resp.domain.id;
		} else {
			domain_id = "";
		}

		me.debug("Get domain id.",domain_id);

		var mapData = {};
		mapData[domain_id] = hostName;

		var updateData = {"map":mapData};
		updateData[hostName] = {"id":domain_id};

		storage.update("ddns",updateData);

		mapData = null;

		return domain_id;
	});
};

/**
 * 获取纪录的子域名
 * @param  {Int}    did 域名id
 * @return {Object}     Promise 对象
 */
FDP.getRecorde = function(did,hostName) {
	if (did) {
		var dnsData = touchData(true);
		hostName = hostName || dnsData.map && dnsData.map[did] || "";

		var domainData = dnsData[hostName] || {};
		var records = domainData.records || null;

		if (records) {
			this.debug("Get records form cache,records : ",JSON.stringify(records));
			return Promise.resolve(records);
		}
		var me = this;
		return requestWapper({
			"uri":me.getReqUrl("recordList")
			,"method":"post"
			,"headers":getJsonHeader()
			,"body":me.getPostData({"domain_id":did})
		})
		.then(function (re) {
			me.debug("Origin record data : ",re);
			var r_resp = getJson(re);
			var records = [];

			if (r_resp && r_resp.status.code === "1") {
				var did = r_resp.domain.id;
				var dname = r_resp.domain.name;
				r_resp.records.forEach(function (item) {
					switch(item.type) {
						case "A":
						case "www":
							item.did = did;
							item.dname = dname;
							records.push(item);
						break;
					}
				});
			}
			if (hostName) {
				me.debug("Update records data.",JSON.stringify(records));
				storage.update("ddns",hostName,{"records":records});
			}
			return records;
		})
		.catch(function (err) {
			return Promise.reject(err);
		});


	} else {
		return Promise.reject({"err":"domain_id miss"});
	}
};

/**
 * 更新记录的 dns
 * @param  {Array}  records 记录列表
 * @return {Object}          Promise对象
 */
FDP.updateRecordes = function(records) {
	var re = {
		"success":0
		,"fail":0
		,"len":records.length
		,"detail":{}
	};
	var me = this;
	var p = new Promise(function (resolve, reject) {
		records.forEach(function (item) {
			logger.info("Record Ddns Data : ",JSON.stringify(item));
			re.detail[item.dname] = re.detail[item.dname] || {};

			// status 0,失败 1,成功 -1.正在更新
			re.detail[item.dname][item.name] = {
				"ip":me.n_ip
				,"status":-1
			};

			requestWapper({
				"uri":me.getReqUrl("recordDdns")
				,"method":"post"
				,"headers":getJsonHeader()
				,"body":me.getPostData({
					"domain_id":item.did
					,"record_id":item.id
					,"sub_domain":item.name
					,"record_line":"%E9%BB%98%E8%AE%A4"
					,"value":me.n_ip
				})
			})
			.then(function(rep){
				var resp = getJson(rep);
				var r_status;
				if (resp && resp.status.code === "1") {
					re.success += 1;
					r_status = 1;
				} else {
					re.fail += 1;
					r_status = 0;
				}

				re.detail[item.dname][item.name].status = r_status;
				if ((re.success + re.fail) === re.len) {
					resolve(re);
				}
			})
			.catch(function (err){
				re.fail += 1;
				re.detail[item.dname][item.name].status = 0;
				// @todo 输出错误信息
				if ((re.success + re.fail) === re.len) {
					resolve(re);
				}
			});
		});
		// resolve(re);
		records = null;
	});
	return p;
};

/**
 * 更新某个 host 的 dns 记录
 * @param  {String}    host 域名
 * @return {Undefined}      无返回值
 * @todo 拆分里面的步骤
 */
FDP.updateDns = function (host) {
	var hasSubDomain = host.match(/\./g);
	hasSubDomain = hasSubDomain && hasSubDomain.length > 1 ? true : false;
	var hostName = hasSubDomain ? host.substr(host.indexOf(".")+1) : host;
	// var type = host.substr(0,host.indexOf("."));
	var me = this;

	me.debug("Update dns >>> ",hostName);

	// @todo 利用 data 模块存储 domainId ，在检测到后不再去 dnspod 查询，需要提供强制刷新的参数或方法
	// 域名纪录 ID
	this.getDomainInfo(hostName)
		.then(function(did){
			// 获取配置的域名解析类型
			// @todo 增加排除或配置项
			return me.getRecorde(did,hostName);
		})
		.then(function (records) {
			// 更新 dns
			return me.updateRecordes(records);
		})
		// 都完成
		.then(function (re) {

			me.debug(JSON.stringify(re));

			// 写入本次的ip
			// storage.set("ddns","ip",me.n_ip);

			var status = DNSPOD_CACHE.get("ddns_dnspod_status");
			Object.keys(re.detail).forEach(function (key) {
				status[key] = re.detail[key];
			});
			DNSPOD_CACHE.set("ddns_dnspod_status",status);

			me.cb(re);
		})
		.catch(function(reason){
			logger.error(reason);
		});
};

/**
 * 调试
 * @return {Undefined} 无返回值
 */
FDP.debug = function () {
	if (this.showDebug) {
		logger.debug.apply(
			logger
			,toArray(arguments)
		);
	};
}

/**
 * 命令行形式的调用函数
 * @param  {Array}     argv 参数数组
 * @return {Undefined}      无返回值
 * @description 模块修改后还未测试过。。。
 */
function goFresh (argv) {
	var hosts = [];
	var chkReg = /^-(\w+)/;
	var nowArg;

	var conf = {};

	argv.forEach(function (input) {
		var arg = input.match(chkReg);
		arg = arg && arg[1] || null;
		if (arg && arg !== nowArg) {
			nowArg = arg;
			conf[nowArg] = [];
		} else if (nowArg && conf[nowArg]) {
			conf[nowArg].push(input);
		}
	});

	var fd = new FreshDns(conf);
}

/**
 * 根据条件生成一个 md5 hash
 * @return {String}
 */
function getMd5 () {
	var conditions = {};
	toArray(arguments).forEach(function(item,index){
		conditions[index] = item;
	});
	conditions = JSON.stringify(conditions);
	return crypto.createHash("md5")
		.update(conditions, "utf8")
		.digest("hex");
}

/**
 * 获取文件记录数据
 * @return {Object} Promise 对象
 */
function touchData (noPromise) {
	var ddnsData = DNSPOD_CACHE.get("ddns_dnspod");
	if (noPromise) {
		return ddnsData || null;
	}
	if (ddnsData) {
		return Promise.resolve(ddnsData);
	}
	return storage.get("ddns")
		.then(function(d_data){
			DNSPOD_CACHE.set("ddns_dnspod",d_data);
			return d_data;
		})
}

/**
 * 模块外部调用接口
 * @param  {Object} req  请求对象
 * @param  {Object} res  响应对象
 * @param  {Object} conf 模块配置对象
 * @param  {[type]} app  [description]
 * @return {[type]}      [description]
 */
function go (req, res, conf, app) {
	var status = false;
	var conf = conf || {};
	var chkAuth = conf.auth || false;
	var query = req.query;
	var check = true;

	if (!logger) {
		logger = app && app.get("log");
		if (logger) {
			logger = logger.getLogger("dnspod");
		} else {
			logger = console;
		}
	}
	logger.info("DNSPOD online.");

	if (chkAuth && query.tk && query.ts) {
		// 简单的授权验证
		// @todo 待完善。。。
		var skey = getMd5(conf.appid,conf.token,req.ts,conf.mail);
		if (query.tk !== skey) {
			check = false;
		}
	}

	if (check && conf.appid && conf.token) {
		touchData()
			.then(function(){
				var dnsConf = {
					"l":conf.hosts
					,"tid":[conf.appid]
					,"token":[conf.token]
					,"req":req
				};
				if (query.debug) {
					dnsConf.debug = 1;
				}
				var fd = new FreshDns(dnsConf,function (re){
					fd = null;
					res.status(200).send(re);
				});
			});
	}

	return status;
}

module.exports = go;

module.exports.status = function () {
	var status = DNSPOD_CACHE.get("ddns_dnspod_status");
	return status;
};

// console.log(process.argv);

if (require.main === module) {
	goFresh(process.argv);
}






