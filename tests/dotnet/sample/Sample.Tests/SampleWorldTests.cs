using Microsoft.VisualStudio.TestTools.UnitTesting;
using System.Threading;

namespace Sample.Tests.World
{
  [TestClass]
  public class SampleWorldTests
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
