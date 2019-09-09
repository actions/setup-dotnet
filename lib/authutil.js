"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const xmlbuilder = __importStar(require("xmlbuilder"));
const xmlParser = __importStar(require("fast-xml-parser"));
function configAuthentication(feedUrl, existingFileLocation = '') {
    const existingNuGetConfig = path.resolve(process.env['RUNNER_TEMP'] || process.cwd(), existingFileLocation == '' ? 'nuget.config' : existingFileLocation);
    const tempNuGetConfig = path.resolve(process.env['RUNNER_TEMP'] || process.cwd(), '../', 'nuget.config');
    writeFeedToFile(feedUrl, existingNuGetConfig, tempNuGetConfig);
}
exports.configAuthentication = configAuthentication;
function writeFeedToFile(feedUrl, existingFileLocation, tempFileLocation) {
    console.log(`dotnet-auth: Finding any source references in ${existingFileLocation}, writing a new temporary configuration file with credentials to ${tempFileLocation}`);
    let xml;
    let gprKeys = [];
    let owner = core.getInput('owner');
    if (!owner && feedUrl.indexOf('nuget.pkg.github.com') > -1) {
        owner = github.context.repo.owner;
    }
    let sourceUrl = 'https://nuget.pkg.github.com/' + owner;
    if (!process.env.NUGET_AUTH_TOKEN || process.env.NUGET_AUTH_TOKEN == '') {
        throw new Error('The NUGET_AUTH_TOKEN environment variable was not provided. In this step, add the following: \r\nenv:\r\n  NUGET_AUTH_TOKEN: ${{secrets.GITHUB_TOKEN}}');
    }
    if (fs.existsSync(existingFileLocation)) {
        // get key from existing NuGet.config so NuGet/dotnet can match credentials
        const curContents = fs.readFileSync(existingFileLocation, 'utf8');
        var json = xmlParser.parse(curContents, { ignoreAttributes: false });
        if (typeof json.configuration == 'undefined') {
            throw new Error(`The provided NuGet.config seems invalid.`);
        }
        if (typeof json.configuration.packageSources != 'undefined') {
            if (typeof json.configuration.packageSources.add != 'undefined') {
                // file has at least one <add>
                if (typeof json.configuration.packageSources.add[0] == 'undefined') {
                    // file has only one <add>
                    if (json.configuration.packageSources.add['@_value']
                        .toLowerCase()
                        .includes('nuget.pkg.github.com')) {
                        let key = json.configuration.packageSources.add['@_key'];
                        gprKeys.push(key);
                        core.debug(`Found a GPR URL with key ${key}`);
                    }
                }
                else {
                    // file has 2+ <add>
                    for (let i = 0; i < json.configuration.packageSources.add.length; i++) {
                        core.debug(json.configuration.packageSources.add[i]);
                        if (json.configuration.packageSources.add[i]['@_value']
                            .toLowerCase()
                            .includes('nuget.pkg.github.com')) {
                            let key = json.configuration.packageSources.add[i]['@_key'];
                            gprKeys.push(key);
                            core.debug(`Found a GPR URL with key ${key}`);
                        }
                    }
                }
            }
        }
    }
    xml = xmlbuilder
        .create('configuration')
        .ele('config')
        .ele('add', { key: 'defaultPushSource', value: sourceUrl })
        .up()
        .up();
    if (gprKeys.length == 0) {
        let keystring = 'GPR';
        xml = xml
            .ele('packageSources')
            .ele('add', { key: keystring, value: sourceUrl })
            .up()
            .up();
        gprKeys.push(keystring);
    }
    gprKeys.forEach(key => {
        if (key.indexOf(' ') > -1) {
            throw new Error("This action currently can't handle source names with spaces. Remove the space from your repo's NuGet.config and try again.");
        }
        xml = xml
            .ele('packageSourceCredentials')
            .ele(key)
            .ele('add', { key: 'Username', value: owner })
            .up()
            .ele('add', {
            key: 'ClearTextPassword',
            value: process.env.NUGET_AUTH_TOKEN
        })
            .up()
            .up();
    });
    // If NuGet fixes itself such that on Linux it can look for environment variables in the config file (it doesn't seem to work today),
    // use this for the value above
    //           process.platform == 'win32'
    //             ? '%NUGET_AUTH_TOKEN%'
    //             : '$NUGET_AUTH_TOKEN'
    var output = xml.end({ pretty: true });
    fs.writeFileSync(tempFileLocation, output);
}
