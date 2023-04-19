using Microsoft.VisualStudio.TestTools.UnitTesting;
using System;

namespace test_csproj
{
    [TestClass]
    public class Test
    {
        [TestMethod]
        public void TestMethod()
        {   
            Console.WriteLine("TestMethod");
            int calculatedResult = 1000 / 25;
            int expectedResult = 40;
            Assert.AreEqual(calculatedResult, expectedResult);
        }
    }
}
