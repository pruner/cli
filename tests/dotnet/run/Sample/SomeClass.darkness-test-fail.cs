﻿using System;
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
        Console.WriteLine("Hello world 4");
        Console.WriteLine("Hello world 5");
        Console.WriteLine("Hello world 6");
        Console.WriteLine("Hello world 7");
        Console.WriteLine("Hello world 8");
		return 1;
    } else
      {
        Console.WriteLine("Hello darkness 1");
        Console.WriteLine("Hello darkness 2");
        Console.WriteLine("Hello darkness 3");
        Console.WriteLine("Hello darkness 4");
        Console.WriteLine("Hello darkness 5");
        Console.WriteLine("Hello darkness 6");
        Console.WriteLine("Hello darkness 7");
        Console.WriteLine("Hello darkness 8");
		return 3;
      }
    }
  }
}
