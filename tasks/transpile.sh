#!/bin/sh -e
PATH=$PWD/node_modules/.bin:$PATH

echo
echo Transpiling...| chalk bgBlue bold

tsc --pretty $@
