var csp = require('js-csp');
var go = csp.go;
var chan = csp.chan;
var take = csp.take;
var put = csp.put;
var timeout = csp.timeout;

function jsonRequest(url) {
  var ch = chan();
  var req = new XMLHttpRequest();
  req.onload = function() {
    var text = this.responseText;
    go(function*() { yield put(ch, text); });
  }
  req.open('get', url, true);
  req.send();
  return ch;
}

go(function*() {
  console.log(yield jsonRequest('sample.txt'));
});
