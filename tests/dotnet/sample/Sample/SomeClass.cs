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
                SomeOtherClass.DoSomethingElse();
            } else
            {
                Console.WriteLine("Hello darkness");
            }
        }
    }
}
