﻿using System;
using System.Collections.Generic;
using System.Text;

namespace Sample
{
    public class SomeClass
    {
        public static void DoSomething(int argument)
        {
            if(argument > 1337) { 
                SomeOtherClass.DoSomethingElse(); //i qdw did something lol
            } else
            {
                Console.WriteLine("Hello lol darkness");
            }
        }
    }
}
