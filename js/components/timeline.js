var React = require('react');
var d3 = require('d3');
var Set = require('set');
var dom = React.DOM;

// =====================================================================
// Process management

function ProcessStore() {
}

ProcessStore.prototype = {
  processes: [],
  operations: [],

  addProcess: function(id, name) {
    this.processes.push({
      id: id,
      name: name,
      blocks: [],
      closes: [],
      source: null,
      startTime: 0,
      endTime: 0
    });
  },

  getProcess: function(id) {
    return _.find(this.processes, proc => proc.id === id);
  },

  getProcessIndex: function(id) {
    return this.processes.indexOf(
      _.find(this.processes, proc => proc.id === id)
    );
  },

  getProcessText: function(loc) {
    return this.getProcess(id).source;
  },

  getSourceLine: function(source, loc) {
    var lines = source.split('\n');
    return lines[loc.line - 1];
  },

  getProcesses: function() {
    return this.processes;
  },

  getOperations: function() {
    return this.operations;
  },

  parseData: function(data) {
    this.operations = [];
    this.processes = [];

    var ops = [];
    var actions = data.actions;

    Object.keys(data.processes).forEach(k => {
      var proc = data.processes[k];
      this.addProcess(proc.id, proc.name);
    });

    actions.forEach(d => {
      switch(d.type) {
      case 'slept':
        this.getProcess(d.procId).blocks.push({
          type: 'sleep',
          start: d.time - d.blockedTime,
          end: d.time
        });
        break;
      case 'taking':
      case 'putting':
        var isTaking = d.type === 'taking';
        var blockField = isTaking ? 'putId' : 'takeId';
        var procId = d[blockField];

        if(d.blockedTime && procId) {
          this.getProcess(procId).blocks.push({
            type: d.isAlt ? 'alt-block' : 'block',
            start: d.time - d.blockedTime,
            end: d.time
          });
        }

        this.operations.push({
          takeTime: d.takeTime,
          takeId: d.takeId,
          putTime: d.putTime,
          putId: d.putId,
          value: d.value
        });
        break;
      case 'closing':
        this.getProcess(d.procId).closes.push(d.time);
        this.getProcess(d.procId).blocks.push({
          type: d.isAlt ? 'alt-block' : 'block',
          start: d.time - d.blockedTime,
          end: d.time
        });
        break;
      case 'stopping':
        var proc = this.getProcess(d.procId);
        proc.startTime = d.time - d.runningTime;
        proc.endTime = d.time;
        break;
      }
    });

    this.processes = _.sortBy(this.processes, proc => proc.id),
    this.operations = _.sortBy(this.operations, op => op.time);
  }
}

// =====================================================================
// SVG rendering

function Renderer(processStore) {
  this.processStore = processStore;
}

