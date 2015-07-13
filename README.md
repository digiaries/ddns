# ddns
被动 DDNS 解析（什么鬼。。。）

# 必要的文件夹及文件
自行创建以下文件夹及文件
	- private
	- private/log
	- conf
	- conf/config.json


# API
	[GET] /ddns/:type?tk=<token>&ts=<timestamp>
	[GET] /ddns/:type/status