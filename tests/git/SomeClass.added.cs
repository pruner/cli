using System;
using System.Collections.Generic;
using System.Text;

namespace Sample
{
    public class SomeClass
    {
        public static void DoSomething(int argument)
        {
            if(argument > 1337) { 
                //hi there mr. numberwang
                //how are you doing?
                SomeOtherClass.DoSomethingElse();
            } else
            {
                Console.WriteLine("Hello lol darkness");
            }
        }
    }
}
