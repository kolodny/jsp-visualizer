importScripts('./runtime.js');
importScripts('./regenerator.js');
importScripts('./csp.js');

var global = this;

global.onmessage = function(e) {
  if(e.data.type === 'results') {
    global.postMessage({
      type: 'results',
      data: csp.recorder.stopRecording()
    });
  }
  else {
    var generated = regenerator(e.data.code);

    var consle = {
      log: function() {
        var args = Array.prototype.slice.call(arguments);
        var output = args.map(function(arg) {
          return '' + arg;
        }).join('\n');

        global.postMessage({
          type: 'output',
          output: output
        });
      }
    };

    var code = generated.code;
    var fn = new Function(
      'csp', 'go', 'take', 'takem', 'put', 'alts', 'chan',
      'timeout', 'ops', 'console',
      code
    );

    csp.recorder.startRecording();

    fn(csp, csp.go, csp.take, csp.takem, csp.put, csp.alts,
       csp.chan, csp.timeout, csp.operations, consle);

    csp.recorder.onFinished(function(data) {
      global.postMessage({
        type: 'done',
        data: data
      });
    });
  }
};
