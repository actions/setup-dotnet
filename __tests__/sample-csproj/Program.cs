using System;
using Newtonsoft.Json;

namespace sample_csproj
{
    class Program
    {
        static void Main(string[] args)
        {
            var json = JsonConvert.SerializeObject(new[] {"Hello", "World!" });
            Console.WriteLine(json);
        }
    }
}
