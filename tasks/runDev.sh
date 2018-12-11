#!/bin/sh -e
PATH=$PWD/node_modules/.bin:$PATH

NODE_ENV=ci \
    nodemon $@ dist/index.js