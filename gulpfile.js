var gulp = require('gulp'),
    jshint = require('gulp-jshint'),
    karma = require('gulp-karma');

var testFiles = [
  'node_modules/jquery/dist/jquery.min.js',
  'node_modules/lodash/dist/lodash.min.js',
  'src/**/*.js',
  'test/**/*.js'
];

/* Set up tasks */
gulp.task('test', function() {
  // Be sure to return the stream
  return gulp.src(testFiles)
    .pipe(karma({
      configFile: 'karma.conf.js',
      action: 'run'
    }));
});

gulp.task('watch', function() {
  gulp.src(testFiles)
    .pipe(karma({
      configFile: 'karma.conf.js',
      action: 'watch'
    }));
});

gulp.task('lint', function() {
  gulp.src('./lib/*.js')
    .pipe(jshint())
    .pipe(jshint.reporter('default'));
});

gulp.task('default', ['watch'], function() {
});
