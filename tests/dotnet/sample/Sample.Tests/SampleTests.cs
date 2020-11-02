using Microsoft.VisualStudio.TestTools.UnitTesting;
using System.Threading;

namespace Sample.Tests
{
    [TestClass]
    public class SampleTests
    {

        [TestMethod]
        public void Test_60s_HelloWorld()
        {
            RunScenario(60, 9001);
        }

        [TestMethod]
        public void Test_30s_HelloWorld()
        {
            RunScenario(30, 9001);
        }

        [TestMethod]
        public void Test_10s_HelloWorld()
        {
            RunScenario(10, 9001);
        }

        [TestMethod]
        public void Test_5s_HelloWorld()
        {
            RunScenario(5, 9001);
        }

        [TestMethod]
        public void Test_3s_HelloWorld()
        {
            RunScenario(3, 9001);
        }

        [TestMethod]
        public void Test_1s_HelloWorld()
        {
            RunScenario(1, 9001);
        }




        [TestMethod]
        public void Test_60s_HelloDarkness()
        {
            RunScenario(60, 123);
        }

        [TestMethod]
        public void Test_30s_HelloDarkness()
        {
            RunScenario(30, 123);
        }

        [TestMethod]
        public void Test_10s_HelloDarkness()
        {
            RunScenario(10, 123);
        }

        [TestMethod]
        public void Test_5s_HelloDarkness()
        {
            RunScenario(5, 123);
        }

        [TestMethod]
        public void Test_3s_HelloDarkness()
        {
            RunScenario(3, 123);
        }

        [TestMethod]
        public void Test_1s_HelloDarkness()
        {
            RunScenario(1, 123);
        }



        private static void RunScenario(int count, int argument)
        {
            for (var i = 0; i < count; i++)
            {
                Thread.Sleep(10);
                SomeClass.DoSomething(argument);
            }
        }
    }
}
