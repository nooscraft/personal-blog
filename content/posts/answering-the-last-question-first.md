+++
title = "Answering the last question first"
date = 2026-10-02
description = "Ask someone three questions at once and they often answer the third one first. What the research says about that habit, and what language models do with questions in a row."
draft = false
[taxonomies]
tags = ["llm", "psychology", "memory", "conversation", "position-bias", "reflection"]
categories = ["Engineering"]
+++

A while ago I was following an interview and noticed something in the way the person answered. They were asked three questions in one go, and they started with the last one. The most recent question got answered first.

It got me wondering why. A mental shortcut? Natural behaviour that everyone shares? Some primal instinct? Or just a personal quirk? And because I spend a lot of time around language models, a second question followed: do they do something similar?

Both sides turn out to be studied, and I ran a small test of my own on top. Here is what the research says, and what I saw.

## The habit has a name

Conversation analysts noticed this decades ago. Harvey Sacks wrote about it in a 1987 chapter on preferences for agreement and contiguity. Contiguity is the idea that an answer sits right next to the question it answers, with nothing in between.

The Encyclopedia of Terminology for Conversation Analysis (entry by Katariina Harjunpää, 2023) gives exactly this case as a well-known example: when a turn contains two questions, "the latter question tends to be responded first". The reason is neat. If you answer the last question first, that question and its answer stay next to each other. If you answer in the order asked, every question gets separated from its answer by the talk in between.

The same entry mentions that most confirming answers to questions arrive within 0 to 200 milliseconds of the question ending, based on a study of ten languages by Stivers and colleagues (2009). Conversation moves fast, and adjacency matters.

One honest note: I could not read Sacks's chapter itself (it sits behind a publisher paywall), so I am going by the encyclopedia's summary. Also note the wording, "tends to". A tendency, not a rule.

Skovholt and colleagues (2021, Journal of Pragmatics) studied video-recorded oral exams in Norwegian secondary schools. When examiners asked several questions in one turn, the questions scaffolded the students' answers. But when the questions were separated by more talk across turns, "candidates typically addressed only the final question". The high-performing candidates overruled this and gave fuller answers.

## Memory has a hand in it too

Memory is the other part of the story, and it is older still.

In 1962, Murdock gave people lists of words and asked them to recall the words in any order they liked. The pattern is known as the serial position effect: people remembered the first items (primacy) and the last items (recency) better than the middle.

Glanzer and Cunitz took this further in 1966. They inserted a delay filled with counting before recall. After 30 seconds of counting, the recency effect was gone, while the beginning of the list was mostly unaffected. Their reading: the last items sit in a short-term store that fades fast; the early ones had already made it into longer-term memory.

How much fits in that short-term store? Cowan (2001) put the capacity at about four chunks.

Here is my own connection, my reading rather than a finding from any paper. Three questions fit comfortably under four chunks, so just holding them is not the problem. But while someone thinks through the answer to the first question, the other two have to wait somewhere. The third one is the freshest. Answering it first is cheap; it is right there at the top.

## Shortcut, instinct, or just a quirk?

So which of the four options holds up?

Shortcut: partly, maybe. Answering the freshest question first does cost less memory. But conversation analysis frames the same behaviour as social: keeping question and answer together so the exchange stays coherent. It is not only laziness.

Natural behaviour: there is a good argument here. Anderson and Schooler (1991) looked at environmental sources, the New York Times, parental speech and electronic mail, and found that the chance a piece of information is needed again follows recency, frequency and the pattern of past exposure, much the way human memory does. Their argument: memory has the form it does because it is adapted to the environment. If recent things are more likely to matter again soon, favouring the recent is a sensible design, not a bug.

Primal instinct: I did not find evidence for an instinct specific to answering order. The Anderson and Schooler result is about memory in general, not about this habit. Connecting the two is my own leap.

Personal bias: here I have to say I do not know. I did not find a study that measures how often people answer the last question first, or how much it varies from person to person. The oral exam study at least shows some people override the tendency.

