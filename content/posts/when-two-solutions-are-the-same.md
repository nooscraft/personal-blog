+++
title = "When two solutions are the same, which one do you pick?"
date = 2026-06-05
description = "Two outputs solve a problem the same way, but one extracts repeated validation into a small helper. I look at whether my preference for the tidier one is real value or just taste."
draft = false
[taxonomies]
tags = ["ai", "code-review", "java", "refactoring", "reflection"]
categories = ["Engineering"]
+++

Here is a small thing that has been bugging me lately. Two model outputs solve the same problem, in the same way, with the same result. One of them does a little extra: it pulls some repeated validation out into a small private helper method. When I have to pick one, I almost always reach for the tidier one. The question I keep coming back to is whether that reach is backed by anything real, or whether it is just my taste talking.

So I wrote the two versions out and ran them, because it is easier to think about something concrete than something abstract.

## The two versions

Same tiny problem: create a user and update a user, both guarded by the same name and email checks. The first version repeats the checks in both methods.

```java
public class Inline {

    public static String createUser(String name, String email) {
        if (name == null || name.isBlank()) {
            return "rejected: name is required";
        }
        if (email == null || !email.contains("@")) {
            return "rejected: email looks invalid";
        }
        return "created user " + name;
    }

    public static String updateUser(String name, String email) {
        if (name == null || name.isBlank()) {
            return "rejected: name is required";
        }
        if (email == null || !email.contains("@")) {
            return "rejected: email looks invalid";
        }
        return "updated user " + name;
    }
}
```

The second version is the one most of us would call "nicer". It moves the checks into a private `validate` method and calls it from both places.

```java
public class Helper {

    private static String validate(String name, String email) {
        if (name == null || name.isBlank()) {
            return "name is required";
        }
        if (email == null || !email.contains("@")) {
            return "email looks invalid";
        }
        return null;
    }

    public static String createUser(String name, String email) {
        String error = validate(name, email);
        if (error != null) {
            return "rejected: " + error;
        }
        return "created user " + name;
    }

    public static String updateUser(String name, String email) {
        String error = validate(name, email);
        if (error != null) {
            return "rejected: " + error;
        }
        return "updated user " + name;
    }
}
```

I gave both the same `main`, compiled them with `javac 21.0.2`, and ran them side by side:

```bash
javac Inline.java Helper.java
java Inline > inline.out
java Helper > helper.out
diff inline.out helper.out
```

Both print exactly this:

```
created user Ada
rejected: name is required
rejected: email looks invalid
updated user Grace
```

The `diff` came back empty. From the caller's point of view, these two programs are the same program. Nothing observable changes. The only difference is that one has a `validate` method and the other does not.

## So why do I lean toward the helper?

If the behaviour is identical, my preference is about the shape of the code, not what it does. And the shape does carry some real value, at least in the cases I have actually run into:

- If a third caller shows up later, it reuses `validate` instead of copying the checks a third time.
- If the email rule changes (and "contains an @" is obviously not a real email rule), I edit one method instead of hunting for every copy.
- The two copies in the inline version can drift apart. One day someone fixes a check in `createUser` and forgets `updateUser`. Now they disagree, and nobody notices until something breaks.

That last one is the part I actually trust. Duplicated logic that is supposed to stay in sync, but has no mechanism forcing it to, is a slow leak. The helper closes that gap.

## But I want to be honest about the other side

For this exact example, the checks are four lines and used in two places. Pulling them out is close to the line where "good practice" turns into "abstraction I did not need yet". There is a real argument for leaving it inline:

- Two copies of four lines is not a crisis. You can see both at a glance.
- The helper returns `null` to mean "all good", which is its own small smell. Now the caller has to remember to null-check.
- If the two call sites later need slightly different rules, the shared helper becomes the thing you have to fight, and you end up adding flags to it.

So the tidy version is not free, and it is not obviously correct. Whether extraction is the right call depends on where the code is going, and at the moment I pick, I usually do not know where it is going. I am guessing. The guess happens to match what has worked for me before, but it is still a guess.

## Where the bias question actually lives

This is the part the whole thing is really about. When I pick the helper version, am I rewarding better engineering, or am I rewarding code that looks like code I would have written?

Those two can point the same direction often enough that it is hard to tell them apart. The danger is when they come apart and I do not notice. A few cases I can think of:

- The inline version is genuinely clearer for a throwaway script, but I mark it down because it "repeats itself".
- A model writes the helper but names it badly or puts the null-return smell in, and I still prefer it because the silhouette looks senior.
- I prefer whichever style matches the language I am most comfortable in, and quietly penalise idioms I just have not seen much.

None of those are about value. They are about familiarity wearing value's clothes. And when these preferences get collected up, for example when someone ranks two model outputs and that ranking becomes training signal, my taste stops being a private quirk and starts shaping what the next model thinks "good" looks like. That is the point where I would like to know whether I am measuring something or just voting for myself.

## Is it a problem, or is it judgment?

Here is the honest tension, and I do not have a clean answer. If my bias toward the extracted helper consistently lands on code that is easier to change later, then calling it "bias" feels unfair. That is just experience doing its job. Pattern recognition built from getting burned by drifting copies is exactly the thing you want a reviewer to have.

The catch is the word "consistently". I cannot actually prove my preferences are consistent without checking them against something outside my own taste: did the codebase get easier or harder to change, did the duplicated checks actually drift, did the abstraction get in the way later. When I have that kind of feedback, the preference earns the name "judgment". When I do not, I am just trusting that taste and value line up, and writing the result down as if it were measured.

So the rule I am trying to hold myself to, for now, is small: when two outputs do the same thing and I find myself preferring one, say out loud what the preference is buying. If I can name the value (one place to change the rule, no chance of drift), keep it. If the best I can do is "it feels more polished", treat that as a flag, not a verdict. I have not used this on anything large enough to call it a method. Let's see how it holds up.
