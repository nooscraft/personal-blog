+++
title = "Linux | Fancy little \"dialog\" utility"
date = 2013-12-23
description = "Create interactive terminal interfaces with Linux's dialog utility. Learn how to display CPU temperature with a simple bash script using dialog and lm-sensors."
[taxonomies]
categories = ["Linux"]
tags = ["linux", "dialog", "bash", "cli"]
+++

Using Linux's sophisticated "dialog" utility to display CPU core temperature

Installation

```sudo apt-get install dialog```

```sudo apt-get install lm-sensors```

Here the lm-sensors for detecting temperature (see here for configuration details: http://lm-sensors.org/wiki/iwizard/Detection)

Finally the script goes as

    #!/bin/bash

    temp1=$(sensors | grep "Core 0:" | cut -c1-24)
    temp2=$(sensors | grep "Core 1:" | cut -c1-24)

    dialog –title "System temp info" –msgbox "$temp1 $temp2″ 10 22

    dialog –clear
    exit 0

Using minimal advantage of lm-sensors, it's just displaying main core temperatures.

<img src="/public/images/screenshot-11232013-105234-pm1.png" alt="img" class="inline"/>
