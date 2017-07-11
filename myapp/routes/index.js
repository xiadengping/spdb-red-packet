var express = require('express');
var router = express.Router();
var creatBot = require('../../run-core');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('button', { });
});

router.post('/post', function(req, res, next) {
  creatBot(function(url) {
    res.render('index', { url: url });
  })
});

module.exports = router;
