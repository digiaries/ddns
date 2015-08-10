var fs = require("fs");
var config = require("../config");

function promiseFactory(handler) {
	var p = new Promise(handler);
	return p;
}

/**
 * 获取某个数据集或数据集中的某个key值
 * @param  {String} type 数据集
 * @param  {String} key  数据集中的键
 * @return {Object}      Promise 对象
 */
function get(type, key) {
	return promiseFactory(function (resolve, reject){
		file_path = config.data[type];
		if (!file_path) {
			reject();
			return;
		}
		touch(file_path,type)
			.then(function () {
				fs.readFile(file_path,{"encoding":"utf8"},function (err, file) {
					if (err || !file) {
						reject(err,file);
					} else {
						var data = JSON.parse(file);
						data = (key && data[key] || null) || data;
						resolve(data);
					}
				});
			});
	});
}

/**
 * 写入文件
 * @param {String}   type 数据集名称
 * @param {String}   key  写入数据的key
 * @param {Object}   data 写入数据
 * @return {Object}       Promise 对象
 */
function set(type, key, data) {
	return promiseFactory(function (resolve, reject) {
		var file_path = config.data[type];
		if (file_path) {
			touch(file_path, type)
				.then(function (){
					get(type)
						.then(function (filedata) {
							if (key && data) {
								if (typeof(key) === "object") {
									filedata = data;
								} else {
									filedata[key] = data;
								}
								writeFile(file_path, filedata)
									.then(function(){
										resolve(filedata);
									})
									.catch(function(err){
										reject(err);
									});
							} else {
								resolve(filedata);
							}
						})
						.catch(function(err){
							reject(err);
						});
				})
				.catch(function(err){
					reject(err);
				});
		} else {
			// 没设定的数据
			reject();
		}
	});
}

/**
 * 向文件写入数据
 * @param  {String} file_path 文件地址
 * @param  {Object} filedata  数据
 * @return {Object}           Promise 对象
 */
function writeFile (file_path, filedata) {
	return promiseFactory(function (resolve, reject){
		fs.writeFile(file_path, JSON.stringify(filedata,null,4),function (err) {
			if (err) {
				reject(err);
			} else {
				resolve();
			}
		});
	});
}

/**
 * 检测文件，如有数据则写入数据
 * @param  {String} file_path 文件路径
 * @param  {String} type      数据集名称
 * @return {Object}           Promise 对象
 */
function touch (file_path, type) {
	if (!file_path && type) {
		file_path = config.data[type];
	}
	return promiseFactory(function (resolve, reject) {
		fs.exists(file_path, function(exists){
			if (exists) {
				resolve();
			} else {
				// 不存在
				// 写入文件
				writeFile(file_path, {})
					.then(function(){
						resolve();
					})
					.catch(function(err){
						reject(err);
					});
			}
		});
	});
}


exports.update = function (type, key, data) {
	return promiseFactory(function (resolve, reject) {
		var file_path = config.data[type];
		if (file_path) {
			get(type)
				.then(function (filedata) {
					filedata = filedata || {};
					var updateData;
					if (typeof(key) === "object" && !data) {
						updateData = key;
					} else {
						updateData = {};
						updateData[key] = data;
					}

					Object.keys(updateData).forEach(function(u_key){
						filedata[u_key] = filedata[u_key] || {};
						Object.keys(updateData[u_key]).forEach(function(data_key){
							filedata[u_key][data_key] = updateData[u_key][data_key];
						});
					});

					return set(type, {}, filedata);
				})
				.catch(function(err){
					console.log(err);
					reject(err);
				});
		} else {
			// 没设定的数据
			reject();
		}
	});
};

exports.touch = function(type){
	return touch(null,type);
};

exports.set = set;

exports.get = get;