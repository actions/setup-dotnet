import cscFile from '../.github/csc.json';
describe('csc tests', () => {
  it('Valid regular expression', async () => {
    const regexPattern = cscFile['problemMatcher'][0]['pattern'][0]['regexp'];
    const regexResultsMap = cscFile['problemMatcher'][0]['pattern'][0];

    const regex = new RegExp(regexPattern);

    const stringsToMatch = [
      'Program.cs(10,79): error CS1002: ; expected [/Users/zacharyeisinger/Documents/repo/setup-dotnet/__tests__/sample-broken-csproj/sample.csproj]',
      "S:\\Msbuild\\src\\Build\\Evaluation\\ExpressionShredder.cs(33,7): error CS1003: Syntax error, ',' expected [S:\\msbuild\\src\\Build\\Microsoft.Build.csproj > Properties:prop]"
    ];
    // Expected results are calculated according to the csc matcher located in csc.json file
    const expectedResults = [
      {
        file: 'Program.cs',
        line: '10',
        severity: 'error',
        code: 'CS1002',
        message: '; expected',
        fromPath:
          '/Users/zacharyeisinger/Documents/repo/setup-dotnet/__tests__/sample-broken-csproj/sample.csproj'
      },
      {
        file: 'S:\\Msbuild\\src\\Build\\Evaluation\\ExpressionShredder.cs',
        line: '33',
        severity: 'error',
        code: 'CS1003',
        message: "Syntax error, ',' expected",
        fromPath:
          'S:\\msbuild\\src\\Build\\Microsoft.Build.csproj > Properties:prop'
      }
    ];

    stringsToMatch.forEach((string, index) => {
      const matchedResult = string.match(regex);
      for (const name in expectedResults[index]) {
        expect(matchedResult![regexResultsMap[name]]).toEqual(
          expectedResults[index][name]
        );
      }
    });
  }, 10000);
});
