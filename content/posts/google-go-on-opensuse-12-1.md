+++
title = "Google Go on OpenSUSE 12.1"
date = 2012-01-29
[taxonomies]
categories = ["Programming"]
tags = ["golang", "go", "opensuse", "linux"]
+++

### Intro

As you may have already know the latest distribution release of [OpenSUSE 12.1](http://en.opensuse.org/Portal:12.1) ships with Google Go language. [Go language](http://golang.org/) was founded by Google as their very own programming language. It works like an interpreter language yet it has to be compiled in order to execute. This small introduction will show you how to set up the environment and run your first Go language program.


### Installing Go

Actually Go language is a part of the SUSE 12.1 distribution so you will not get it out of the box that is you have to install it first in order to use it. So lets begin installing Go

```sudo zypper install go```

Here I have issued the zypper command to install the Go (usual SUSE way of installing packages from repos). It will probably install two packages. Ok after the successful installation lets check if it's available

```whereis go```

outputs

```go: /usr/lib/go /usr/share/go```

Voila.! so we got installed Go

### Setting up the environment

As in the Go guided [tutorial](http://golang.org/doc/install.html#introduction) mentioned we need to set up three environment variables in order to successfully compile and execute a Go program. So lets open up the ```/.bashrc``` file where you usually place your environment variables (because ```/.bashrc``` file executes with every new session)

```sudo nano ~/.bashrc```

place three environment variables on the bottom of the file:-

```
export GOROOT=/usr/lib/go
export GOOS=linux
export GOARCH=386
```

[ctrl + x to save the file]

```export GOROOT``` – location of your Go source installation (/usr/lib/go) use whereis command to see that as used before.

```export GOOS``` – Your OS type which is Linux

```export GOARCH``` – Your OS architecture, in my case x86-32 (32-bit) so it goes as 386 [see here for more details]. Issue lscpu to check your sys-architecture.

Ok now everything is setup up. All you have to do now is open a new session, simply logout and re-login. or simply do a ```source ~/.bashrc```

### First program

As this is an introduction I will grab the same "Hello" program listed on [http://golang.org/doc/install.html#writing](http://golang.org/doc/install.html#writing)

```nano hello.go```

```go
package main

import "fmt"

func main() {
	fmt.Printf("hello, world\n")
}
```

[ctrl + x to save the file]

As I did mentioned earlier Go is a compile and run language like C or C++. So you'll have to to take the necessary steps before you make your Go code to be executed.

Compiling, linking and executing

```
8g hello.go
8l hello.8
./8.out
```

Will gives you

```hello, world```


> Note: here I have used 8g, 8l because my arc-type is 32-bit (386).
You will notice a different formation on the guide.

Now you have successfully completed your first Google Go language program. Pretty straight forward hah? To me it seems like that it follows a familiar executing process as in assembly language. So this is just a little heads up you can find more tutorials and code sample on [http://golang.org/doc/](http://golang.org/doc/)