Renderer.prototype = {
  init: function(svg, comp) {
    svg.on('mouseout', () => {
      this.renderArrows(svg.select('g.viz'));

      comp.setState({
        highlightedOps: null
      });
    });

    svg.on('mousemove', () => {
      var group = svg.select('g.viz');
      var coord = d3.mouse(group[0][0]);
      var x = coord[0];
      var xScale = this.xScale;
      var time = xScale.invert(x);
      var ops = this.processStore.getOperations();
      var highlighted = new Set();

      for(var i=0; i<ops.length; i++) {
        if(xScale(Math.abs((ops[i].takeTime - comp.props.startTime) - time)) < 10) {
          highlighted.add(i);
        }
      }

      for(var i=0; i<ops.length; i++) {
        if(i === ops.length - 1) {
          highlighted.add(i);
        }
        else {
          var nextTime = ops[i + 1].takeTime - comp.props.startTime;
          var curTime = ops[i].takeTime - comp.props.startTime;

          console.log(i, curTime, nextTime);

          if(nextTime > time) {
            if(time - curTime > nextTime - time) {
              highlighted.add(i + 1);
            }
            else {
              highlighted.add(i);
            }
            break;
          }
        }
      }

      this.renderArrows(group, highlighted);

      if(highlighted.size()) {
        comp.setState({
          highlightedOps: highlighted.get().map(i => ops[i]),
          mousePos: [d3.event.clientX, d3.event.clientY]
        });
      }
    });

    this.addDefs(svg);

    this.xOffset = 20;
    svg.append('g')
      .attr('class', 'viz')
      .attr('transform', 'translate(' + this.xOffset + ', 0)')
      .append('g').attr('class', 'axis');
  },

  render: function(svg, opts) {
    var width = svg.attr('width');
    var height = svg.attr('height');
    var { xScale, startTime, endTime,
          barHeight, barSpacing } = opts;
    this.xScale = xScale;
    this.width = width;
    this.height = height;

    // Precalcuate the positions of the arrows. We can look into this
    // array later using the index of the operation in the array.
    this.arrowPaths = this.processStore.getOperations().map(op => {
      var x1 = xScale(op.takeTime - startTime);
      var x2 = xScale(op.putTime - startTime);
      var i1 = this.processStore.getProcessIndex(op.takeId);
      var i2 = this.processStore.getProcessIndex(op.putId);
      var y1, y2;
      var fullBarHeight = barHeight + barSpacing;

      if(i1 < i2) {
        y1 = i1 * fullBarHeight + barHeight + 4;
        y2 = i2 * fullBarHeight;
      }
      else {
        y1 = i1 * fullBarHeight - 4;
        y2 = i2 * fullBarHeight + barHeight;
      }

      return [{ x: x2, y: y2 + 5 },
              { x: x1, y: y1 + 5 }];
    });

    var group = svg.select('g.viz');

    this.renderAxis(svg.select('g.axis'));
    this.renderProcs(group, barHeight, barSpacing, startTime, endTime);
    this.renderArrows(group);

    this.rendered = true;
  },

  addDefs: function(svg) {
    function arrow(id, orient, color) {
      svg.append("svg:defs").selectAll("#" + id)
        .data([id])
        .enter().append("svg:marker")
        .attr("id", String)
        .attr("viewBox", "0 0 6 6")
        .attr("refX", 3)
        .attr("refY", 3)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", orient)
        .attr("fill", color)
        .append("svg:path")
        .attr("d", "M0,0L6,3L0,6");
    }

    arrow('arrow-down', '90', '#F6B953');
    arrow('arrow-up', '-90', '#F6B953');
    arrow('arrow-down-highlight', '90', '#F58321');
    arrow('arrow-up-highlight', '-90', '#F58321');
  },

  renderProcs: function(node, barHeight, barSpacing, startTime, endTime) {
    var group = node;
    var procs = this.processStore.getProcesses();
    var xScale = this.xScale;

    procs.forEach((proc, i) => {
      group.append('rect')
        .attr('x', xScale(Math.max((proc.startTime || 0) - startTime, 0)))
        .attr('y', i * (barHeight + barSpacing) + 5)
        .attr('width', xScale((proc.endTime || Date.now()) - startTime))
        .attr('height', barHeight)
        .attr('class', 'bar execute');

      var blockers = proc.blocks;
      var els = group.selectAll('.bar-' + i).data(blockers);
      els.enter()
        .append('rect')
        .attr('class', d => {
          return '.bar-' + i + ' bar ' + d.type;
        })
        .attr('x', d => {
          return xScale(d.start - startTime);
        })
        .attr('y', i * (barHeight + barSpacing) + 5)
        .attr('width', d => {
          return xScale(d.end - d.start);
        })
        .attr('height', barHeight);
    });
  },

  renderAxis: function(node) {
    var group = node;
    var xAxis = d3.svg.axis()
        .scale(this.xScale)
        .ticks(5)
        .tickSize(-this.height, 0)
        .tickFormat(d => {
          if(this.xScale.domain()[1] > 1000) {
            return d / 1000 + 's';
          }
          return d + 'ms';
        });

    group.attr('transform', 'translate(0, ' + (this.height - 30) + ')')
      .call(xAxis)
      .selectAll('.tick text')
      .attr('y', 5);
  },

  renderArrows: function(node, highlighted) {
    highlighted = highlighted || new Set();
    var arrowPaths = this.arrowPaths;
    var lineFunc = d3.svg.line();
    var points = arrowPaths;
    var group = node;
    var color = 'rgb(0, 200, 0)';
    var highlightColor = 'red';

    function lookupMarker(d, i) {
      if(d[0].y > d[1].y) {
        if(highlighted.contains(i)) {
          return 'url(#arrow-up-highlight)';
        }
        else {
          return 'url(#arrow-up)';
        }
      }
      else {
        if(highlighted.contains(i)) {
          return 'url(#arrow-down-highlight)';
        }
        else {
          return 'url(#arrow-down)';
        }
      }
    }

    var els = group.selectAll('.take').data(points);
    els.enter()
      .append('line')
      .attr('class', 'take')

    els.attr('marker-end', lookupMarker)
      .attr('class', (d, i) => {
        if(highlighted.contains(i)) {
          return 'take highlight';
        }
        return 'take';
      })
      .attr('x1', d => d[0].x)
      .attr('y1', d => d[0].y)
      .attr('x2', d => d[1].x)
      .attr('y2', d => d[1].y)
      .attr('marker-end', lookupMarker);

    els.exit().remove();
  }
}

