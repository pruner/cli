using System;
using System.Collections.Generic;
using System.Text;

namespace Sample
{
  public class SomeClass
  {
    public static int DoSomething(int argument)
    {
      if (argument > 1337) {
        Console.WriteLine("Hello world 1");
        Console.WriteLine("Hello world 2");
        Console.WriteLine("Hello world 3");

		if(false) {
			Console.WriteLine("Hello world 4");
			Console.WriteLine("Hello world 5");
			Console.WriteLine("Hello world 6");
		}
		
        Console.WriteLine("Hello world 7");
        Console.WriteLine("Hello world 8");
		return 1;
    } else
      {
        Console.WriteLine("Hello world secondary 1");
        Console.WriteLine("Hello world secondary 2");
        Console.WriteLine("Hello world secondary 3");
        Console.WriteLine("Hello world secondary 4");
        Console.WriteLine("Hello world secondary 5");
        Console.WriteLine("Hello world secondary 6");
        Console.WriteLine("Hello world secondary 7");
        Console.WriteLine("Hello world secondary 8");
		return 2;
      }
    }
  }
}
