var fs = require("fs");
var config = require("../config");

/**
 * 获取某个数据集或数据集中的某个key值
 * @param  {String} type 数据集
 * @param  {String} key  数据集中的键
 * @return {Object}      Promise 对象
 */
function get(type, key) {
	var p = new Promise(function (resolve, reject){
		if (!config.data[type]) {
			reject();
			return;
		}
		fs.readFile(config.data[type],{"encoding":"utf8"},function (err, file) {
			var type = req.params.type;
			if (err || !file) {
				reject(err,file);
			} else {
				var data = JSON.parse(file);
				data = (key && data[key] || null) || data;
				resolve(data);
			}
		});
	});
	return p;
}

/**
 * 向文件写入数据
 * @param  {String} file_path 文件地址
 * @param  {Object} filedata  数据
 * @return {Object}           Promise 对象
 */
function writeFile (file_path, filedata) {
	var p = new Promise(function (resolve, reject){
		fs.writeFile(file_path, JSON.stringify(filedata),function (err) {
			if (err) {
				reject();
			} else {
				resolve();
			}
		});
	});
	return p;
}

/**
 * 检测文件，如有数据则写入数据
 * @param  {String} file_path 文件路径
 * @param  {String} key       数据key
 * @param  {Object} data      数据
 * @return {Object}           Promise 对象
 */
function touch (file_path, key, data) {
	var p = new Promise(function (resolve, reject) {
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
	return p;
}

/**
 * 写入文件
 * @param {String}   type 数据集名称
 * @param {String}   key  写入数据的key
 * @param {Object}   data 写入数据
 * @return {Object}       Promise 对象
 */
exports.set = function (type, key, data) {
	var p = new Promise(function (resolve, reject) {
		var file_path = config.data[type];
		if (file_path) {
			touch(file_path,key,data)
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
	return p;
}

exports.get = get;