var transform = require('regenerator/lib/visit').transform;
var recast = require("recast");
var types = recast.types;

module.exports = function(source, opts) {
  opts = opts || {};
  opts.range = true;
  var ast = recast.parse(source, opts);
  var path = new types.NodePath(ast);
  var programPath = path.get("program");

  transform(programPath);
  return recast.print(path, opts);
};
