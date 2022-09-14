#!/bin/bash

if [ "$(git diff --ignore-space-at-eol dist/ | wc -l)" -gt "0" ]; then
    echo "Detected uncommitted changes after build.  See status below:"
    git diff
    exit 1
fi
