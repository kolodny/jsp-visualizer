require('regenerator/runtime/dev.js');

var _ = require('lodash');

var React = require('react');
var CodeMirror = require('./lib/codemirror/codemirror');
var regenerator = require('./lib/regenerator');
var csp = require('./lib/csp');
var Timeline = require('./components/timeline');

require('./lib/codemirror/javascript.js');
require('./lib/codemirror/codemirror.css');
require('./lib/codemirror/ambiance.css');
require('../css/main.css');

var dom = React.DOM;

var Editor = React.createClass({
  componentDidMount: function() {
    var mirror = CodeMirror(this.getDOMNode(), {
      mode: 'javascript',
      theme: 'ambiance',
      smartIndent: false,
      value: this.props.content
    });

    mirror.on('change', (inst, e) => {
      this.props.onChange(inst.getValue());
    });
  },

  render: function() {
    return dom.div(null);
  }
});

var CspEditor = React.createClass({
  getInitialState: function() {
    return {
      content: this.props.initialValue,
      output: '',
      running: false,
      worker: null,
      terminateTimer: null,
      terminated: false,
      continuousTimer: null,
      currentHtmlOutput: this.props.htmlOutput
    };
  },

  updateContent: function(content) {
    this.setState({ content: content });
  },

  componentDidMount: function() {
    if(this.props.continuous) {
      if(this.props.inWorker) {
        this.runInWorker();
      }
      else {
        this.run();
      }
    }
  },

  run: function() {
    var generated = regenerator(this.state.content);
    var code = generated.code;
    var fn = new Function(
      'csp', 'go', 'take', 'takem', 'put', 'alts',
      'chan', 'timeout', 'ops',
      code
    );

    if(this.state.continuousTimer) {
      clearInterval(this.state.continuousTimer);
    }

    var htmlOutput = this.state.currentHtmlOutput;
    if(htmlOutput) {
      htmlOutput.parentNode.removeChild(htmlOutput);
      htmlOutput = htmlOutput.cloneNode();
    }

    // Wait to append the new output so that it will flash and make it
    // obvious to the user that it actually restarted
    setTimeout(() => {
      this.getDOMNode().appendChild(htmlOutput);

      csp.recorder.startRecording();
      fn(csp, csp.go, csp.take, csp.takem, csp.put, csp.alts,
         csp.chan, csp.timeout, csp.operations);
    }, 100);

    var continuousTimer;
    if(this.props.continuous && this.props.visualize) {
      continuousTimer = setInterval(() => {
        var data = csp.recorder.getData();
        this.setState({ data: data });
      }, 2000);
    }

    this.setState({
      output: '',
      data: null,
      running: true,
      currentHtmlOutput: htmlOutput,
      continuousTimer: continuousTimer
    });
  },

  runInWorker: function() {
    var worker = new Worker('/s/csp-post/js/runner/runner.js');
    worker.addEventListener('message', e => {
      if(e.data.type === 'output') {
        if(this.state.worker === worker) {
          var output = this.state.output;
          this.setState({
            output: output ? (output + '\n' + e.data.output) : e.data.output
          });
        }
      }
      else if(e.data.type === 'results') {
        if(this.state.worker === worker) {
          this.terminateWorker(worker, e.data.data);
        }
      }
      else if(e.data.type === 'done') {
        this.finishWorker(worker, e.data.data);
      }
    });

    worker.postMessage({
      code: this.state.content
    });

    this.setState({
      output: '',
      data: null,
      terminated: false,
      worker: worker,
      running: true,

      // Terminate the process after 10 seconds if it's still
      // running
      terminateTimer: setTimeout(() => {
        worker.postMessage({ type: 'results' });
      }, 10000)
    });
  },

  finishWorker: function(worker, data) {
    if(this.state.worker === worker) {
      clearTimeout(this.state.terminateTimer);

      this.setState({
        data: data,
        worker: null,
        running: false,
        terminateTimer: null
      });
    }

    worker.terminate();
  },

  terminateWorker: function(worker, data) {
    if(this.state.worker === worker) {
      this.setState({
        data: data,
        worker: null,
        running: false,
        terminateTimer: null,
        terminated: true,
      });
    }

    worker.terminate();
  },

  render: function() {
    var data = this.state.data;
    var start, end;

    if(data) {
      start = Math.min.apply(null, data.actions.map(x => {
        return x.time - (x.blockTime || 0);
      }));

      if(this.props.continuous) {
        end = Date.now();
      }
      else {
        end = Math.max.apply(null, data.actions.map(x => x.time));
      }
    }

    return dom.div(
      { className: 'csp-editor' },
      Editor({
        content: this.state.content,
        onChange: this.updateContent
      }),
      Toolbar({ running: this.state.running,
                terminated: this.state.terminated,
                onRun: (this.props.inWorker ?
                        this.runInWorker :
                        this.run) }),
      this.state.output && dom.h4(null, 'Output'),
      this.state.output && dom.pre(null, this.state.output),
      (this.props.visualize && this.state.data) ?
        Timeline({ code: this.state.content,
                   data: data,
                   startTime: start,
                   endTime: end }) :
        null
    );
  }
});

var Toolbar = React.createClass({
  getInitialState: function() {
    return { interval: null,
             periods: 0 };
  },

  componentWillReceiveProps: function(props) {
    if(props.running && !this.state.interval) {
      this.setState({
        interval: setInterval(() => {
          this.setState({
            periods: (this.state.periods + 1) % 4
          });
        }, 100)
      });
    }
    else if(!props.running && this.state.interval) {
      clearInterval(this.state.interval);
      this.setState({
        interval: null
      });
    }
  },

  run: function() {
    // Take off the stupid outline in Chrome (they really shouldn't
    // outline buttons)
    this.getDOMNode().querySelector('button').blur();
    this.props.onRun();
  },

  render: function() {
    var terminated = this.props.terminated;

    return dom.div(
      { className: 'toolbar' },
      dom.button({
        onClick: this.run
      }, this.props.running ? 'Restart' : 'Run'),
      dom.div(
        { className: 'status ' + (terminated ? 'terminated' : '')  },
        this.props.running ?
          'Running ' + _.range(this.state.periods).map(() => '.').join('') :
          null,
        this.props.terminated ?
          'Terminated (processes took too long to finish)' :
          null
      )
    );
  }
});

document.addEventListener('DOMContentLoaded', () => {
  var editors = Array.prototype.slice.call(
    document.querySelectorAll('.editor')
  );
  editors.forEach(el => {
    var needsDOM = el.className.indexOf('needs-dom') !== -1;
    var idx = Array.prototype.indexOf.call(el.parentNode.childNodes, el);
    var htmlOutput;

    do {
      idx++;
      htmlOutput = el.parentNode.childNodes[idx];
    } while(htmlOutput &&
            htmlOutput.nodeType === Node.TEXT_NODE);

    if(htmlOutput.className.indexOf('html-output') === -1) {
      htmlOutput = null;
    }

    React.renderComponent(CspEditor({
      initialValue: el.textContent.trim(),
      visualize: el.className.indexOf('with-results') !== -1,
      htmlOutput: htmlOutput,
      continuous: needsDOM,
      inWorker: !needsDOM
    }), el);
  });
});
