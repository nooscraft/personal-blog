+++
title = "The watermark a screenshot removes"
date = 2026-08-14
description = "Claude now marks its output with watermarks and C2PA metadata to meet the EU AI Act. The marking is real and useful, and Anthropic's own documentation explains how little it can prove."
draft = false
updated = 2026-08-14
[taxonomies]
tags = ["ai", "eu-ai-act", "regulation", "c2pa", "watermarking", "provenance", "anthropic"]
categories = ["Engineering"]
+++

> *Updated 2026-08-14: gave the opt-in question a fuller hearing.*

Anthropic has published a [support article](https://support.claude.com/en/articles/16266773-how-claude-marks-ai-generated-content) on how Claude marks AI-generated content. The rule behind it is Article 50 of the EU AI Act, and it started applying on 2 August 2026. Today is 14 August 2026, so the obligation is twelve days old. My reaction is split: the marking is a genuine step forward, and the job it is asked to do cannot be done with the tools available.

## What Claude actually marks

The article describes two techniques: a watermark embedded in the text itself, and signed provenance metadata attached to files. Here is how the article describes the text watermark:

> When a supported Claude model generates text, it weaves an imperceptible watermark directly into the text itself. You won't see it, and it doesn't change the meaning, quality, or readability of Claude's response.

The watermark is applied at the model level, so it appears whatever Claude product or surface produced the text. It is part of the text, so it travels with copy and paste, and Anthropic says it "may persist through some editing". That is not a number, and I will not invent one.

On the file side, provenance metadata attaches to three supported types: .svg, .png and .jpg. It follows the Coalition for Content Provenance and Authenticity (C2PA) open standard. If present, it signals Claude processed the file and lets you detect tampering afterwards.

Coverage spans Claude Platform (API), Claude, Claude Code, Claude Cowork, and Claude Tag. The watermarks also follow supported models into AWS, Google Cloud, and Microsoft Foundry; provenance metadata may not be supported on every platform. Models launched on or after 2 August 2026 have marking at launch; older models are still being worked on under a legal transition period.

One detail matters for later: marking applies wherever Claude is offered, worldwide, not only in the EU.

## What the law asks for

Article 50's transparency obligations apply from 2 August 2026. For generative systems, output must carry a machine-readable marking that identifies it as artificial. The paragraph then adds a qualifier, quoted here:

> [Providers] shall ensure that the outputs of the AI system are marked in a machine-readable format and detectable as artificially generated or manipulated. [...] Such solutions shall be effective, interoperable, robust and reliable as far as this is technically feasible.

In plain terms, the law only asks for this to work as far as the technology allows, with content type, cost, and the state of the art factored in. That qualifier tells you the drafters knew the technology was not there.

Standard assistive editing, input the AI does not substantially alter, and legally authorised criminal investigations are exempt. Article 50(4) on deep fakes carves out satire and fiction, along with text that remains under human editorial responsibility.

The AI Omnibus reached provisional agreement on 7 May 2026, Parliament voted to adopt it on 16 June 2026, and Council approval is still pending. It delays the machine-readable marking duty until 2 December 2026 for generative systems placed on the market before 2 August 2026.

Penalties sit in Article 99. Breaches of Article 50 cost up to 15 million euro or 3% of total worldwide annual turnover, whichever is higher. For SMEs and small mid-caps it is the lower of the two.

The Commission has published guidelines and a Code of Practice on Transparency of AI-generated Content. Anthropic signed it as a provider of both generative models and generative systems; adhering demonstrates compliance, and declining requires equivalently adequate alternatives. I have not read the full Code, only the Commission material and Anthropic's summary.

## The admissions in the documentation

A mark does not mean what most people will assume: Anthropic states that a detected mark is "not fully conclusive". Claude may not be the original author at all, since plenty of people hand it work that was already theirs. The article says it directly:

> Claude may not be the original author. People often use Claude to proofread, translate, summarize, or convert files. The output can carry a Claude mark even if the underlying ideas, text, or data originated from another source

Read that again. Someone who writes their own work and uses Claude to tidy it carries the same mark as a fully generated draft. The signal cannot tell those two apart.

Then there are the ways a mark goes missing, and the article lists them:

> Lack of a detected mark doesn't mean the content wasn't AI-generated or processed. Content generated by Claude may not carry a detectable mark if, for example:
>
> - The text has been heavily edited, paraphrased, translated, or mixed into other writing;
> - The passage is very short, leaving too little text for a reliable signal;
> - A file's metadata was stripped through format conversion, re-saving, screenshots, or other means;

So a screenshot defeats the image credential, and a paraphrase from another model defeats the text watermark. Neither takes any skill.

And none of it can be checked today: Anthropic says detection tooling is coming in forthcoming technical documentation, but none is published yet. Nobody outside Anthropic can verify how well it holds up, and that includes me: I have not tested it, because there is nothing public to test with.

## Who the rule actually lands on

Claude is a paid product and I pay for it. I live outside the EU. My output gets marked all the same. What this post has not said yet: the law's own reach is narrower than the rollout. The scope provision is Article 2, with two limbs:

> providers placing on the market or putting into service AI systems or placing on the market general-purpose AI models in the Union, irrespective of whether those providers are established or located within the Union or in a third country [...] providers and deployers of AI systems that have their place of establishment or are located in a third country, where the output produced by the AI system is used in the Union

The second limb covers output used in the Union, and mine never goes there; I am one of those users outside the EU. But the marking duty has no territorial qualifier of its own: Article 2 decides the whole question, and its first limb covers providers placing general-purpose AI models on the Union market wherever they are based. Anthropic is such a provider, so the duty could be read as attaching at the model, not per user. Which reading is right I cannot settle: I am not a lawyer, this is a reading, not a ruling. What survives both readings is the point: on the narrow one, marking my output is a product choice rather than a compelled one; on the broad one, the law sets a floor for output tied to the Union and says nothing about choice for people it was never written to protect. Either way, no rule in it forbids a setting for those users. I am not attacking Anthropic; it may well be the right call, but a decision can be questioned in a way an obligation cannot.

Why is this not a setting? I looked in the support article for an off switch, an opt-in, a difference between plans. Nothing. An absence in one document is not proof about the product. As described, marking is applied to you rather than chosen by you.

The standard objection: a mark you can decline is worth little, because anyone passing generated work off as their own would decline it first. I felt its force. But it assumes the mark must resist someone who does not want it there, and the support article already says it does not: a screenshot strips the file credential, a paraphrase strips the text watermark. The mark is already declinable by anyone who reads the documentation; a setting would change the price of declining, from one screenshot to one checkbox, and it would not change who ends up unmarked. Someone who takes the screenshot is unaffected either way; someone who never thinks about it is marked either way. The only group a setting reaches is the middle one: people who want a deliberate choice about their paid output and cannot make one. That group is small, I am in it, and that is worth admitting.

Three counters I cannot dismiss. Defaults move behaviour in aggregate even when trivially defeatable: taking a screenshot is not the same act as ticking a box, and I suspect, with no numbers published, fewer people would do the first. A per-region or per-account switch means locating the user, and being wrong in the wrong direction points at the penalty ceiling quoted earlier in this post; one worldwide code path has no such failure mode. That is speculation about a decision I was not in the room for. The signed credential on images is different: it lets you show a file has not been altered, something for the owner rather than just about them, so opting out is odd in a way declining an invisible text watermark is not.

The question stays open because the article does not answer it: no reason for worldwide marking, none for the missing setting. Not knowing the reason is not the same as there being none.

## Where the EU really does look slower

Now the case that fuels the "EU holds AI back" talk. It is a different law, and conflating the two is a mistake I want to avoid. On 8 June 2026 Apple published a newsroom post: Siri AI is delayed in the EU for iOS 27 and iPadOS 27. The regulation named is the Digital Markets Act, not the AI Act.

The delayed list is not small: Siri AI, a dedicated app to revisit conversations, the expanded Visual Intelligence experience, integrated writing tools, Siri mode in Camera on iOS, and Siri AI on watchOS 27. EU users keep Siri AI on macOS 27 and visionOS 27.

Under EU regulators' "extreme interpretation of the DMA", Apple says it would have to give any virtual assistant direct access to users' private data. It would also have to let them directly control other installed applications once Siri AI shipped in the EU. All of this, in Apple's words, "without the essential protections necessary to keep users and their data safe". Apple closes with "there is currently no timeline for Siri AI's availability in the EU on iOS and iPadOS."

This is the strongest evidence that EU rules cost European users access to things other people have.

## The case for it

The other side deserves a fair hearing. Anthropic could have geofenced all of this to Europe. It did not. The marking applies worldwide, so an EU rule raised the floor everywhere, including for people who never voted on it.

C2PA is an open standard used across the industry, not one vendor's proprietary tag, and an open standard is what lets anyone else build detectors.

Provenance on images has a clearer job than watermarking text: a signed credential that shows tampering answers a concrete question.

A norm that generated media carries provenance seems worth having even when the mechanism is weak, because the alternative was nothing at all.

## Where I land

The marking is worth doing and cannot carry what people will ask of it. I am glad it was not fenced off to Europe only. The switch still seems fair to ask for on output I pay to generate outside the rule's reach. Both can be true. I would rather read honest limits in a support article than a confident claim that would not survive contact with a screenshot.

When the detection documentation lands, I will feed the watermark some heavy editing and see what survives. Let's see how it goes.

---

### References

- [How Claude marks AI-generated content](https://support.claude.com/en/articles/16266773-how-claude-marks-ai-generated-content): Anthropic's support article, the source for every claim here about Claude's marking and its limits
- [AI Act Article 2](https://artificialintelligenceact.eu/article/2/): the territorial scope, quoted in the section on who the rule lands on
- [AI Act Article 50](https://artificialintelligenceact.eu/article/50/): the transparency obligations, including the marking requirement in 50(2) and the deep fake disclosure in 50(4)
- [AI Act Article 99](https://artificialintelligenceact.eu/article/99/): the penalty tiers
- [Commission guidelines on transparency of AI-generated content](https://digital-strategy.ec.europa.eu/en/policies/guidelines-transparency-ai-generated-content): the guidelines and the Code of Practice that Anthropic signed
- [Due to DMA, Siri AI delayed in EU for iOS 27 and iPadOS 27](https://www.apple.com/newsroom/2026/06/due-to-dma-siri-ai-delayed-in-eu-for-ios-27-and-ipados-27/): Apple's newsroom post, 8 June 2026
- [C2PA](https://c2pa.org): the Coalition for Content Provenance and Authenticity and its open standard
