#!/bin/sh -e
PATH=$PWD/node_modules/.bin:$PATH

echo
echo Cleaning... | chalk bgBlack bold

rm -rf dist/
