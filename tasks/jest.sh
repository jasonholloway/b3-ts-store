#!/bin/sh -e
PATH=$PWD/node_modules/.bin:$PATH

echo
echo Testing... | chalk bgYellow bold

NODE_ENV=ci \
    jest --coverage --no-cache $@