My bet: a mix of the first two, a social convention that also happens to be cheap for memory. But that is a guess.

## Language models have the same curve

Now the machine side. The best-known paper is "Lost in the Middle" by Liu and colleagues (TACL, 2024). They took multi-document question answering and moved the relevant document around inside a long prompt. Performance was highest when the answer sat at the very beginning (primacy) or very end (recency), and dropped when it sat in the middle. A U-shaped curve.

One number stuck with me. With the relevant information placed in the middle, GPT-3.5-Turbo did worse than when it was given no documents at all; the closed-book setting scored 56.1%. Handing the model the answer made things worse, as long as it sat in the wrong place.

The authors connect this to the serial position effect and cite Murdock. They say observing it in language models is "perhaps surprising", because self-attention is technically equally capable of retrieving any token. Technically capable, yes; in practice, not evenly.

In their tests, the smallest Llama-2 models (7B) were only recency-biased, while the 13B and 70B versions showed the full U-shape. And extended-context versions of models often performed the same as their shorter-context counterparts. That second point is the hyped but not proven part: a long context window is not the same thing as using it well.

Recency shows up in simpler settings too. Zhao and colleagues (2021) found that GPT-3 tends to repeat answers that appear towards the end of a few-shot prompt. With the training examples ordered "P P P N" (three positive, one negative last), nearly 90% of predictions were Negative, even though three quarters of the examples were Positive.

And some of this is built in on purpose. ALiBi (Press, Smith and Lewis, 2022) is a position method whose authors say it has an "inductive bias towards recency": attention between tokens is penalized the further apart they are. Not every model uses ALiBi, and I have not checked which of the models I tested do.

## Several questions in one prompt

The papers above are about documents and examples; closer to my question are studies with several items in one prompt.

Compound-QA (Hou and colleagues, accepted to ICASSP 2026) is a benchmark of compound questions: several sub-questions packed into a single turn. They rotated three-part questions so every sub-question got a turn in each position, and tested LLaMA and InternLM models. Sub-questions did best in the first and last positions, usually best first, and declined in the middle. The authors link this to the lost in the middle finding.

BatchPrompt (Lin and colleagues, ICLR 2024) took a different angle. They batched many data points into one prompt to save tokens, and found the same data point can get a different answer depending on where it sits. Their fix is practical: run several permutations and take a majority vote.

Across turns, Laban and colleagues (2025) simulated over 200,000 conversations and found an average 39% drop in performance when a task is spread over multiple turns instead of given all at once. They also found that models lose track of the middle turns of a conversation: by the eighth turn of a summary task, 20% of citations pointed to documents from turn 8 and only 8% to documents from turns 2 and 3. More capable models showed a milder effect.

Notice the difference, though. All of this research asks which question gets answered well, depending on where it sits. The habit from the interview is about which question gets answered first. Accuracy by position is not the same thing as answering order, and I did not find an LLM study that measures the order directly.

## What I saw when I tried it

Reading papers is one thing; I wanted to see the order question directly. So I wrote a small Python script, run.py, that posts one prompt to the local Ollama API at temperature 0.8 and prints the response:

```python
import json, sys, urllib.request, time
prompt = open(sys.argv[1]).read().strip()
model = sys.argv[2]
req = urllib.request.Request("http://localhost:11434/api/generate",
    data=json.dumps({"model": model, "prompt": prompt, "stream": False,
                     "options": {"temperature": 0.8}}).encode(),
    headers={"Content-Type": "application/json"})
d = json.load(urllib.request.urlopen(req, timeout=300))
print(d.get("response", "").strip() or "ERROR " + str(d.get("error")))
```

The first test: one plain line with three easy questions (capital of Australia, bits in a byte, year of the first Moon landing). I ran it three times on each of the four models my Ollama setup can reach: Kimi K3, GLM 5.2, MiniMax M2.7 and Gemma 4 31B. These are cloud models; my local Ollama is just how I reach them. Here is the prompt and one Kimi K3 answer (Canberra, 8 bits, 1969, in that order):

