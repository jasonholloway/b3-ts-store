#!/bin/sh -e
PATH=$PWD/node_modules/.bin:$PATH

tasks/clean.sh

concurrently --kill-others \
    --names "TSC,Sync" -c "bgBlue.bold,bgGreen.bold" \
    "sh -c 'tasks/transpile.sh --watch --preserveWatchOutput'" \
    "sh -c 'tasks/sync.sh --watch'"
