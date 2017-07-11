'use strict';

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

var _core = require('./core');

var _core2 = _interopRequireDefault(_core);

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _util = require('./util');

var _contact = require('./interface/contact');

var _contact2 = _interopRequireDefault(_contact);

var _message = require('./interface/message');

var _message2 = _interopRequireDefault(_message);

var _debug2 = require('debug');

var _debug3 = _interopRequireDefault(_debug2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var debug = (0, _debug3.default)('wechat');

if (!_util.isStandardBrowserEnv) {
  process.on('uncaughtException', function (err) {
    console.log('uncaughtException', err);
  });
}

var Wechat = function (_WechatCore) {
  (0, _inherits3.default)(Wechat, _WechatCore);

  function Wechat() {
    (0, _classCallCheck3.default)(this, Wechat);

    var _this = (0, _possibleConstructorReturn3.default)(this, (Wechat.__proto__ || Object.getPrototypeOf(Wechat)).call(this));

    _lodash2.default.extend(_this, new _events2.default());
    _this.state = _this.CONF.STATE.init;
    _this.contacts = {}; // 所有联系人
    _this.Contact = (0, _contact2.default)(_this);
    _this.Message = (0, _message2.default)(_this);
    _this.lastReportTime = 0;
    _this.syncErrorCount = 0;
    return _this;
  }

  (0, _createClass3.default)(Wechat, [{
    key: 'syncPolling',
    value: function syncPolling(callback) {
      var _this2 = this;

      this.syncCheck().then(function (selector) {
        debug('Sync Check Selector: ', selector);
        if (selector != _this2.CONF.SYNCCHECK_SELECTOR_NORMAL) {
          return _this2.sync().then(function (data) {
            _this2.syncErrorCount = 0;
            callback(data);
          });
        }
      }).then(function () {
        _this2.syncPolling(callback);
        if (+new Date() - _this2.lastReportTime > 5 * 60 * 1000) {
          debug('Status Report');
          _this2.notifyMobile(_this2.user.UserName).catch(debug);
          _this2.sendText('心跳：' + new Date().toLocaleString(), 'filehelper').catch(debug);
          _this2.lastReportTime = +new Date();
        }
      }).catch(function (err) {
        _this2.emit('error', err);
        if (_this2.syncErrorCount++ > 5) {
          debug(err);
          _this2.logout();
          callback();
        } else {
          setTimeout(function () {
            _this2.syncPolling(callback);
          }, 1000 * _this2.syncErrorCount);
        }
      });
    }
  }, {
    key: 'start',
    value: function () {
      var _ref = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee() {
        var _this3 = this;

        var ret;
        return _regenerator2.default.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                ret = undefined;
                _context.prev = 1;
                _context.next = 4;
                return this.getUUID();

              case 4:
                ret = _context.sent;

                debug('getUUID: ', ret);
                this.emit('uuid', ret);
                this.state = this.CONF.STATE.uuid;

              case 8:
                _context.next = 10;
                return this.checkLogin();

              case 10:
                ret = _context.sent;

                debug('checkLogin: ', ret);
                if (ret.code == 201 && ret.userAvatar) {
                  this.emit('user-avatar', ret.userAvatar);
                }

              case 13:
                if (ret.code !== 200) {
                  _context.next = 8;
                  break;
                }

              case 14:
                _context.next = 16;
                return this.login();

              case 16:
                _context.next = 18;
                return this.init();

              case 18:
                _context.next = 20;
                return this.notifyMobile();

              case 20:
                _context.next = 22;
                return this.getContact();

              case 22:
                ret = _context.sent;

                debug('getContact data length: ', ret.length);
                this.updateContacts(ret);
                _context.next = 34;
                break;

              case 27:
                _context.prev = 27;
                _context.t0 = _context['catch'](1);

                this.emit('error', _context.t0);
                debug(_context.t0);
                this.logout();
                this.state = this.CONF.STATE.logout;
                return _context.abrupt('return');

              case 34:
                this.syncPolling(function (data) {
                  return _this3.handleSync(data);
                });
                this.emit('login');
                this.state = this.CONF.STATE.login;

              case 37:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, this, [[1, 27]]);
      }));

      function start() {
        return _ref.apply(this, arguments);
      }

      return start;
    }()
  }, {
    key: 'stop',
    value: function stop() {
      this.logout();
    }
  }, {
    key: 'handleSync',
    value: function handleSync(data) {
      if (!data) {
        this.emit('logout');
        this.state = this.CONF.STATE.logout;
        return;
      }
      if (data.AddMsgCount) {
        debug('syncPolling messages count: ', data.AddMsgCount);
        this.handleMsg(data.AddMsgList);
      }
      if (data.ModContactCount) {
        debug('syncPolling ModContactList count: ', data.ModContactCount);
        this.updateContacts(data.ModContactList);
      }
    }
  }, {
    key: 'handleMsg',
    value: function handleMsg(data) {
      var _this4 = this;

      data.forEach(function (msg) {
        Promise.resolve().then(function () {
          if (!_this4.contacts[msg.FromUserName]) {
            return _this4.batchGetContact([{
              UserName: msg.FromUserName
            }]).catch(function (err) {
              debug(err);
              return [{
                UserName: msg.FromUserName
              }];
            }).then(function (contacts) {
              _this4.updateContacts(contacts);
            });
          }
        }).then(function () {
          msg = _this4.Message.extend(msg);
          _this4.emit('message', msg);
          if (msg.MsgType == _this4.CONF.MSGTYPE_STATUSNOTIFY) {
            var userList = msg.StatusNotifyUserName.split(',').map(function (UserName) {
              return {
                UserName: UserName
              };
            });
            Promise.all(_lodash2.default.chunk(userList, 50).map(function (list) {
              return _this4.batchGetContact(list).then(function (res) {
                debug('batchGetContact data length: ', res.length);
                _this4.updateContacts(res);
              });
            })).catch(function (err) {
              debug(err);
            });
          }
        }).catch(function (err) {
          _this4.emit('error', err);
          debug(err);
        });
      });
    }
  }, {
    key: 'updateContacts',
    value: function updateContacts(contacts) {
      var _this5 = this;

      contacts.forEach(function (contact) {
        if (_this5.contacts[contact.UserName]) {
          var original = _this5.contacts[contact.UserName].__proto__;
          for (var i in contact) {
            contact[i] || delete contact[i];
          }
          Object.assign(original, contact);
          _this5.contacts[contact.UserName].init(_this5);
        } else {
          _this5.contacts[contact.UserName] = _this5.Contact.extend(contact);
        }
      });
      this.emit('contacts-updated', contacts);
    }
  }, {
    key: 'friendList',
    get: function get() {
      var members = [];

      for (var key in this.contacts) {
        var member = this.contacts[key];
        members.push({
          username: member['UserName'],
          nickname: this.Contact.getDisplayName(member),
          py: member['RemarkPYQuanPin'] ? member['RemarkPYQuanPin'] : member['PYQuanPin'],
          avatar: member.AvatarUrl
        });
      }

      return members;
    }
  }]);
  return Wechat;
}(_core2.default);

Wechat.STATE = (0, _util.getCONF)().STATE;

exports = module.exports = Wechat;
//# sourceMappingURL=wechat.js.map