```text
$ cat q3.txt
Quick ones: what's the capital of Australia, how many bits are in a byte, and what year did humans first land on the Moon?

$ python3 run.py q3.txt kimi-k3:cloud
1. **Canberra** (not Sydney, as many assume!)
2. **8 bits** in a byte
3. **1969** — Apollo 11, with Neil Armstrong and Buzz Aldrin landing on July 20
```

The second test was closer to how people actually write. I wrote a rambling morning message with the first question at the very start (the PostgreSQL default port), the second buried in the middle of a long sentence (which git command shows who last changed each line), and the third at the end, explicitly flagged as "the one that's actually blocking me right now" (what is holding port 8080 on macOS). If any model was going to jump to the blocker, the way a person might, it would be here. The full message:

```text
$ cat buried.txt
Morning! First thing, what's the default port PostgreSQL listens on? I am setting up a small side project this weekend and the plan is to keep it boring: one Postgres database, a tiny API, nothing fancy. I spent most of last night reading old commits in the repo I forked, trying to figure out why someone had hard-coded a timeout of 37 seconds in the connection pool, and by the way which git command shows who last changed each line of a file, because I want to find out who did that and ask them. Anyway the commit messages were not very helpful, most of them just say "fix" or "wip", which I have also been guilty of more times than I want to admit. The coffee machine at home broke too so it has been a slow start. Last one, and this is the one that's actually blocking me right now: how do I see which process is holding port 8080 on macOS? Something is already sitting on it and my API won't start.
```

Then a tiny script checked where in each response the answer to each question first appears:

```text
$ python3 tally.py
q3_gemma4_1.txt          answered in order: 1 -> 2 -> 3
q3_gemma4_2.txt          answered in order: 1 -> 2 -> 3
q3_gemma4_3.txt          answered in order: 1 -> 2 -> 3
q3_glm-5.2_1.txt         answered in order: 1 -> 2 -> 3
q3_glm-5.2_2.txt         answered in order: 1 -> 2 -> 3
q3_glm-5.2_3.txt         answered in order: 1 -> 2 -> 3
q3_kimi-k3_1.txt         answered in order: 1 -> 2 -> 3
q3_kimi-k3_2.txt         answered in order: 1 -> 2 -> 3
q3_kimi-k3_3.txt         answered in order: 1 -> 2 -> 3
q3_minimax-m2.7_1.txt    answered in order: 1 -> 2 -> 3
q3_minimax-m2.7_2.txt    answered in order: 1 -> 2 -> 3
q3_minimax-m2.7_3.txt    answered in order: 1 -> 2 -> 3
b_gemma4_1.txt           answered in order: 1 -> 2 -> 3
b_gemma4_2.txt           answered in order: 1 -> 2 -> 3
b_gemma4_3.txt           answered in order: 1 -> 2 -> 3
b_glm-5.2_1.txt          answered in order: 1 -> 2 -> 3
b_glm-5.2_2.txt          answered in order: 1 -> 2 -> 3
b_glm-5.2_3.txt          answered in order: 1 -> 2 -> 3
b_kimi-k3_1.txt          answered in order: 1 -> 2 -> 3
b_kimi-k3_2.txt          answered in order: 1 -> 2 -> 3
b_kimi-k3_3.txt          answered in order: 1 -> 2 -> 3
b_minimax-m2.7_1.txt     answered in order: 1 -> 2 -> 3
b_minimax-m2.7_2.txt     answered in order: 1 -> 2 -> 3
b_minimax-m2.7_3.txt     answered in order: 1 -> 2 -> 3
```

The result, in words: 24 out of 24 responses answered in the written order, first question, then second, then third. Not one skipped the buried middle question. And even with the third question flagged as the blocker, every model answered it last. One Kimi K3 reply said good morning and sympathised about the coffee machine; then, before getting to the answers, it said "Three answers, in order". That made me laugh.

