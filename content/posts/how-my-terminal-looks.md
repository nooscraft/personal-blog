+++
title = "How my terminal looks"
description = "My terminal setup: zsh + oh-my-zsh, tmux, a clean theme, and plugins for a faster, more productive workflow."
date = 2025-10-13
[taxonomies]
categories = ["Tools"]
tags = ["terminal", "zsh", "oh-my-zsh", "tmux", "productivity", "linux"]
+++

### Background

I think everyone of you geeks would like if your terminal looks cool and productive. And yes, I'm talking here about terminals in POSIX-compliant OS's, more specifically terminal in a Linux environment.

Anyhow I will share you the details of my customized terminal configurations so you could get an idea of what it is really capable of doing and perhaps you would start applying the changes to your own terminal.

So to make it all happen I had to give up on ```bash``` and start using ```zsh```. Because ``zsh`` provides some extensive support to terminal users and it is certainly feature rich, customizable  and cooler than ```bash```. So all the customizations I made are based on ```zsh``` and [oh-my-zsh](https://github.com/robbyrussell/oh-my-zsh) (a really cool community driven project for managing ```zsh``` configurations)

### Looks

If looking at theming ```oh-my-zsh``` provides some cool and nice looking themes out of the box. But the theme that I'm using is an external theme and needs little bit more configurations before using it.

It's call [bullet-train](https://github.com/caiogondim/bullet-train-oh-my-zsh-theme) and to make it look right I had to install some fonts from [Vim-Powerline](https://github.com/powerline/fonts). I also had to change the color scheme of my terminal to use **Solarized (dark)**. Here I'm using xfce4-terminal that comes with Xubuntu, so I can easily change the color scheme from the preferences menu. I also make it a bit transparent to make it even more cooler.  

### Productivity

Enough of the looks. Lets see how is it when it comes the productivity. Here again ```oh-my-zsh``` provides some nice [plugins](https://github.com/robbyrussell/oh-my-zsh/tree/master/plugins) that you can use to increase your productivity. I'll list down the plugins that I'm using

#### Plugins

- [git](https://github.com/robbyrussell/oh-my-zsh/wiki/Plugin:git) - A very comprehensive plugin for ```git``` with lots of aliases for easy usage
- [history-substring-search](https://github.com/robbyrussell/oh-my-zsh/tree/master/plugins/history-substring-search) - Very useful plugin that will get you through your ```zsh``` history backwards-forwards via up and down arrow keys
- [zsh-syntax-highlighting](https://github.com/zsh-users/zsh-syntax-highlighting) - this will highlight the commands we use inside the terminal
- [command-not-found](https://github.com/robbyrussell/oh-my-zsh/tree/master/plugins/command-not-found) - will suggest alternative/correct commands instead of just command not found error
- [colorize](https://github.com/robbyrussell/oh-my-zsh/tree/master/plugins/colorize) - this will colorize the syntaxes for almost every popular sciprting/programing language
- [colored-man-pages](https://github.com/robbyrussell/oh-my-zsh/tree/master/plugins/colored-man-pages) - syntax highlight in man pages for easy reading
- [python](https://github.com/robbyrussell/oh-my-zsh/tree/master/plugins/python) - provides lots of useful aliases to Python
- [sudo](https://github.com/robbyrussell/oh-my-zsh/tree/master/plugins/sudo) - hit ESC twice and boom! ```sudo``` will added to your command
- [web-search](https://github.com/robbyrussell/oh-my-zsh/tree/master/plugins/web-search) - simply opens up your browser with the search query of yours in desired search engine i.e ```google whats the weather like today```
- [chucknorris](https://github.com/robbyrussell/oh-my-zsh/tree/master/plugins/chucknorris) - this plugin isn't particularly meant for productivity but it can get really humorous.
- [ubuntu](https://github.com/robbyrussell/oh-my-zsh/tree/master/plugins/ubuntu) - this particular plugin provides lot of Ubuntu specific aliases to ease up the day-to-day work

Once put these all together this is how it looks

<img src="/public/images/how_my_t_looks_01.gif" alt="img" class="inline"/>
<img src="/public/images/how_my_t_looks_02.gif" alt="img" class="inline"/>
