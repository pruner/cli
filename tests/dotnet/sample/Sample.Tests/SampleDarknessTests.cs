using Microsoft.VisualStudio.TestTools.UnitTesting;
using System.Threading;

namespace Sample.Tests.Darkness
{
    [TestClass]
    public class SampleDarknessTests
    {
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
                Thread.Sleep(0);
                SomeClass.DoSomething(argument);
            }
        }
    }
}
