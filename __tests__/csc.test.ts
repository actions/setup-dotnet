import cscFile from '../.github/csc.json';
describe('csc tests', () => {
  it('Valid regular expression', async () => {
    const regex = cscFile['problemMatcher'][0]['pattern'][0]['regexp'];

    console.log(regex);
    const re = new RegExp(regex);

    // Ideally we would verify that this
    const stringsToMatch = [
      'Program.cs(10,79): error CS1002: ; expected [/Users/zacharyeisinger/Documents/repo/setup-dotnet/__tests__/sample-broken-csproj/sample.csproj]',
      "S:\\Msbuild\\src\\Build\\Evaluation\\ExpressionShredder.cs(33,7): error CS1003: Syntax error, ',' expected [S:\\msbuild\\src\\Build\\Microsoft.Build.csproj > Properties:prop]"
    ];

    stringsToMatch.forEach(string => {
      const matchStr = string.match(re);
      console.log(matchStr);
      expect(matchStr).toEqual(expect.anything());
    });
  }, 10000);
});