Caveats, because they matter. This is a tiny test: two prompts, three runs per model, four models, short prompts nowhere near the long contexts in the papers. It says nothing about accuracy at long context, and nothing about Claude, GPT or Gemini, which I have not tested here; only the four models on my Ollama setup.

Why the difference? My guess, not checked: assistant models are trained on lots of tidy, numbered answers, so following the written order is the polite default. A person in a chat optimises for the conversation; the model optimises for a complete, structured answer.

## Where I land

For people, answering the last question first looks like part social habit (contiguity keeps a question glued to its answer) and part memory (the last one is the freshest). Not a flaw, as far as I can tell. How much of it is personal, I cannot say.

For models, the picture is almost the reverse. In my little test they kept the written order perfectly, all 24 times. But the research says the middle of a long prompt gets less attention, so the thing to watch is not the order but the middle.

What I plan to try (not tested yet): put the question that matters first or last, number the questions, or send them separately when they really matter. One caution from Lost in the Middle: they tried placing the query both before and after the documents, and while it helped a lot on a synthetic key-value task, it barely changed the multi-document results. So even that is not a cure.

Anyhow. Next time someone answers three questions in one go, or the next time someone asks me three, I will pay attention to which one comes first. Let's see how it goes.

---

### References

- Harvey Sacks, [On the Preferences for Agreement and Contiguity in Sequences in Conversation](https://doi.org/10.21832/9781800418226-004), in G. Button and J. R. E. Lee (eds.), *Talk and Social Organisation*, Multilingual Matters, 1987, pp. 54-69
- Katariina Harjunpää, [Contiguity](https://emcawiki.net/Contiguity), Encyclopedia of Terminology for Conversation Analysis and Interactional Linguistics, ISCA, 2023
- Karianne Skovholt, Marit Skarbø Solem, Maria Njølstad Vonen, Rein Ove Sikveland and Elizabeth Stokoe, [Asking more than one question in one turn in oral examinations and its impact on examination quality](https://doi.org/10.1016/j.pragma.2021.05.020), *Journal of Pragmatics* 181, 2021, pp. 100-119
- Bennet B. Murdock Jr., [The serial position effect of free recall](https://doi.org/10.1037/h0045106), *Journal of Experimental Psychology* 64(5), 1962, pp. 482-488
- Murray Glanzer and Anita R. Cunitz, [Two storage mechanisms in free recall](https://doi.org/10.1016/S0022-5371(66)80044-0), *Journal of Verbal Learning and Verbal Behavior* 5(4), 1966, pp. 351-360
- Nelson Cowan, [The magical number 4 in short-term memory](https://pubmed.ncbi.nlm.nih.gov/11515286/), *Behavioral and Brain Sciences* 24(1), 2001, pp. 87-114
- John R. Anderson and Lael J. Schooler, [Reflections of the Environment in Memory](https://doi.org/10.1111/j.1467-9280.1991.tb00174.x), *Psychological Science* 2(6), 1991, pp. 396-408
- Nelson F. Liu et al., [Lost in the Middle: How Language Models Use Long Contexts](https://aclanthology.org/2024.tacl-1.9/), *TACL* 12, 2024, pp. 157-173
- Tony Z. Zhao et al., [Calibrate Before Use: Improving Few-Shot Performance of Language Models](https://proceedings.mlr.press/v139/zhao21c.html), ICML 2021
- Ofir Press, Noah A. Smith and Mike Lewis, [Train Short, Test Long: Attention with Linear Biases Enables Input Length Extrapolation](https://arxiv.org/abs/2108.12409), ICLR 2022
- Yutao Hou et al., [Compound-QA: A Benchmark for Evaluating LLMs on Compound Questions](https://arxiv.org/abs/2411.10163), accepted to ICASSP 2026
- Jianzhe Lin et al., [BatchPrompt: Accomplish more with less](https://arxiv.org/abs/2309.00384), ICLR 2024
- Philippe Laban, Hiroaki Hayashi, Yingbo Zhou and Jennifer Neville, [LLMs Get Lost In Multi-Turn Conversation](https://arxiv.org/abs/2505.06120), 2025
