import cscFile from '../.github/csc.json';
describe('csc tests', () => {
  const regexPattern = cscFile['problemMatcher'][0]['pattern'][0]['regexp'];
  const regexResultsMap = cscFile['problemMatcher'][0]['pattern'][0];
  const regex = new RegExp(regexPattern);

  const testCases: Array<{input: string; results: Record<string, string>}> = [
    {
      input:
        'Program.cs(10,79): error CS1002: ; expected [/Users/zacharyeisinger/Documents/repo/setup-dotnet/__tests__/sample-broken-csproj/sample.csproj]',
      results: {
        file: 'Program.cs',
        line: '10',
        column: '79',
        severity: 'error',
        code: 'CS1002',
        message: '; expected',
        fromPath:
          '/Users/zacharyeisinger/Documents/repo/setup-dotnet/__tests__/sample-broken-csproj/sample.csproj'
      }
    },
    {
      input:
        "S:\\Msbuild\\src\\Build\\Evaluation\\ExpressionShredder.cs(33,7): error CS1003: Syntax error, ',' expected [S:\\msbuild\\src\\Build\\Microsoft.Build.csproj > Properties:prop]",
      results: {
        file: 'S:\\Msbuild\\src\\Build\\Evaluation\\ExpressionShredder.cs',
        line: '33',
        column: '7',
        severity: 'error',
        code: 'CS1003',
        message: "Syntax error, ',' expected",
        fromPath:
          'S:\\msbuild\\src\\Build\\Microsoft.Build.csproj > Properties:prop'
      }
    },
    {
      // `dotnet format` style error
      input:
        'C:\\actions-runner\\_work\\Some\\Folder\\SomeFile.cs(222,8): error WHITESPACE: Fix whitespace formatting. Delete 1 characters. [C:\\actions-runner\\_work\\Some\\Folder\\SomeProject.csproj]',
      results: {
        file: 'C:\\actions-runner\\_work\\Some\\Folder\\SomeFile.cs',
        line: '222',
        column: '8',
        severity: 'error',
        code: 'WHITESPACE',
        message: 'Fix whitespace formatting. Delete 1 characters.',
        fromPath: 'C:\\actions-runner\\_work\\Some\\Folder\\SomeProject.csproj'
      }
    },
    {
      // CSC error with whitespace prefix
      input:
        '  /Volumes/Code/ghe_actions-2.301.1/Some/Folder/SomeFile.cs(10,8): error CS1014: A get or set accessor expected [/Volumes/Code/ghe_actions-2.301.1/Some/Folder/SomeProject.csproj]',
      results: {
        file: '/Volumes/Code/ghe_actions-2.301.1/Some/Folder/SomeFile.cs',
        line: '10',
        column: '8',
        severity: 'error',
        code: 'CS1014',
        message: 'A get or set accessor expected',
        fromPath:
          '/Volumes/Code/ghe_actions-2.301.1/Some/Folder/SomeProject.csproj'
      }
    },
    {
      // CSC error with MSBuild prefix
      input:
        '    20>C:\\actions-runner\\_work\\Some\\Folder\\SomeFile.cs(8,2): error CS1014: A get or set accessor expected [C:\\actions-runner\\_work\\Some\\Folder\\SomeProject.csproj]',
      results: {
        file: 'C:\\actions-runner\\_work\\Some\\Folder\\SomeFile.cs',
        line: '8',
        column: '2',
        severity: 'error',
        code: 'CS1014',
        message: 'A get or set accessor expected',
        fromPath: 'C:\\actions-runner\\_work\\Some\\Folder\\SomeProject.csproj'
      }
    }
  ];

  test.each(testCases)(
    'regex matches and parses: $input',
    ({input, results}: {input: string; results: Record<string, string>}) => {
      const matchedResultsArray = input.match(regex);
      expect(matchedResultsArray).not.toBeNull();

      for (const propName in results) {
        const propertyIndex = regexResultsMap[propName];
        const expectedPropValue = results[propName];
        const matchedPropValue = matchedResultsArray![propertyIndex];
        expect(matchedPropValue).toEqual(expectedPropValue);
      }
    },
    10000
  );
});
