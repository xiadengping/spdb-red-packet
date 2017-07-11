'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Request = Request;

var _axios = require('axios');

var _axios2 = _interopRequireDefault(_axios);

var _cookieManager = require('cookie-manager');

var _cookieManager2 = _interopRequireDefault(_cookieManager);

var _global = require('./global');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var paramsSerializer = function paramsSerializer(params) {
  var qs = [];
  for (var key in params) {
    qs.push(key + '=' + params[key]);
  }
  return encodeURI(qs.join('&'));
};

var getPgv = function getPgv(c) {
  return (c || "") + Math.round(2147483647 * (Math.random() || .5)) * +new Date() % 1E10;
};

function Request(defaults) {
  var _this = this;

  defaults = defaults || {};
  defaults.headers = defaults.headers || {};
  if (!_global.isStandardBrowserEnv) {
    defaults.headers['user-agent'] = defaults.headers['user-agent'] || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/48.0.2564.109 Safari/537.36';
    defaults.headers['connection'] = defaults.headers['connection'] || 'close';
  }
  // 好像不需要了
  // defaults.paramsSerializer = defaults.paramsSerializer || paramsSerializer
  defaults.httpAgent = false;
  defaults.httpsAgent = false;

  this.axios = _axios2.default.create(defaults);
  if (!_global.isStandardBrowserEnv) {
    this.cm = new _cookieManager2.default();
    this.cm.store('', ['pgv_pvi=' + getPgv() + '; Domain=.qq.com; Path=/', 'pgv_si=' + getPgv('s') + '; Domain=.qq.com; Path=/']);
    this.axios.interceptors.request.use(function (config) {
      config.headers['cookie'] = config.url ? decodeURIComponent(_this.cm.prepare(config.url)) : '';
      return config;
    }, function (err) {
      return Promise.reject(err);
    });
    this.axios.interceptors.response.use(function (res) {
      var setCookie = res.headers['set-cookie'];
      if (setCookie) {
        _this.cm.store(res.config.url, setCookie.map(function (item) {
          return item.replace(/\=\s*?(?=(\w+\.)*(wx\d?\.qq\.com|wechat\.com))/, '=.');
        }));
      }
      return res;
    }, function (err) {
      return Promise.reject(err);
    });
  }

  this.request = function (options) {
    return _this.axios.request(options);
  };

  return this.request;
}
//# sourceMappingURL=request.js.map