var gulp = require('gulp');
var gutil = require('gulp-util');
var regenerator = require('gulp-regenerator');
var rename = require('gulp-rename');
var webpack = require('webpack');
var webpackConfig = require('./webpack.config');

var webpackInst = webpack(webpackConfig);
gulp.task("webpack", ["regenerate"], function(cb) {
  webpackInst.run(function(err, stats) {
    if(err) throw new gutil.PluginError("webpack", err);
    gutil.log("[webpack]", stats.toString());
    cb();
  });
});

gulp.task("webpack-watch", function(cb) {
  webpackInst.watch(200, function(err, stats) {
    if(err) throw new gutil.PluginError("webpack", err);
    gutil.log("[webpack]", stats.toString());
  });
});

gulp.task("worker-scripts", ["regenerate"], function() {
  function make(infile, outfile, name) {
    var config = {
      entry: infile,
      output: {
        filename: outfile,
        library: name
      },
      externals: {
        fs: 'null'
      }
    };

    if(process.env.NODE_ENV === 'production') {
      config.plugins = [
        new webpack.DefinePlugin({
          "process.env": {
            NODE_ENV: JSON.stringify("production")
          }
        }),
        new webpack.optimize.DedupePlugin(),
        new webpack.optimize.UglifyJsPlugin(),
        new webpack.optimize.OccurenceOrderPlugin()
      ];
    }

    webpack(config).run(function(err, stats) {
      if(err) throw new gutil.PluginError("webpack", err);
      gutil.log("[webpack]", stats.toString());
    });
  }

  make('./js/lib/regenerator.js',
       './js/runner/regenerator.js',
       'regenerator');
  make('./js/lib/csp/index.js',
       './js/runner/csp.js',
       'csp');
});

gulp.task("regenerate", function() {
  return gulp.src('node_modules/js-csp/src/**/*.js')
    .pipe(regenerator())
    .pipe(gulp.dest('js/lib/csp'))
    .on('end', function() {
      gulp.src('js/lib/csp/csp.js')
        .pipe(rename('index.js'))
        .pipe(gulp.dest('js/lib/csp'));
    });
});

gulp.task('default', ['regenerate', 'webpack']);
