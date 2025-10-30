+++
title = "When Rust Expects a String But Gets a Map"
date = 2025-10-29
description = "A common Rust Serde error when deserializing DateTime from JSON that stores timestamps as objects instead of RFC 3339 strings."
[taxonomies]
categories = ["Programming"]
tags = ["rust", "serde", "datetime", "json", "error-handling"]
[extra]
cover_image_static = "images/covers/rust-serde-datetime-deserialization-error.png"
+++

I recently hit this error while working with a Rust application that reads from a database:

```
Database("Kind: invalid type: map, expected an RFC 3339 formatted date and time string, labels: {}")
```

At first glance, it's a bit cryptic. But the error message actually tells you exactly what's wrong.

## The Problem

When you have a Rust struct with a `DateTime<Utc>` field, Serde expects the JSON to contain an RFC 3339 formatted string like:

```json
"2025-09-15T01:36:19Z"
```

But instead, your database (or JSON source) is storing it as a map/object:

```json
{
  "sec": 1694733379,
  "nsec": 199610000
}
```

Serde can't automatically convert a map into a `DateTime`—it needs a string it can parse.

## Why This Happens

Different systems store timestamps differently:
- Some databases store timestamps as Unix time objects with separate seconds and nanoseconds
- Some JSON APIs return timestamps as nested objects
- Other sources might use different date formats

But Rust's `DateTime<Utc>` with Serde defaults expects the standard RFC 3339 string format.

## The Fix

You have two options:

**Option 1: Fix the data source** (if you control it)
Make sure your database or JSON source stores timestamps as RFC 3339 strings:

```json
"created_at": "2025-09-15T01:36:19Z"
```

**Option 2: Use a custom deserializer** (if you can't change the source)
Write a custom Serde deserializer to handle the map format:

```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Deserializer};

fn from_timestamp_map<'de, D>(deserializer: D) -> Result<DateTime<Utc>, D::Error>
where
    D: Deserializer<'de>,
{
    #[derive(Deserialize)]
    struct Timestamp {
        sec: i64,
        nsec: u32,
    }
    
    let ts = Timestamp::deserialize(deserializer)?;
    DateTime::from_timestamp(ts.sec, ts.nsec)
        .ok_or_else(|| serde::de::Error::custom("Invalid timestamp"))
}

#[derive(Deserialize)]
struct ModelSelection {
    #[serde(deserialize_with = "from_timestamp_map")]
    created_at: DateTime<Utc>,
}
```

The custom deserializer reads the `sec` and `nsec` fields from the map and constructs a `DateTime<Utc>` from them.

## Bottom Line

When Serde complains about expecting a string but getting a map for a `DateTime` field, your data source is storing timestamps in a format Serde doesn't recognize. Either standardize on RFC 3339 strings, or write a deserializer to handle your specific format.

