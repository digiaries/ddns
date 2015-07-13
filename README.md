# ddns
被动 DDNS 解析（什么鬼。。。）

# 必要的文件夹及文件
自行创建以下文件夹及文件
	- private
	- private/log
	- conf
	- conf/config.json

config.json 文件包含支持站点的相关配置信息，如：
```
{
	"dnspod":{
		"appid":10086
		,"Token":"53cb7f098dask23923934778b7bd98"
		,"name":"test_ddns"
	}
}
```

# API
	[GET] /ddns/:type?tk=<token>&ts=<timestamp>
	[GET] /ddns/:type/status