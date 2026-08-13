+++
title = "Features are not quality"
date = 2026-08-13
description = "A developer with 20 years of experience quit AI coding tools entirely. What stuck with me was not the decision but one line about what actually makes software good."
draft = false
[taxonomies]
tags = ["ai", "craftsmanship", "software-quality", "feature-bloat", "simplicity", "developer-tools"]
categories = ["Engineering"]
+++

I recently read [I'm done using AI](https://brettcodes.com/im-done-using-ai/) by Brett Chalupa, published 10 August 2026, where he announces he has stopped using AI tools, for coding and everything else. I use these tools myself, so I expected to skim it and move on. What stayed with me was not the decision to quit. It was one line about what makes software good.

## Twenty years, then eighteen months

Chalupa has been programming for 20 years, starting as a teenager making fansites and little video games before it became a career. Over the past 18 months, he writes, his working life and his craft were drastically changed by LLM-powered coding harnesses and what is often called agentic programming.

He first met the idea through GitHub Copilot in Visual Studio Code and found it "distracting and basically useless". A colleague using an early chat interface watched the model invent a version of a software library that did not exist, so it could not be installed or used. No version number was ever named, and I will not invent one.

In early 2025, management asked what he thought of AI coding. His answer: it is "often wrong, gets in my way, and doesn't help me code faster, so I don't use it." Management went to a conference, came back sold on LLMs revolutionising knowledge work, and issued a mandate: use AI tools or be left behind.

So he tried in earnest. Cursor "didn't click" and, in his words, "ran horribly on Linux". He moved to Zed, using sidebar chat with auto-edit, and says it "honestly felt magical" at that time. By mid-2026 he could connect Linear to Claude Code and have it build a non-trivial project start to finish without editing a line of code. The work got done faster than he could have done alone, and he "barely had to think".

## Where the trust actually broke

The moment that broke it for him had nothing to do with code. He got sick one night and described his symptoms to the chat. I will let him tell it.

> I'm embarrassed to admit this, but one night when I was sick, I described all my symptoms and it told me to go to the Emergency Department at the hospital.

The chat told him to go to the Emergency Department. He drove at midnight with the flu, waited two hours in the waiting room while his ibuprofen kicked in, and was told to go home and rest; he did not need to be there. It cost him hundreds of dollars.

This was not a coding failure at all. It was a confident answer in a place where confidence is not the same as knowing. It landed because he had been treating the chat like a friend for months: book recommendations, career advice, business ideas, always supportive. Of course he trusted it; I probably would have too.

## From building to reviewing

His role at work had quietly changed. He describes becoming "just a code reviewer and a quality assurance tester" for what the harness produced, "basically just a hamster on a wheel, checking boxes, getting tickets done with no real purpose". On review he is blunt: "it's impossible to review the quantity of code the AI writes, and we've got a different AI to review it anyway!"

He sums up where that left him like this.

> So what did this do? Well, it made me lazy. It made me stop caring. It made me a worse programmer. It made me depressed. Because I stopped doing the hard work, I stopped learning, I stopped growing, I stopped being the one making the software.

He felt distant from the software. He could not explain precisely how something worked without asking the AI first. Underneath sits the question the post is really about: if the job is feeding Linear tickets into a CLI, why is he needed at all? He wondered about becoming an electrician.

## What the one good study says

The best evidence I know of here is METR's [randomized controlled trial](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/), published 10 July 2025. The setup: 16 experienced open-source developers, 246 real tasks in mature repositories they already knew well, run between February and June 2025, using primarily Cursor Pro with Claude 3.5 or 3.7 Sonnet. The finding: developers took 19% longer to complete issues when allowed to use AI tools. Afterwards, those same developers estimated AI had made them 20% faster. They were wrong in the opposite direction.

The gap between what they felt and what was measured is the part I cannot leave alone. The tools feel fast. I have never once timed myself.

Now the other side, because this cuts both ways. METR's own caveats: these developers and repositories do not represent most software development work, AI may speed up other groups, and the result may not hold for later models. In a [follow-up posted on 24 February 2026](https://metr.org/blog/2026-02-24-uplift-update/), they say they now believe developers are likely more sped up by AI in early 2026 than in early 2025, though they call the new data "very weak evidence". They are redesigning the experiment because selection bias got severe: developers now decline to participate rather than work without AI, and 30% to 50% told them they were not submitting tasks they did not want to do without AI.

I will not use it as a hammer. 16 developers on projects they knew deeply is a real limitation, not a footnote.

## My two cents: features are not quality

The sentence that started all this for me is his line about cared-for software.

> Upon reflection, I've come to believe that quality software is not about how many features something has or how quickly it is built but rather how cared for it is by the designers, developers, and product people who work on it.

Quitting AI did not push him out of software. He went back to game programming. He finished his book on coding games for the Playdate, made some small games, and built Usagi, a 2D Lua game engine written in Rust. When he tried cutting AI back to trivial tasks only, it never held; he slid back into using it for everything, and he calls it an all or nothing decision. He is plain about the risk: "It is possible I will be terminated." His closing line is "Here's to writing code by hand."

His line says something I had felt without saying out loud: a feature list is not a product. The software I actually like does a small number of things and gets out of the way. My editor, my terminal and the generator behind this blog have barely changed shape in years, and I am grateful for it. This is an observation from using software, not a measured result. When a tool I rely on ships another panel or assistant I did not ask for, I do not feel served; I feel managed.

## We build for ourselves and call it a product

My suspicion, after years of using and building software: a lot of features get shipped to satisfy the people building them, not the people using them. It feels like progress. The roadmap looks full, the changelog looks healthy, everyone feels productive. Then the thing that arrives at the user is heavier, slower and harder to understand than what it replaced.

Complexity gets added by people who will never have to live inside it. The person who built the new panel knows exactly where everything is; the user opens the app one morning and their tool has moved. None of this is malicious. Adding is easier than subtracting, and adding is what gets rewarded. I have shipped my share of it. This is not a law, but the pattern keeps showing up in my own work, and I do not love what that says about me.

## Simple keeps winning

Given a real choice, people reach for the simpler thing. Not always, but often enough that I trust the pattern.

The honest other half: the long, patient engagement software used to earn seems mostly gone. The main thing that still holds attention for hours is the stuff engineered for scrolling, and that is not a model anyone building a tool should want to copy. I wrote about my own version of this in [when nothing feels fun any more](@/posts/losing-interest-in-everything.md), after noticing I was bouncing off things that used to absorb me for days.

## Where I land

I am not quitting. I use these tools most days and I plan to keep using them; they earn their place for boilerplate and getting unstuck. What is hyped and not yet proven, at least for work like mine, is the ten-times-faster story. I have not tried quitting the way Brett did, so I do not know what that would do to my work.

His question is the right one to sit with: what is the cost, and who pays it. He cites Cal Newport's Slow Productivity and its encouragement to work at a natural pace; he says he does not see the need to work faster. He also writes about the true cost of AI, "from the data centers to the water usage and beyond", and says it is "largely hidden". I have not verified any of those figures myself, so I will not quote numbers. It deserves more attention than it gets, though. I will keep using the tools, and keep asking what they cost. Let's see how it goes.
