+++
title = "JDK 9 and JShell"
date = 2015-06-12
[taxonomies]
categories = ["Programming"]
tags = ["java", "jdk9", "jshell"]
+++

### Intro

I recently got to know about this official Java REPL (Read-Eval-Print-Loop) or JShell project. It is named as Kulla and you can visit [here](http://openjdk.java.net/projects/kulla/) to see the project's home. This is pretty much same like the Python's IDLE (If you have used it before) and a great way to exercise your code in real time. Also the good thing is that this project will be available as a part of JDK9 among with some other cool features.

Anyhow I managed to get it run on own and have tried few exercises too. Here, take a look

<script type="text/javascript" src="https://asciinema.org/a/eddp51uxxwidh8vlpy91ufyj2.js" id="asciicast-eddp51uxxwidh8vlpy91ufyj2" async></script>

### How do I get it to run

I haven't tried this on Windows, **only on POSIX based systems (Linux)**.  But I believe the precompiled jar will work on Windows. You can give it a go and see.

### Easy way

If you want to try out REPL right away there's this precompiled Jar that you can use . What you'll need is

- Link for the Jar:Kulla.jar
- Java 9 early access JDK

Once these are in place you just need to set the JAVA_HOME to your / path / to / JDK 9. Then execute the following -jar command:-

```$ java -jar kulla.jar```

You will be entered in to the JShell.

### Hard way

**NOTE: The whole build process can take up to 20-30 minutes or more, so brace yourself.**

- Make sure you have set the JAVA_HOME
- You also need Mercurial. If you are on Ubuntu just give ```sudo apt-get install mercurial```
- Then the follow these commands to get kulla-dev branch built
	- hg clone http://hg.openjdk.java.net/kulla/dev kulla-dev
	- cd kulla-dev
	- sh get_sources.sh
	- bash configure –with-boot-jdk=/path/to/jdk1.9
	- make clean images
	- make install  (optional)

OK, kulla-dev branch is now built, hopefully without any errors. Now lets see how we can build and run the REPL. I'm extracting these information from official README under Kulla dev branch.

Download JLINE2 from Maven, and set the environment variable JLINE2LIB to point to the downloaded jar file.

Building REPL:-

 ```cd langtools/repl ```

```bash ./scripts/compile.sh```

Running:-

```bash ./scripts/run.sh```

If everything goes fine you'll be entered to the JShell without any issues.

### Features

I will add a summary of features that you'll find useful when using the REPL.

- REPL has networking support. Yes you can work with java.net
- Semicolone is optional giving you a flexibility like most of REPL's out there
- It has some useful help commands that you can use to improve your productivity. /help list those commands
- Checked exceptions are not valid here. Like in normal Java environment you will not be forced to handle the checked exceptions. REPL will be handling it in the background
- Expressions will also work out of the box here. Arithmetic, String manipulations, method calls .etc

[Here](https://java.net/downloads/adoptopenjdk/REPL_Tutorial.pdf) I found a good tutorial that might be useful. It has some basic to intermediate exercises that you can follow go get familiar with the JShell/REPL
