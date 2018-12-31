#!/bin/sh
set -eux

npm run webpack
java -jar public2/closure-compiler-v20180402.jar --js public/bundle.js --js_output_file public/bundle.min.js
ls -gh public/bundle*js
mv public/bundle.min.js public/bundle.js
