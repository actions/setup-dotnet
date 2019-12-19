"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
// Load tempDirectory before it gets wiped by tool-cache
const exec = __importStar(require("@actions/exec"));
const io = __importStar(require("@actions/io"));
const fs_1 = require("fs");
const path = __importStar(require("path"));
const IS_WINDOWS = process.platform === 'win32';
class DotnetCoreInstaller {
    constructor(version = '', jsonfile = '') {
        this.version = version;
        this.jsonfile = jsonfile;
    }
    installDotnet() {
        return __awaiter(this, void 0, void 0, function* () {
            let output = '';
            let resultCode = 0;
            var envVariables = {};
            for (let key in process.env) {
                if (process.env[key]) {
                    let value = process.env[key];
                    envVariables[key] = value;
                }
            }
            if (IS_WINDOWS) {
                let escapedScript = path
                    .join(__dirname, '..', 'externals', 'install-dotnet.ps1')
                    .replace(/'/g, "''");
                let command = `& '${escapedScript}'`;
                if (this.version) {
                    command += ` -Version ${this.version}`;
                }
                if (this.jsonfile) {
                    command += ` -jsonfile ${this.jsonfile}`;
                }
                // process.env must be explicitly passed in for DOTNET_INSTALL_DIR to be used
                const powershellPath = yield io.which('powershell', true);
                var options = {
                    listeners: {
                        stdout: (data) => {
                            output += data.toString();
                        }
                    },
                    env: envVariables
                };
                resultCode = yield exec.exec(`"${powershellPath}"`, [
                    '-NoLogo',
                    '-Sta',
                    '-NoProfile',
                    '-NonInteractive',
                    '-ExecutionPolicy',
                    'Unrestricted',
                    '-Command',
                    command
                ], options);
            }
            else {
                let escapedScript = path
                    .join(__dirname, '..', 'externals', 'install-dotnet.sh')
                    .replace(/'/g, "''");
                fs_1.chmodSync(escapedScript, '777');
                const scriptPath = yield io.which(escapedScript, true);
                let scriptArguments = [];
                if (this.version) {
                    scriptArguments.push('--version', this.version);
                }
                if (this.jsonfile) {
                    scriptArguments.push('--jsonfile', this.jsonfile);
                }
                // process.env must be explicitly passed in for DOTNET_INSTALL_DIR to be used
                resultCode = yield exec.exec(`"${scriptPath}"`, scriptArguments, {
                    listeners: {
                        stdout: (data) => {
                            output += data.toString();
                        }
                    },
                    env: envVariables
                });
            }
            if (resultCode != 0) {
                throw `Failed to install dotnet ${resultCode}. ${output}`;
            }
        });
    }
}
exports.DotnetCoreInstaller = DotnetCoreInstaller;
