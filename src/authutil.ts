import * as fs from 'fs';
import * as path from 'path';
import * as core from '@actions/core';
import * as github from '@actions/github';
import {XMLParser, XMLBuilder} from 'fast-xml-parser';

export function configAuthentication(
  feedUrl: string,
  existingFileLocation = '',
  processRoot: string = process.cwd()
) {
  const existingNuGetConfig: string = path.resolve(
    processRoot,
    existingFileLocation === ''
      ? getExistingNugetConfig(processRoot)
      : existingFileLocation
  );

  const tempNuGetConfig: string = path.resolve(
    processRoot,
    '../',
    'nuget.config'
  );

  writeFeedToFile(feedUrl, existingNuGetConfig, tempNuGetConfig);
}

function isValidKey(key: string): boolean {
  return /^[\w\-.]+$/i.test(key);
}

function getExistingNugetConfig(processRoot: string) {
  const defaultConfigName = 'nuget.config';
  const configFileNames = fs
    .readdirSync(processRoot)
    .filter(filename => filename.toLowerCase() === defaultConfigName);
  if (configFileNames.length) {
    return configFileNames[0];
  }
  return defaultConfigName;
}

function writeFeedToFile(
  feedUrl: string,
  existingFileLocation: string,
  tempFileLocation: string
) {
  core.info(
    `dotnet-auth: Finding any source references in ${existingFileLocation}, writing a new temporary configuration file with credentials to ${tempFileLocation}`
  );
  const sourceKeys: string[] = [];
  let owner: string = core.getInput('owner');
  const sourceUrl: string = feedUrl;
  if (!owner) {
    owner = github.context.repo.owner;
  }

  if (!process.env.NUGET_AUTH_TOKEN) {
    throw new Error(
      'The NUGET_AUTH_TOKEN environment variable was not provided. In this step, add the following: \r\nenv:\r\n  NUGET_AUTH_TOKEN: ${{secrets.GITHUB_TOKEN}}'
    );
  }

  if (fs.existsSync(existingFileLocation)) {
    // get key from existing NuGet.config so NuGet/dotnet can match credentials
    const curContents: string = fs.readFileSync(existingFileLocation, 'utf8');

    const parserOptions = {
      ignoreAttributes: false
    };
    const parser = new XMLParser(parserOptions);
    const json = parser.parse(curContents);

    if (typeof json.configuration === 'undefined') {
      throw new Error(`The provided NuGet.config seems invalid.`);
    }
    if (json.configuration?.packageSources?.add) {
      const packageSources = json.configuration.packageSources.add;

      if (Array.isArray(packageSources)) {
        packageSources.forEach(source => {
          const value = source['@_value'];
          core.debug(`source '${value}'`);
          if (value.toLowerCase().includes(feedUrl.toLowerCase())) {
            const key = source['@_key'];
            sourceKeys.push(key);
            core.debug(`Found a URL with key ${key}`);
          }
        });
      } else {
        if (
          packageSources['@_value']
            .toLowerCase()
            .includes(feedUrl.toLowerCase())
        ) {
          const key = packageSources['@_key'];
          sourceKeys.push(key);
          core.debug(`Found a URL with key ${key}`);
        }
      }
    }
  }

  const xmlSource: any[] = [
    {
      '?xml': [
        {
          '#text': ''
        }
      ],
      ':@': {
        '@_version': '1.0'
      }
    },
    {
      configuration: [
        {
          config: [
            {
              add: [],
              ':@': {
                '@_key': 'defaultPushSource',
                '@_value': sourceUrl
              }
            }
          ]
        }
      ]
    }
  ];

  if (!sourceKeys.length) {
    const keystring = 'Source';

    xmlSource[1].configuration.push({
      packageSources: [
        {
          add: [],
          ':@': {
            '@_key': keystring,
            '@_value': sourceUrl
          }
        }
      ]
    });

    sourceKeys.push(keystring);
  }

  const packageSourceCredentials: any[] = [];
  sourceKeys.forEach(key => {
    if (!isValidKey(key)) {
      throw new Error(
        "Source name can contain letters, numbers, and '-', '_', '.' symbols only. Please, fix source name in NuGet.config and try again."
      );
    }

    packageSourceCredentials.push({
      [key]: [
        {
          add: [],
          ':@': {
            '@_key': 'Username',
            '@_value': owner
          }
        },
        {
          add: [],
          ':@': {
            '@_key': 'ClearTextPassword',
            '@_value': process.env.NUGET_AUTH_TOKEN
          }
        }
      ]
    });
  });

  xmlSource[1].configuration.push({
    packageSourceCredentials
  });

  const xmlBuilderOptions = {
    format: true,
    ignoreAttributes: false,
    preserveOrder: true,
    allowBooleanAttributes: true,
    suppressBooleanAttributes: true,
    suppressEmptyNode: true
  };

  const builder = new XMLBuilder(xmlBuilderOptions);

  const output = builder.build(xmlSource).trim();

  fs.writeFileSync(tempFileLocation, output);
}
