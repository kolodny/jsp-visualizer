var webpack = require('webpack');

var config = {
  cache: true,
  entry: './js/main.js',
  output: {
    filename: './js/bundle.js'
  },
  resolve: {
    extensions: ['', '.js', '.sjs'],
    fallback: __dirname
  },
  module: {
    loaders: [
      {test: /codemirror.js$/,
       loader: 'exports?window.CodeMirror'},
      {test: /\.js$/,
       exclude: [/js\/lib\/.*\.js$/,
                 /node_modules\/.*/],
       loader: 'sweetjs?modules[]=es6-macros'},
      {test: /\.less$/, loader: "style!css!less"},
      {test: /\.css$/, loader: "style!css"}
    ]
  },
  plugins: [],
  externals: {
    fs: 'null'
  }
};

if(process.env.NODE_ENV === 'production') {
  config.plugins = config.plugins.concat([
    new webpack.DefinePlugin({
      "process.env": {
        NODE_ENV: JSON.stringify("production")
      }
    }),
    new webpack.optimize.DedupePlugin(),
    new webpack.optimize.UglifyJsPlugin(),
    new webpack.optimize.OccurenceOrderPlugin()
  ]);
}
else {
  // config.devtool = 'sourcemap';
  config.debug = true;
}

module.exports = config;
