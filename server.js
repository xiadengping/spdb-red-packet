'use strict'
require('babel-register')
var express = require('express');
var createBot = require('./server');
var app = express();

app.get('/', function (req, res) {
  res.send('Hello World!');
});

app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});