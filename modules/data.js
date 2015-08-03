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
		touch(file_path)
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
 * 向文件写入数据
 * @param  {String} file_path 文件地址
 * @param  {Object} filedata  数据
 * @return {Object}           Promise 对象
 */
function writeFile (file_path, filedata) {
	return promiseFactory(function (resolve, reject){
		fs.writeFile(file_path, JSON.stringify(filedata),function (err) {
			if (err) {
				reject();
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
 * @param  {String} key       数据key
 * @param  {Object} data      数据
 * @return {Object}           Promise 对象
 */
function touch (file_path, type, key, data) {
	return promiseFactory(function (resolve, reject) {
		fs.exists(file_path, function(exists){
			if (exists) {
				if (key && data) {
					// 有数据则写入
					get(type)
						.then(function (filedata) {
							filedata[key] = filedata[key] || {};
							filedata[key] = data;
							writeFile(file_path, filedata)
								.then(function(){
									resolve();
								})
								.catch(function(err){
									reject(err);
								});
						})
						.catch(function(err){
							reject(err);
						});
				} else {
					resolve();
				}
			} else {
				// 不存在
				// 默认数据
				var filedata = {};
				if (key && data) {
					// 写入数据
					filedata[key] = data;
				}

				// 写入文件
				writeFile(file_path, filedata)
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

/**
 * 写入文件
 * @param {String}   type 数据集名称
 * @param {String}   key  写入数据的key
 * @param {Object}   data 写入数据
 * @return {Object}       Promise 对象
 */
exports.set = function (type, key, data) {
	return promiseFactory(function (resolve, reject) {
		var file_path = config.data[type];
		if (file_path) {
			touch(file_path, type, key, data)
				.then(function (){
					resolve();
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

exports.get = get;