// =====================================================================
// Timeline components

var Timeline = React.createClass({
  getInitialState: function() {
    return { highlightedOps: null,
             mousePos: null,
             processStore: new ProcessStore() };
  },

  componentDidMount: function() {
    var processStore = this.state.processStore;
    var renderer = new Renderer(processStore);
    processStore.parseData(this.props.data);

    var node = this.getDOMNode().querySelector('svg');
    var svg = d3.select(node);
    renderer.init(svg, this);

    this.setState({ renderer: renderer });
  },

  componentDidUpdate: function(prevProps, prevState) {
    var processStore = this.state.processStore;
    var renderer = this.state.renderer;

    if(this.props.data !== prevProps.data) {
      processStore.parseData(this.props.data);
    }

    // Don't rerender just because the tooltip changed
    if(this.state.highlightedOps !== prevState.highlightedOps) {
      return;
    }

    var runningTime = this.props.endTime - this.props.startTime;
    var node = this.getDOMNode().querySelector('svg');

    var processList = this.getDOMNode().querySelector('.process-list');
    var width = 800 - processList.getBoundingClientRect().width;

    var barHeight = 15;
    var barSpacing = 15;
    var svg = d3.select(node)
        .attr('width', width)
        .attr('height', (processStore.getProcesses().length *
                         (barHeight + barSpacing)) + 30);

    var xScale = d3.scale.linear()
        .domain([0, runningTime])
        .range([0, width - 40]);

    renderer.render(svg, {
      xScale: xScale,
      startTime: this.props.startTime,
      endTime: this.props.endTime,
      barHeight: barHeight,
      barSpacing: barSpacing
    });
  },

  render: function() {
    var highlight = null;
    if(this.state.highlightedOps) {
      highlight = OperationTooltip({
        code: this.props.code,
        operations: this.state.highlightedOps,
        startTime: this.props.startTime,
        mousePos: this.state.mousePos,
        renderer: this.state.renderer
      });
    }

    return dom.div(
      { className: 'timeline' },
      Key(),
      dom.ul(
        { className: 'process-list' },
        this.state.processStore.getProcesses().map((proc, i) => {
          return dom.div(
            { key: i,
              className: 'process-name' },
            dom.li(null, 'Process ' + proc.id)
          );
        })
      ),
      dom.svg(null),
      highlight
    );
  }
});

var Key = React.createClass({
  render: function() {
    return dom.div(
      { className: 'key' },
      dom.div({ className: 'alt-block' }, 'Blocked w/alt'),
      dom.div({ className: 'block' }, 'Blocked'),
      dom.div({ className: 'sleep' }, 'Sleeping'),
      dom.div({ className: 'execute' }, 'Executing')
    );
  }
});

var OperationTooltip = React.createClass({
  componentDidMount: function() {
    this.componentDidUpdate();
  },

  componentDidUpdate: function() {
    var op = this.props.operations[0];
    var parentNode = this.getDOMNode().parentNode;
    var svg = parentNode.querySelector('svg');
    var tip = this.getDOMNode();
    var rel = parentNode.getBoundingClientRect();
    var svgPos = svg.getBoundingClientRect();
    var opX = (
      this.props.renderer.xScale(op.takeTime - this.props.startTime) +
      this.props.renderer.xOffset
    );
    var offset;

    // Subtract 65 to align the pointer of the box directly with the
    // operation line (see `left` property of `.tip-up:after`)
    var left = (svgPos.left - rel.left) + opX;

    if(left > svgPos.width / 2) {
      offset = 355;
      tip.classList.add('left');
    }
    else {
      offset = 65;
      tip.classList.remove('left');
    }

    tip.style.left = left - offset + 'px'
    tip.style.top = this.props.mousePos[1] - rel.top + 40 + 'px';
  },

  render: function() {
    return dom.div(
      { className: 'tip-up op-tip' },
      this.props.operations.map(op => {
        return dom.div(
          null,
          dom.strong(null, 'Process ' + op.putId),
          ' put the value ',
          dom.strong({ className: 'value' }, op.value),
          ' and process ',
          dom.strong(null, 'process ' + op.takeId),
          ' took it'
        )
      })
    );
  }
});

module.exports = Timeline;
