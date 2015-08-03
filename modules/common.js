function getIP(req) {
    var ip = "";
    if(req.headers["x-forwarded-for"]){
        ip = req.headers["x-forwarded-for"];
    }else if(req.headers["x-real-ip"]){
        ip = req.headers["x-real-ip"];
    }else if(req.headers["remote_addr"] && req.headers["client_ip"]){
        ip = req.headers["client_ip"];
    }else if(req.headers["remote_addr"]){
        ip =req.headers["remote_addr"];
    }else if(req.headers["client_ip"]){
        ip =req.headers["client_ip"];
    }else {
        return null;
    }
    ip = ip && ip.split(',')[0] || null;

    return ip;
};

exports.getIp = getIP;