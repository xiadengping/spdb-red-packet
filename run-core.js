'use strict'
require('babel-register')
const Wechat = require('wechat4u')
const qrcode = require('qrcode-terminal')
const fs = require('fs')
const mongojs = require('mongojs')
const request = require('request')
const nodemailer  = require('nodemailer');

var mailTransport = nodemailer.createTransport({
    host : 'smtp.qq.com',
    secureConnection: true, // 使用SSL方式（安全方式，防止被窃取信息）
    auth : {
        user : '312677182@qq.com',
        pass : 'hlbnmhdgltktbihf'
    },
});

const url = 'mongodb://zhuhui1:Zhuhui1991@121.42.180.141:27017/myproject'
const db = mongojs(url, ['user', 'newUsers', 'today', 'complain'])

module.exports = function createBot (callbackUUID) {
  let bot = new Wechat()

  bot.on('error', err => {
    console.log('错误：', err)
  })

  bot.on('uuid', uuid => {
    callbackUUID('https://login.weixin.qq.com/qrcode/' + uuid);
    // uuid事件，获取二维码
    qrcode.generate('https://login.weixin.qq.com/l/' + uuid, {
      small: true
    })
    console.log('二维码链接：', 'https://login.weixin.qq.com/qrcode/' + uuid)
  })

  bot.on('user-avatar', avatar => {
    // 手机扫描后可以得到登录用户头像的Data URL
    console.log('登录用户头像Data URL：', avatar)
  })

  bot.on('login', () => {
    console.log('登录成功')
  })

  bot.on('logout', () => {
    console.log('登出成功')

    var options = {
        from           : '312677182@qq.com',
        to             : '312677182@qq.com',
        // cc          : ''    //抄送
        // bcc         : ''    //密送
        subject        : '浦发机器人登录过期了',
        text           : '浦发机器人登录过期了',
        html           : '<h1>浦发机器人登录过期了</p>',
    };

    mailTransport.sendMail(options, function(err, msg){
        if(err){
            console.log(err);
        }
        else {
            console.log(msg);
        }
    });
  })

  bot.on('contacts-updated', contacts => {
    console.log('联系人数量：', Object.keys(bot.contacts).length)
  })

  function addNewUrl (userName, url, msg, packetId) {
    db.user.findOne({
      packetId,
    }, function (err, result) {
      if (result) {
        bot.sendText('请不要把已经发过的链接发给我。', bot.contacts[msg.FromUserName].UserName).catch(err => {
          console.log(err)
        })
      } else {
        db.user.insert({
          toName: bot.contacts[msg.FromUserName].UserName,
          name: userName,
          url,
          packetId,
          times: 5
        })
        db.complain.find({
          complainUser: userName,
        }).toArray(function (err, docs) {
          if (docs && docs.length > 5) {
            bot.sendText('你已被投诉空红包超过五次，系统决定对你罢工。。。。。', bot.contacts[msg.FromUserName].UserName).catch(err => {
              console.log(err)
            })
          } else {
            db.user.find({
              times: {$ne: 0},
              name: {$ne: userName}
            }).toArray(function (err, docs) {
              const userList = []
              db.today.findOne({
                user: userName
              }, function (err, doc) {
                const time = (new Date()).toLocaleDateString()
                var todayList = []
                var messageReturn = ''
                var requestUrl = 'http://api.weibo.com/2/short_url/shorten.json?source=1681459862'
                var userMap = {}
                if (doc && doc.time === time) {
                  todayList = doc.todayList
                }
                docs.map((item) => {
                  if (userList.length < 5) {
                    if (userList.indexOf(item.name) === -1 && todayList.indexOf(item.name) === -1) {
                      var itemUrl = item.url.replace(/&amp;/g, '&');
                      userList.push(item.name)
                      todayList.push(item.name)
                      userMap[itemUrl] = item.name
                      requestUrl += `&url_long=${encodeURIComponent(itemUrl)}`
                      if (item.times > 1) {
                        db.user.update({url: item.url}, {$set: {times: item.times - 1 }})
                      } else {
                        db.user.remove({url: item.url});
                      }
                    }
                  }
                })
                request(requestUrl, function (error, response, body) {
                  const result = JSON.parse(body);
                  if (result.urls) {
                    result.urls.map((item, index) => {
                      messageReturn += `${item.url_short}  from  ${userMap[item.url_long]}  \n\n`
                    })
                    bot.sendText(messageReturn, bot.contacts[msg.FromUserName].UserName).catch(err => {
                      console.log(err)
                    })
                    bot.sendText(`如果你收到空包，请回复：投诉+红包来源。收到两个以上用户投诉我将会把该红包来源的用户拉黑。如果要加入浦发红包反馈群，请回复：我要加群。如果愿意分担小浦服务器费用，请回复：打赏小浦。`, bot.contacts[msg.FromUserName].UserName).catch(err => {
                      console.log(err)
                    })
                  } else {
                    for(var mapkey in userMap) {
                      bot.sendText(`${mapkey}  from  ${userMap[mapkey]}`, bot.contacts[msg.FromUserName].UserName).catch(err => {
                        console.log(err)
                      })
                    }
                  }

                })
                
                if(doc) {
                  db.today.update({user: userName}, {
                    $set: {
                      time,
                      todayList,
                    }
                  })
                } else {
                  db.today.insert({
                    user: userName,
                    time,
                    todayList,
                  })
                }
              })
            })
          }
        })

      }
    });
  }

  function sendTextTo (content, member) {
    return function () {
      bot.sendText(content.replace(new RegExp('{{([^}}]*)'), '??').replace('??}}', ''), member.UserName)
          .catch(err => {
            console.log(err)
          })
    }
  }

  function sendImgTo (pic, member) {
    return function () {
      bot.uploadMedia(fs.createReadStream(pic))
      .then(res => {
        return bot.sendPic(res.mediaId, member.UserName)
      })
      .catch(err => {
        console.log(err)
      })
    }
  }

  function sendToAll (content) {
    let index = 1
    for (let key in bot.contacts) {
      if (key !== 'weixin') {
        index++
        const member = bot.contacts[key]
        setTimeout(sendTextTo(content, member), 100 * index)
      }
    }
  }

  function sendToAllImage (pic) {
    let index = 1
    for (let key in bot.contacts) {
      if (key !== 'weixin') {
        index++
        const member = bot.contacts[key]
        setTimeout(sendImgTo(pic, member), 100 * index)
      }
    }
  }

  bot.on('message', msg => {
    switch (msg.MsgType) {
      case bot.CONF.MSGTYPE_STATUSNOTIFY:
        // 手机上进行操作后的状态更新信息，内部通过这个消息获取未保存到通讯录的群信息
        console.log('又玩手机辣')
        break
      case bot.CONF.MM_DATA_APPMSG:
        if(msg.FromUserName.indexOf("@@") === 0) {
          console.log('群消息')
          return
        }        
        if (msg.Content.indexOf('packetId=') !== -1) {
          const userName = bot.contacts[msg.FromUserName].getDisplayName()
          const match = msg.Content.match(new RegExp("packetId\=([^&]*)"))
          const packetId = match[1]
          const hash = msg.Content.match(new RegExp("hash\=([^<]*)"))[1];
          const url = `https://weixin.spdbccc.com.cn/wxrp-page-redpacketsharepage/share?packetId=${packetId}&hash=${hash}&noCheck=1`
          // const clickUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=wxe9d7e3d98ec68189&redirect_uri=https://weixin.spdbccc.com.cn/spdbcccWeChatPageRedPackets/StatusDistrubServlet.do?noCheck%3D1%26status%3DJudgeOpenId%26param1%3D${packetId}%26hash%3D${hash}&response_type=code&scope=snsapi_base&state=STATE&connect_redirect=1#wechat_redirect`
          request(url, function (error, response, body) {
            if(body) {
              if(body.indexOf('onclick="submitInfo()') !== -1){
                // const dataDt = body.match(new RegExp("dataDt([*]*)\'([^\']*)"))
                // console.log(dataDt)
                addNewUrl(userName, url, msg, packetId)
              } else {
                bot.sendText('请不要发空包给我。如有疑问，请点开你发的红包，如果确认不是空包，可能是由于浦发网络原因导致的误判，可以将该红包重新发送一遍(长按红包 -> 转发)。\n ps: 最近浦发抽风，新开的红包也有可能是空包。', bot.contacts[msg.FromUserName].UserName).catch(err => {
                  console.log(err)
                })
              }
            } else {
              bot.sendText('由于浦发网络原因导致无法判断空包，请稍后重试(长按红包 -> 转发)。', bot.contacts[msg.FromUserName].UserName).catch(err => {
                  console.log(err)
                })
            }
            
          })
          
          db.newUsers.findOne({
            userName,
          }, function (err, doc) {
            if (!doc) {
              db.newUsers.insert({
                userName,
                toName: bot.contacts[msg.FromUserName].UserName,
              })
            }
          })
        } else {
          bot.sendText(
            `非法红包，请注意规则: 将新打开的浦发积分红包分享给该微信号！不是送红包，也不是发微信红包！玩法详见朋友圈。`,
            bot.contacts[msg.FromUserName].UserName).catch(err => {
              console.log(err)
            })
        }
        break
      case bot.CONF.MSGTYPE_TEXT:
        // 文本消息
        // console.log(`----------${msg.getPeerUserName()}---${bot.contacts[msg.FromUserName].UserName}-------`)
        if(msg.FromUserName.indexOf("@@") === 0) {
          console.log('群消息')
          return
        }
        
        console.log(bot.contacts[msg.FromUserName].getDisplayName() + ':\t' + msg.Content)
        const userName = bot.contacts[msg.FromUserName].getDisplayName()
        db.newUsers.findOne({
          userName,
        }, function (err, doc) {
          if (!doc) {
            db.newUsers.insert({
              userName,
              toName: bot.contacts[msg.FromUserName].UserName,
            })
          }
        })
        if(msg.Content.indexOf('投诉') !== -1) {
          let complainUser
          const userMatch = msg.Content.match(new RegExp('\\[([^\\]]*)'))
          if (userMatch) {
            complainUser = userMatch[1]
          } else {
            complainUser = msg.Content.replace(/\s*/g, '').replace('投诉', '').replace('+', '')
          }
          db.complain.insert({
            complain: msg.Content,
            complainUser,
            fromUser: msg.FromUserName,
            userName: userName
          })
          db.complain.find({
            complainUser,
          }).toArray(function (err, docs) {
            if (docs.length > 1) {
              db.newUsers.findOne({
                userName: complainUser
              }, function(err, doc) {
                bot.sendText('你已被多人投诉红包为空，后续请注意！', doc.toName).catch(err => {
                  console.log(err)
                })
              })
            }
          })
          bot.sendText('投诉成功', bot.contacts[msg.FromUserName].UserName).catch(err => {
            console.log(err)
          })
        } else {
           if (msg.Content.indexOf('怎么') !== -1 || msg.Content.indexOf('how') !== -1 || msg.Content.indexOf('?') !== -1) {
            bot.sendText('请将新打开的浦发积分红包分享给该微信号。玩法详见朋友圈。', bot.contacts[msg.FromUserName].UserName).catch(err => {
              console.log(err)
            })
          } else if (msg.Content.indexOf('打赏') !== -1) {
            bot.sendText('小浦每月承担了117元的阿里云服务器费用，愿意一起分担的小伙伴可转账给小浦开发者支付宝账号：312677182@qq.com(朱辉)，或者扫描二维码。', bot.contacts[msg.FromUserName].UserName).catch(err => {
              console.log(err)
            })
            bot.uploadMedia(fs.createReadStream('./media/alipay.jpeg'))
            .then(res => {
              return bot.sendPic(res.mediaId, bot.contacts[msg.FromUserName].UserName)
            })
            .catch(err => {
              console.log(err)
            })
            bot.uploadMedia(fs.createReadStream('./media/wechat.jpeg'))
            .then(res => {
              return bot.sendPic(res.mediaId, bot.contacts[msg.FromUserName].UserName)
            })
            .catch(err => {
              console.log(err)
            })
          } else if(msg.Content.indexOf('我要加群') !== -1){
            for(let key in bot.contacts) {
              if(bot.contacts[key].NickName == '浦发红包反馈群') {
                console.log(key)
                bot.updateChatroom(key, msg.FromUserName, 'invitemember');
              }
            }
          } else {
            bot.sendText('机器人表示一脸懵逼，想知道怎么用请看朋友圈。', bot.contacts[msg.FromUserName].UserName).catch(err => {
              console.log(err)
            })
          }
        }
        break

      case bot.CONF.MSGTYPE_VERIFYMSG:
        // 好友请求消息，似乎没什么用，微信上面能取消加好友验证
        // 不过如果是取消了加好友验证，那么就没办法将新好友添加到通讯录，相当于临时会话
        console.log(`----------${msg.RecommendInfo.UserName}:${msg.RecommendInfo.Ticket}----------`)
        // bot.verifyUser(msg.RecommendInfo.UserName, msg.RecommendInfo.Ticket)
        //   .then(res => {
        //     console.log(`通过 ${bot.Contact.getDisplayName(msg.RecommendInfo)} 好友请求`)
        //     bot.sendText('欢迎来到浦发红包互刷账号！为了保证账号正常运行，请不要发空包或者转发其他人的包！', bot.contacts[msg.RecommendInfo.UserName].UserName).catch(err => {
        //       console.log(err)
        //     })
        //   })
        //   .catch(err => {
        //     console.log(err)
        //   })
        break
      case bot.CONF.MSGTYPE_SYS:
        // 系统消息，Content中会提示细节，包括红包消息
        console.log(`----------${msg.getDisplayTime()}----------`)
        console.log(bot.contacts[msg.FromUserName].getDisplayName() + ':\t' + msg.Content)
        break
      default:
        console.log(`----------${msg.getDisplayTime()}----------`)
        console.log(msg)
        break
    }
  })

  bot.start()
}

