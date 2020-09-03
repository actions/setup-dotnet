using Microsoft.VisualStudio.TestTools.UnitTesting;
using System.Text.Json;
using System;

namespace sample_csproj
{
    [TestClass]
    public class Program
    {
        [TestMethod]
        public void TestMethod1()
        {
            var json = JsonSerializer.Serialize(new[] {"Hello", "World!" });
            Console.WriteLine(json);
        }
    }
}
