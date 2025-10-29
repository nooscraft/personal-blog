# Google Analytics Implementation Plan

## Overview
Add Google Analytics 4 (GA4) tracking to the blog for visitor analytics and insights.

## Prerequisites

### 1. Google Analytics Setup
- Create/access a [Google Analytics](https://analytics.google.com/) account
- Create a new GA4 property for `noos.blog`
- Get the Measurement ID (format: `G-XXXXXXXXXX`)
- Enable data collection for the property

## Implementation Steps

### Step 1: Add Configuration to `config.toml`
Add Google Analytics configuration under `[extra]`:

```toml
[extra]
# ... existing config ...

# Google Analytics
google_analytics_id = "G-XXXXXXXXXX"  # Your GA4 Measurement ID
```

**Considerations:**
- Make it optional (only loads if ID is provided)
- Allows easy enabling/disabling without code changes
- Different IDs for development vs production if needed

### Step 2: Add GA4 Script to Template

**Location:** `themes/radion/templates/_base.html`

**Placement:**
- Add in the `<head>` section, preferably before `</head>` closing tag
- After other metadata but before body content
- Use async loading to not block page rendering

**Implementation:**

```html
{% if config.extra.google_analytics_id %}
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id={{ config.extra.google_analytics_id }}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '{{ config.extra.google_analytics_id }}', {
    'anonymize_ip': true,
    'respect_dnt': true
  });
</script>
{% endif %}
```

**Why this placement:**
- In `<head>` ensures early tracking initialization
- `async` attribute prevents blocking page load
- Conditional check allows disabling GA easily

### Step 3: Privacy Considerations

**Recommended settings:**
1. **Anonymize IP addresses** - Already included above (`anonymize_ip: true`)
2. **Respect Do Not Track** - Included (`respect_dnt: true`)
3. **Optional**: Add cookie consent banner (if required by GDPR/privacy laws)
4. **Consider**: Making GA opt-in rather than automatic

**Privacy-Compliant Alternative:**
- Only load GA if user consents
- Use localStorage to remember consent choice
- Consider self-hosted analytics (Plausible, Umami) if privacy is critical

### Step 4: Testing & Verification

**Before Deployment:**
1. Test locally with GA4 Measurement ID
2. Verify script loads in HTML output
3. Check browser console for errors
4. Use GA4 DebugView to see real-time events

**After Deployment:**
1. Visit site and check GA4 Real-time reports
2. Verify page views are tracking
3. Test on multiple pages (homepage, post pages)
4. Check Network tab to confirm GA requests are sent

**Commands for testing:**
```bash
# Build and check if GA script is included
zola build --output-dir /tmp/test-ga
grep -i "googletagmanager\|gtag" /tmp/test-ga/index.html

# Verify Measurement ID is correct
grep -o "G-[A-Z0-9]*" /tmp/test-ga/index.html
```

### Step 5: Optional Enhancements

**Enhanced E-commerce Tracking** (if needed):
- Track post views as events
- Track categories/tags as custom dimensions
- Track reading time or scroll depth

**Custom Events** (for better insights):
```javascript
// Track when someone reads a full post
gtag('event', 'post_read', {
  'post_title': '{{ page.title }}',
  'reading_time': {{ page.reading_time }}
});
```

**Performance Monitoring:**
- Use GA4 to track Core Web Vitals
- Monitor page load times
- Track slow pages

## File Changes Summary

1. **`config.toml`**
   - Add `google_analytics_id` under `[extra]`

2. **`themes/radion/templates/_base.html`**
   - Add GA4 script block in `<head>` section
   - Add conditional check for config value

## Rollback Plan

If analytics need to be removed:
1. Remove `google_analytics_id` from `config.toml` OR set to empty string
2. The conditional check will prevent script from loading
3. No need to modify templates

## Best Practices

1. **Keep it optional** - Don't hardcode the Measurement ID
2. **Use async loading** - Don't block page rendering
3. **Respect privacy** - Enable IP anonymization and DNT
4. **Test thoroughly** - Verify tracking works before relying on data
5. **Document the ID** - Keep track of which GA property you're using

## Alternative: Self-Hosted Analytics

If privacy is a concern, consider:
- **Plausible Analytics** - Privacy-focused, GDPR compliant
- **Umami** - Open source, self-hosted
- **GoatCounter** - Simple, privacy-friendly

These can be added similarly with conditional config flags.

