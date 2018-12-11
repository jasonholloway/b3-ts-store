#!/bin/sh -e
PATH=$PWD/node_modules/.bin:$PATH

echo
echo Copying files... | chalk bgGreen bold

cpx --verbose $@ '{lib,test}/**/!(*.js|*.ts)' dist/
