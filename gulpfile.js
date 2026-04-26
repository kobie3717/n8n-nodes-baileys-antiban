const { src, dest } = require('gulp');

function buildIcons() {
  return src(['nodes/**/*.svg', 'nodes/**/*.png'])
    .pipe(dest('dist/nodes'));
}

exports['build:icons'] = buildIcons;
exports.default = buildIcons;
