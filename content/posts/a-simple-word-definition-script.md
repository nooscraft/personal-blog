+++
title = "A simple word definition script"
date = 2015-08-25
[taxonomies]
categories = ["Programming"]
tags = ["scripts", "bash", "cli", "productivity"]
+++

Have you ever come across a difficulty to find a definition of a word that you are looking for. Well I find it bit difficult for me.

I normally use Google search to find definitions of words. For example to get the definition of the word "replenish" I use [*definition replenish*](https://www.google.lk/webhp?sourceid=chrome-instant&ion=1&espv=2&ie=UTF-8#q=definition%20replenish) on search bar

But this approach is still bit clumsy though, since you need a browser and if you are already opened multiple tabs then it is sometimes get messy around to switch around tabs.

So I found out this simple script from the book [*Linux Shell Scripting Cookbook, 2nd Edition*](https://www.packtpub.com/application-development/linux-shell-scripting-cookbook-second-edition) that will query your word and get the definition of it.

Let's see how to get it to work (I have altered the original script from the book to make is more convenient)

- First you need an account in *dictionaryapi.com* - [http://www.dictionaryapi.com/register/index.htm](http://www.dictionaryapi.com/register/index.htm)
  - API key for the *learners* API would be enough for the time being
- Get the script from [here](https://gist.github.com/RockyRx/1fe12ee85074e361836a)
- Assign your API key to the variable **apikey**
- Make it executable ```chmod +x define```
- Optional: if you want to make it available system wide add the script to ```/usr/local/bin```
- Finally you can run it as ```./define replenish```

The outcome would be:-
<img src="/public/images/define_script.png" alt="img" class="inline"/>
