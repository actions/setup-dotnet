name: Main workflow

on:
  pull_request:
  push:
    branches:
      - master
      - releases/*

jobs:
  build:
    runs-on: ${{ matrix.operating-system }}
    strategy:
      matrix:
        operating-system: [ubuntu-latest, windows-latest, macOS-latest]
    steps:
    - name: Checkout
      uses: actions/checkout@v2
    - name: Set Node.js 12
      uses: actions/setup-node@v1
      with:
        version: 12.x
    - run: npm ci
    - run: npm run build
    - run: npm run format-check
    - run: npm test
    - name: Verify no unstaged changes
      if: runner.os != 'windows'
      run: __tests__/verify-no-unstaged-changes.sh

  test:
    runs-on: ${{ matrix.operating-system }}
    strategy:
      matrix:
        operating-system: [ubuntu-latest, windows-latest, macOS-latest]
    steps:
      - name: Checkout
        uses: actions/checkout@v2
      - name: Clear tool cache
        run: mv "${{ runner.tool_cache }}" "${{ runner.tool_cache }}.old"
      - name: Setup dotnet 3.0.100
        uses: ./
        with:
          dotnet-version: 3.0.100
      - name: Verify dotnet
        if: runner.os != 'windows'
        run: __tests__/verify-dotnet.sh 3.0.100
      - name: Verify dotnet (Windows)
        if: runner.os == 'windows'
        run: __tests__/verify-dotnet.ps1 3.0.100

  test-proxy:
    runs-on: ubuntu-latest
    container:
      image: mcr.microsoft.com/dotnet/core/runtime-deps:3.0-bionic
      options: --dns 127.0.0.1
    services:
      squid-proxy:
        image: datadog/squid:latest
        ports:
          - 3128:3128
    env:
      https_proxy: http://squid-proxy:3128
    steps:
      - name: Checkout
        uses: actions/checkout@v2
      - name: Clear tool cache
        run: rm -rf $RUNNER_TOOL_CACHE/*
      - name: Setup dotnet 3.0.100
        uses: ./
        with:
          dotnet-version: 3.0.100
      - name: Verify dotnet
        run: __tests__/verify-dotnet.sh 3.0.100

  test-bypass-proxy:
    runs-on: ubuntu-latest
    env:
      https_proxy: http://no-such-proxy:3128
      no_proxy: github.com,dotnetcli.blob.core.windows.net,download.visualstudio.microsoft.com,api.nuget.org
    steps:
      - name: Checkout
        uses: actions/checkout@v2
      - name: Clear tool cache
        run: mv "${{ runner.tool_cache }}" "${{ runner.tool_cache }}.old"
      - name: Setup dotnet 3.0.100
        uses: ./
        with:
          dotnet-version: 3.0.100
      - name: Verify dotnet
        run: __tests__/verify-dotnet.sh 3.0.100
Skip to content
Search or jump to…
Pulls
Issues
Marketplace
Explore
 
@Iixixi 
Your account has been flagged.
Because of that, your profile is hidden from the public. If you believe this is a mistake, contact support to have your account status reviewed.
ruby
/
setup-ruby
Public
generated from actions/javascript-action
Code
Issues
7
Pull requests
15
Actions
Security
Insights
Update new-version script to handle truffleruby+graalvm automatically
Test this action #812
Summary
Jobs
ubuntu-18.04 1.9
ubuntu-18.04 2.0
ubuntu-18.04 2.1
ubuntu-18.04 2.2
ubuntu-18.04 2.3
ubuntu-18.04 2.4
ubuntu-18.04 2.5
ubuntu-18.04 2.6
ubuntu-18.04 2.7
ubuntu-18.04 3.0
ubuntu-18.04 3.1
ubuntu-18.04 ruby-head
ubuntu-18.04 jruby
ubuntu-18.04 jruby-head
ubuntu-18.04 truffleruby
ubuntu-18.04 truffleruby-head
ubuntu-18.04 truffleruby+graalvm
ubuntu-18.04 truffleruby+graalvm-head
ubuntu-20.04 1.9
ubuntu-20.04 2.0
ubuntu-20.04 2.1
ubuntu-20.04 2.2
ubuntu-20.04 2.3
ubuntu-20.04 2.4
ubuntu-20.04 2.5
ubuntu-20.04 2.6
ubuntu-20.04 2.7
ubuntu-20.04 3.0
ubuntu-20.04 3.1
ubuntu-20.04 ruby-head
ubuntu-20.04 jruby
ubuntu-20.04 jruby-head
ubuntu-20.04 truffleruby
ubuntu-20.04 truffleruby-head
ubuntu-20.04 truffleruby+graalvm
ubuntu-20.04 truffleruby+graalvm-head
macos-10.15 1.9
macos-10.15 2.0
macos-10.15 2.1
macos-10.15 2.2
macos-10.15 2.3
macos-10.15 2.4
macos-10.15 2.5
macos-10.15 2.6
macos-10.15 2.7
macos-10.15 3.0
macos-10.15 3.1
macos-10.15 ruby-head
macos-10.15 jruby
macos-10.15 jruby-head
macos-10.15 truffleruby
macos-10.15 truffleruby-head
macos-10.15 truffleruby+graalvm
macos-10.15 truffleruby+graalvm-head
macos-11.0 1.9
macos-11.0 2.0
macos-11.0 2.1
macos-11.0 2.2
macos-11.0 2.3
macos-11.0 2.4
macos-11.0 2.5
macos-11.0 2.6
macos-11.0 2.7
macos-11.0 3.0
macos-11.0 3.1
macos-11.0 ruby-head
macos-11.0 jruby
macos-11.0 jruby-head
macos-11.0 truffleruby
macos-11.0 truffleruby-head
macos-11.0 truffleruby+graalvm
macos-11.0 truffleruby+graalvm-head
windows-2019 2.0
windows-2019 2.1
windows-2019 2.2
windows-2019 2.3
windows-2019 2.4
windows-2019 2.5
windows-2019 2.6
windows-2019 2.7
windows-2019 3.0
windows-2019 3.1
windows-2019 ruby-head
windows-2019 jruby
windows-2019 jruby-head
windows-2022 2.0
windows-2022 2.1
windows-2022 2.2
windows-2022 2.3
windows-2022 2.4
windows-2022 2.5
windows-2022 2.6
windows-2022 2.7
windows-2022 3.0
windows-2022 3.1
windows-2022 ruby-head
windows-2022 jruby
windows-2022 jruby-head
windows-2019 mingw
windows-2019 mswin
windows-2022 mingw
windows-2022 ucrt
Test rubygems input set to latest upgrades the default RubyGems version
Test rubygems input set to a fixed version upgrades RubyGems to that version if the default is older
Test rubygems input set to a fixed version noops if the default is newer
Test with an exact Bundler version
Test gemfile depending on Bundler 1
Test with rails5 gemfile
Test with rails6 gemfile
Test installing a Gemfile with nokogiri on TruffleRuby
lint
macos-11.0 truffleruby
succeeded 3 days ago in 1m 30s
Search logs
2s
Current runner version: '2.286.1'
Operating System
  macOS
  11.6.2
  20G314
Virtual Environment
  Environment: macos-11
  Version: 20220118.8
  Included Software: https://github.com/actions/virtual-environments/blob/macOS-11/20220118.8/images/macos/macos-11-Readme.md
  Image Release: https://github.com/actions/virtual-environments/releases/tag/macOS-11%2F20220118.8
Virtual Environment Provisioner
  1.0.0.0-main-20211214-1
GITHUB_TOKEN Permissions
  Actions: write
  Checks: write
  Contents: write
  Deployments: write
  Discussions: write
  Issues: write
  Metadata: read
  Packages: write
  Pages: write
  PullRequests: write
  RepositoryProjects: write
  SecurityEvents: write
  Statuses: write
Secret source: Actions
Prepare workflow directory
Prepare all required actions
Getting action download info
Download action repository 'actions/checkout@v2' (SHA:ec3a7ce113134d7a93b817d10a8272cb61118579)
3s
Run actions/checkout@v2
  with:
    repository: ruby/setup-ruby
    token: ***
    ssh-strict: true
    persist-credentials: true
    clean: true
    fetch-depth: 1
    lfs: false
    submodules: false
Syncing repository: ruby/setup-ruby
Getting Git version info
  Working directory is '/Users/runner/work/setup-ruby/setup-ruby'
  /usr/local/bin/git version
  git version 2.34.1
Deleting the contents of '/Users/runner/work/setup-ruby/setup-ruby'
Initializing the repository
  /usr/local/bin/git init /Users/runner/work/setup-ruby/setup-ruby
  hint: Using 'master' as the name for the initial branch. This default branch name
  hint: is subject to change. To configure the initial branch name to use in all
  hint: of your new repositories, which will suppress this warning, call:
  hint: 
  hint: 	git config --global init.defaultBranch <name>
  hint: 
  hint: Names commonly chosen instead of 'master' are 'main', 'trunk' and
  hint: 'development'. The just-created branch can be renamed via this command:
  hint: 
  hint: 	git branch -m <name>
  Initialized empty Git repository in /Users/runner/work/setup-ruby/setup-ruby/.git/
  /usr/local/bin/git remote add origin https://github.com/ruby/setup-ruby
Disabling automatic garbage collection
  /usr/local/bin/git config --local gc.auto 0
Setting up auth
  /usr/local/bin/git config --local --name-only --get-regexp core\.sshCommand
  /usr/local/bin/git submodule foreach --recursive git config --local --name-only --get-regexp 'core\.sshCommand' && git config --local --unset-all 'core.sshCommand' || :
  /usr/local/bin/git config --local --name-only --get-regexp http\.https\:\/\/github\.com\/\.extraheader
  /usr/local/bin/git submodule foreach --recursive git config --local --name-only --get-regexp 'http\.https\:\/\/github\.com\/\.extraheader' && git config --local --unset-all 'http.https://github.com/.extraheader' || :
  /usr/local/bin/git config --local http.https://github.com/.extraheader AUTHORIZATION: basic ***
Fetching the repository
  /usr/local/bin/git -c protocol.version=2 fetch --no-tags --prune --progress --no-recurse-submodules --depth=1 origin +8a48a656bf5883c8be5e04c6f057fe83cf8d5e96:refs/remotes/origin/master
  remote: Enumerating objects: 40, done.        
  remote: Counting objects:   2% (1/40)        
  remote: Counting objects:   5% (2/40)        
  remote: Counting objects:   7% (3/40)        
  remote: Counting objects:  10% (4/40)        
  remote: Counting objects:  12% (5/40)        
  remote: Counting objects:  15% (6/40)        
  remote: Counting objects:  17% (7/40)        
  remote: Counting objects:  20% (8/40)        
  remote: Counting objects:  22% (9/40)        
  remote: Counting objects:  25% (10/40)        
  remote: Counting objects:  27% (11/40)        
  remote: Counting objects:  30% (12/40)        
  remote: Counting objects:  32% (13/40)        
  remote: Counting objects:  35% (14/40)        
  remote: Counting objects:  37% (15/40)        
  remote: Counting objects:  40% (16/40)        
  remote: Counting objects:  42% (17/40)        
  remote: Counting objects:  45% (18/40)        
  remote: Counting objects:  47% (19/40)        
  remote: Counting objects:  50% (20/40)        
  remote: Counting objects:  52% (21/40)        
  remote: Counting objects:  55% (22/40)        
  remote: Counting objects:  57% (23/40)        
  remote: Counting objects:  60% (24/40)        
  remote: Counting objects:  62% (25/40)        
  remote: Counting objects:  65% (26/40)        
  remote: Counting objects:  67% (27/40)        
  remote: Counting objects:  70% (28/40)        
  remote: Counting objects:  72% (29/40)        
  remote: Counting objects:  75% (30/40)        
  remote: Counting objects:  77% (31/40)        
  remote: Counting objects:  80% (32/40)        
  remote: Counting objects:  82% (33/40)        
  remote: Counting objects:  85% (34/40)        
  remote: Counting objects:  87% (35/40)        
  remote: Counting objects:  90% (36/40)        
  remote: Counting objects:  92% (37/40)        
  remote: Counting objects:  95% (38/40)        
  remote: Counting objects:  97% (39/40)        
  remote: Counting objects: 100% (40/40)        
  remote: Counting objects: 100% (40/40), done.        
  remote: Compressing objects:   2% (1/35)        
  remote: Compressing objects:   5% (2/35)        
  remote: Compressing objects:   8% (3/35)        
  remote: Compressing objects:  11% (4/35)        
  remote: Compressing objects:  14% (5/35)        
  remote: Compressing objects:  17% (6/35)        
  remote: Compressing objects:  20% (7/35)        
  remote: Compressing objects:  22% (8/35)        
  remote: Compressing objects:  25% (9/35)        
  remote: Compressing objects:  28% (10/35)        
  remote: Compressing objects:  31% (11/35)        
  remote: Compressing objects:  34% (12/35)        
  remote: Compressing objects:  37% (13/35)        
  remote: Compressing objects:  40% (14/35)        
  remote: Compressing objects:  42% (15/35)        
  remote: Compressing objects:  45% (16/35)        
  remote: Compressing objects:  48% (17/35)        
  remote: Compressing objects:  51% (18/35)        
  remote: Compressing objects:  54% (19/35)        
  remote: Compressing objects:  57% (20/35)        
  remote: Compressing objects:  60% (21/35)        
  remote: Compressing objects:  62% (22/35)        
  remote: Compressing objects:  65% (23/35)        
  remote: Compressing objects:  68% (24/35)        
  remote: Compressing objects:  71% (25/35)        
  remote: Compressing objects:  74% (26/35)        
  remote: Compressing objects:  77% (27/35)        
  remote: Compressing objects:  80% (28/35)        
  remote: Compressing objects:  82% (29/35)        
  remote: Compressing objects:  85% (30/35)        
  remote: Compressing objects:  88% (31/35)        
  remote: Compressing objects:  91% (32/35)        
  remote: Compressing objects:  94% (33/35)        
  remote: Compressing objects:  97% (34/35)        
  remote: Compressing objects: 100% (35/35)        
  remote: Compressing objects: 100% (35/35), done.        
  remote: Total 40 (delta 0), reused 18 (delta 0), pack-reused 0        
  From https://github.com/ruby/setup-ruby
   * [new ref]         8a48a656bf5883c8be5e04c6f057fe83cf8d5e96 -> origin/master
Determining the checkout info
Checking out the ref
  /usr/local/bin/git checkout --progress --force -B master refs/remotes/origin/master
  Reset branch 'master'
  Branch 'master' set up to track remote branch 'master' from 'origin'.
/usr/local/bin/git log -1 --format='%H'
'8a48a656bf5883c8be5e04c6f057fe83cf8d5e96'
34s
Run ./
  with:
    ruby-version: truffleruby
    bundler-cache: true
    bundler: default
    working-directory: .
    cache-version: 0
Modifying PATH
  Entries removed from PATH to avoid conflicts with default Ruby:
    /usr/local/lib/ruby/gems/2.7.0/bin
    /usr/local/opt/ruby@2.7/bin
  Entries added to PATH to use selected Ruby:
    /Users/runner/.rubies/truffleruby-21.3.0/bin
Downloading Ruby
  https://github.com/ruby/ruby-builder/releases/download/toolcache/truffleruby-21.3.0-macos-latest.tar.gz
  Took   2.33 seconds
Extracting  Ruby
  /usr/bin/tar -xz -C /Users/runner/.rubies -f /Users/runner/work/_temp/b29bc5ca-d817-4e59-bdfb-5c3d65cda198
  Took   4.05 seconds
Print Ruby version
  /Users/runner/.rubies/truffleruby-21.3.0/bin/ruby --version
  truffleruby 21.3.0, like ruby 2.7.4, GraalVM CE Native [x86_64-darwin]
  Took   2.10 seconds
Installing Bundler
  /Users/runner/.rubies/truffleruby-21.3.0/bin/gem install bundler -v ~> 2
  Successfully installed bundler-2.3.5
  1 gem installed
  Took  11.48 seconds
bundle install
  /Users/runner/.rubies/truffleruby-21.3.0/bin/bundle config --local path /Users/runner/work/setup-ruby/setup-ruby/vendor/bundle
  /Users/runner/.rubies/truffleruby-21.3.0/bin/bundle lock
  Fetching gem metadata from https://rubygems.org/.
  Resolving dependencies...
  Writing lockfile to /Users/runner/work/setup-ruby/setup-ruby/Gemfile.lock
  Cache key: setup-ruby-bundler-cache-v3-macos-11.0-truffleruby-21.3.0-Gemfile.lock-524e8809b3afbc23fbae7f2b441161b475f3f455203600e9ea35569ef26f4407
  Received 694158 of 694158 (100.0%), 3.6 MBs/sec
  Cache Size: ~1 MB (694158 B)
  /usr/local/bin/gtar --use-compress-program zstd -d -xf /Users/runner/work/_temp/4505c347-bab0-42ab-9476-f929fbfa785b/cache.tzst -P -C /Users/runner/work/setup-ruby/setup-ruby --delay-directory-restore
  Cache restored successfully
  Found cache for key: setup-ruby-bundler-cache-v3-macos-11.0-truffleruby-21.3.0-Gemfile.lock-524e8809b3afbc23fbae7f2b441161b475f3f455203600e9ea35569ef26f4407
  /Users/runner/.rubies/truffleruby-21.3.0/bin/bundle install --jobs 4
  Using rake 13.0.6
  Using bundler 2.3.5
  Using json 2.2.0
  Using path 2.0.1
  Bundle complete! 3 Gemfile dependencies, 4 gems now installed.
  Bundled gems are installed into `./vendor/bundle`
  Took  14.25 seconds

1s
4s
0s
0s
1s
0s
0s
1s
1s
2s
2s
28s
1s
Run bundle --version
  bundle --version
  shell: /bin/bash -e {0}
  env:
    PATH: /usr/local/opt/pipx_bin:/Users/runner/.cargo/bin:/usr/local/opt/curl/bin:/usr/local/bin:/usr/local/sbin:/Users/runner/bin:/Users/runner/.yarn/bin:/Users/runner/Library/Android/sdk/tools:/Users/runner/Library/Android/sdk/platform-tools:/Users/runner/Library/Android/sdk/ndk-bundle:/Library/Frameworks/Mono.framework/Versions/Current/Commands:/usr/bin:/bin:/usr/sbin:/sbin:/Users/runner/.dotnet/tools:/Users/runner/.ghcup/bin:/Users/runner/hostedtoolcache/stack/2.7.3/x64
Bundler version 2.3.5
4s
Run bundle install
  bundle install
  shell: /bin/bash -e {0}
  env:
    PATH: /usr/local/opt/pipx_bin:/Users/runner/.cargo/bin:/usr/local/opt/curl/bin:/usr/local/bin:/usr/local/sbin:/Users/runner/bin:/Users/runner/.yarn/bin:/Users/runner/Library/Android/sdk/tools:/Users/runner/Library/Android/sdk/platform-tools:/Users/runner/Library/Android/sdk/ndk-bundle:/Library/Frameworks/Mono.framework/Versions/Current/Commands:/usr/bin:/bin:/usr/sbin:/sbin:/Users/runner/.dotnet/tools:/Users/runner/.ghcup/bin:/Users/runner/hostedtoolcache/stack/2.7.3/x64
Using rake 13.0.6
Using bundler 2.3.5
Using json 2.2.0
Using path 2.0.1
Bundle complete! 3 Gemfile dependencies, 4 gems now installed.
Bundled gems are installed into `./vendor/bundle`
2s
3s
Run bundle exec rake
  bundle exec rake
  shell: /bin/bash -e {0}
  env:
    PATH: /usr/local/opt/pipx_bin:/Users/runner/.cargo/bin:/usr/local/opt/curl/bin:/usr/local/bin:/usr/local/sbin:/Users/runner/bin:/Users/runner/.yarn/bin:/Users/runner/Library/Android/sdk/tools:/Users/runner/Library/Android/sdk/platform-tools:/Users/runner/Library/Android/sdk/ndk-bundle:/Library/Frameworks/Mono.framework/Versions/Current/Commands:/usr/bin:/bin:/usr/sbin:/sbin:/Users/runner/.dotnet/tools:/Users/runner/.ghcup/bin:/Users/runner/hostedtoolcache/stack/2.7.3/x64
Hello World from Rake
0s
Run which -a ruby rake
  which -a ruby rake
  shell: /bin/bash -e {0}
  env:
    PATH: /usr/local/opt/pipx_bin:/Users/runner/.cargo/bin:/usr/local/opt/curl/bin:/usr/local/bin:/usr/local/sbin:/Users/runner/bin:/Users/runner/.yarn/bin:/Users/runner/Library/Android/sdk/tools:/Users/runner/Library/Android/sdk/platform-tools:/Users/runner/Library/Android/sdk/ndk-bundle:/Library/Frameworks/Mono.framework/Versions/Current/Commands:/usr/bin:/bin:/usr/sbin:/sbin:/Users/runner/.dotnet/tools:/Users/runner/.ghcup/bin:/Users/runner/hostedtoolcache/stack/2.7.3/x64
/Users/runner/.rubies/truffleruby-21.3.0/bin/ruby
/usr/bin/ruby
/Users/runner/.rubies/truffleruby-21.3.0/bin/rake
/usr/bin/rake
0s
0s
Run echo ~
/Users/runner
0s
1s
Post job cleanup.
/usr/local/bin/git version
git version 2.34.1
/usr/local/bin/git config --local --name-only --get-regexp core\.sshCommand
/usr/local/bin/git submodule foreach --recursive git config --local --name-only --get-regexp 'core\.sshCommand' && git config --local --unset-all 'core.sshCommand' || :
/usr/local/bin/git config --local --name-only --get-regexp http\.https\:\/\/github\.com\/\.extraheader
http.https://github.com/.extraheader:
/usr/local/bin/git config --local --unset-all http.https://github.com/.extraheader
/usr/local/bin/git submodule foreach --recursive git config --local --name-only --get-regexp 'http\.https\:\/\/github\.com\/\.extraheader' && git config --local --unset-all 'http.https://github.com/.extraheader' || :
0s:
Cleaning up orphan processes:
