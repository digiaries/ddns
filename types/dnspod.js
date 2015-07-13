/*
名称：honeycombs_ddns
ID：10337
Token：53cb7f0b0305304bff41264778b7bd98
创建时间：2015-07-10 16:43:57
curl http://dnsapi.cn/Domain.List -d ‘login_token=10337,53cb7f0b0305304bff41264778b7bd98&format=json’
*/

var request = require("request");
// require('request').debug = true;
var dns = require("dns");
var qs = require("querystring");

var crypto = require("crypto");

/**
 * 封装一个 promise 形式的 request 方法
 * @return {Promise} pormise链式对象
 */
function requestWapper () {
	var args = Array.prototype.slice.call(arguments);
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

function getJson (str) {
	var data;
	try {
		data = JSON.parse(str);
	}catch(e){
		data = null;
	}
	return data;
}

function getJsonHeader () {
	return {
		"User-Agent":"HoneycombsDdns/0.1(digiaries@hotmail.com)"
		,"content-type":"application/x-www-form-urlencoded"
	};
}

function FreshDns (conf) {

	for (var n in conf) {
		switch (n) {
			case "l":
				this.hosts = conf[n] || [];
			break;

			case "tid":
				this.tid = conf[n] && conf[n][0] || "";
			break;

			case "tocken":
				this.tocken = conf[n] && conf[n][0] || "";
			break;

			case "debug":
				this.debug = true;
			break;
		}
	}

	this.login_token = this.tid+","+this.tocken;

	this.freshStatus = {};
	this.o_ip = "";
	this.n_ip = "";

	this.hosts.forEach(function (host) {
		this.setStatus(host, false)
			.fresh(host);
	}.bind(this));
}

var FDP = FreshDns.prototype;

FDP.config = {
	"url":{
		"domainInfo":"Domain.Info"
		,"recordList":"Record.List"
		,"recordDdns":"Record.Ddns"
	}
	,"dnspodApi":"https://dnsapi.cn/"
};

FDP.setStatus = function (host, status) {
	this.freshStatus[host] = status;
	return this;
}

FDP.getIp = function (host) {
	var me = this;
	var p = new Promise(function (resolve, reject) {
		if (me.o_ip && me.n_ip) {
			if (me.debug) {
				console.log("IP ready.");
			};
			resolve();
		} else {
			if (me.debug) {
				console.log("Get IP.");
			};
			requestWapper({
				"url": "http://members.3322.org/dyndns/getip"
			})
			.then(function (re) {
				me.n_ip = re;
				if (me.debug) {
					console.log('New IP >>> ',me.n_ip);
				}
				dns.lookup(host, function (err, add) {
					me.o_ip = add || '';
					if (err) {
						if (me.debug) {
							console.log(err);
						}
						reject(err);
					} else {
						if (me.debug) {
							console.log('Old IP >>> ',me.o_ip);
						}
						resolve();
					}
				});
			});
		}	
	});
	return p;
}

FDP.fresh = function (host) {
	var me = this;

	this.getIp(host)
		.then(function () {
			console.log('Next');
			if (me.n_ip !== me.o_ip) {
				me.updateDns(host);
			} else {
				me.setStatus(host, true);
			}
		});
}

FDP.getReqUrl = function (type) {
	return this.config.dnspodApi + this.config.url[type];
}

FDP.getPostData = function (dat) {

	var data = {
		"login_token":this.login_token
		,"format":"json"
	};

	Object.keys(dat).forEach(function (key) {
		data[key] = dat[key];
	});

	return decodeURIComponent(qs.stringify(data));
}

FDP.updateDns = function (host) {
	var hostName = host.substr(host.indexOf(".")+1);
	var type = host.substr(0,host.indexOf("."));
	var me = this;

	requestWapper({
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
		return domain_id;
	})
	.then(function(did){
		var p = new Promise(function (resolve, reject) {
			if (did) {
				requestWapper({
					"uri":me.getReqUrl("recordList")
					,"method":"post"
					,"headers":getJsonHeader()
					,"body":me.getPostData({"domain_id":did})
				})
				.then(function (re) {
					if (me.debug){
						console.log(re);
					}
					var r_resp = getJson(re);
					var records = [];

					if (r_resp && r_resp.status.code === "1") {
						var did = r_resp.domain.id;
						r_resp.records.forEach(function (item) {
							switch(item.type) {
								case "A":
								case "www":
									item.did = did;
									records.push(item);
								break;
							}

						});
					}
					resolve(records);
				})
				.catch(function (err) {
					reject(err);
				});
			} else {
				reject(err);
			}
		});
		return p;
	})
	.then(function (records) {
		var re = {
			"success":0
			,"fail":0
			,"len":records.length
		};
		var p = new Promise(function (resolve, reject) {
			records.forEach(function (item) {
				requestWapper({
					"uri":me.getReqUrl("recordDdns")
					,"method":"post"
					,"headers":getJsonHeader()
					,"body":me.getPostData({
						"domain_id":item.did
						,"record_id":item.id
						,"sub_domain":item.name
						,"record_line":"%E9%BB%98%E8%AE%A4"
					})
				})
				.then(function(rep){
					var resp = getJson(rep);
					if (resp && resp.status.code === "1") {
						re.success += 1;
					}

					if ((re.success + re.fail) === re.len) {
						resolve(re);
					}
				})
				.catch(function (){
					re.fail += 1;
					if ((re.success + re.fail) === re.len) {
						resolve(re);
					}
				});
			});
		});
		return p;
	})
	.then(function (re) {
		console.log(re);
	})
	.catch(function(reason){
		console.log("Fail...");
		console.log(reason);
	});
}

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

function getMd5 () {
	var conditions = {};
	Array.prototype.slice.call(arguments).forEach(function(item,index){
		conditions[index] = item;
	});
	conditions = JSON.stringify(conditions);
	return crypto.createHash("md5")
		.update(conditions, "utf8")
		.digest("hex");
}

function go (req) {
	var status = false;
	if (req.query.tk && req.query.ts) {
		var skey = getMd5(10337,"53cb7f0b0305304bff41264778b7bd98",req.ts,"digiaries@hotmail.com");
		console.log(skey);
		status = req.query.tk === skey;
	}

	return status;
}

module.exports = go;

// console.log(process.argv);

if (require.main === module) {
	goFresh(process.argv);
}






