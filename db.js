'use strict'
require('babel-register')

var mongojs = require('mongojs')
var url = 'mongodb://zhuhui1:Zhuhui1991@121.42.180.141:27017/myproject'
var db = mongojs(url, ['user', 'users', 'today', 'complain', 'newUsers'])

db.user.find().toArray(function(err, docs){
    docs.map(function(item) {
        db.user.update({packetId: item.packetId}, {
            $set: {
                url: item.url.replace('https://weixin.spdbccc.com.cn/spdbcccWeChatPageRedPackets/StatusDistrubServlet.do', 'https://weixin.spdbccc.com.cn/wxrp-page-redpacketsharepage/share')
            }
        })
    })
})