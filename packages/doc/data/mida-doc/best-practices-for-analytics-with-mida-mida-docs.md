---
title: "Best Practices for Analytics with MIDA | MIDA Docs"
url: ""
crawledAt: "2026-06-22T03:19:05.842Z"
---
[Skip to content](https://docs.mida-app.io/recordings/analytics/best-practices-for-analytics-with-mida/#_top)

# Best Practices for Analytics with MIDA

## 1\. Session Replays

[Section titled “1. Session Replays”](https://docs.mida-app.io/recordings/analytics/best-practices-for-analytics-with-mida/#1-session-replays)

**What it is**

Watch the full journey of any session exactly as the visitor experienced it.

**Why it matters**

Pinpoint where users get stuck, hesitate, or what captures attention-so you can answer, “Why did they leave without buying?”

**How to use effectively**

- **Prioritize by Relevance Score.** MIDA calculates this from _Active Duration, Pageviews, Purchases, Checkouts Started,_ and _Rage Clicks_. Focus on high-score sessions first.
- **Use Filters.** Narrow to sessions by country, device, or behaviors (e.g., added to cart but did not checkout).

**Suggested filter recipes by use case**

**1) Homepage Check**

- _Goal:_ See who landed on the homepage and from where → **Landing Page contains “/”** \+ combine with **Source URL / Source Type**
- _Goal:_ Check bounce → **Duration = 0–5 mins + Page Count = 1**
- _Goal:_ Understand homepage behavior on mobile → **Device = Mobile**

**2) Product Page Behavior (PDP) Analysis**

- _Goal:_ Find sessions that viewed products → **Event = View product**
- _Goal:_ Identify users who viewed many products → **Page Count > 10 + Event = View product**
- _Goal:_ Attribute ad traffic to product views → **Source URL contains utm\_source=facebook** (etc.)
- _Goal:_ Compare by device → **Device = Mobile / Desktop**

**3) Add to Cart Behavior**

- _Goal:_ Who clicked Add to cart → **Event = Add to cart**

**4) Cart & Checkout Analysis**

- _Goal:_ Reached checkout but didn’t purchase → **Event = View checkout + Cart Value > 0**
- _Goal:_ Detect checkout drop-offs → **Exit Page contains /checkout**
- _Goal:_ Compare checkout behavior by device → **Event = View checkout + filter by Device**

**5) High-Value Sessions (VIP)**

- _Goal:_ High cart value → **Cart Value > 0** \+ sort by **Page Count** or **Duration**
- _Goal:_ Returning visitors → **Event = Returning shopper**
- _Goal:_ Team-tagged sessions → **Tag = Exactly …**
- _Goal:_ Marked important/favorite → **Favorite = true**

**6) Traffic Source Analysis**

- _Goal:_ Analyze Facebook/Google/etc. → **Source URL** or **Source Type**
- _Goal:_ Campaign-specific landings → **Landing Page contains utm\_campaign=abc**

**Reference**

[https://docs.mida-app.io/dvanced-filters/advanced-filters](https://docs.mida-app.io/advanced-filters/advanced-filters)

* * *

## 2\. Heatmaps

[Section titled “2. Heatmaps”](https://docs.mida-app.io/recordings/analytics/best-practices-for-analytics-with-mida/#2-heatmaps)

**What it is**

Aggregated visual maps of clicks, mouse movement, and scroll depth.

**Why it matters**

Reveal which elements (buttons, images, products) get attention and which are ignored.

**How to use effectively**

- **Spot high-interest products.** Identify products/categories with dense click activity on home/collection pages; feature or promote them.
- **Optimize layout.** If a critical CTA gets few clicks, reconsider placement or appearance (e.g., position or color).

**Reference**

[https://docs.mida-app.io/heatmaps/view-heatmaps](https://docs.mida-app.io/heatmaps/view-heatmaps)

* * *

## 3\. Analytics

[Section titled “3. Analytics”](https://docs.mida-app.io/recordings/analytics/best-practices-for-analytics-with-mida/#3-analytics)

**Goal**

Understand _why_ users don’t convert by analyzing the journey, intent, and friction points.

**Key dashboard areas**

- **Visitors / Sessions** \- Volume & frequency: gauge interest and cadence
- **Successful Orders / Abandoned Carts** \- Identify where drop-offs happen
- **Funnel (Viewed → Cart → Checkout → Order)** \- Locate the exact step with loss
- **Traffic Sources (Organic/Paid/Referral/Direct)** \- Find channels that drive quality traffic
- **Top Pages / Clicks** \- Prioritize content that converts well
- **Devices / Browsers / OS** \- Ensure responsive, error-free experiences
- **Heatmaps / Session Replays** \- Observe real click behavior & scroll depth

**Step-by-step: analyze & improve conversion**

### **3.1. Monitor the funnel - find drop-off points**

[Section titled “3.1. Monitor the funnel - find drop-off points”](https://docs.mida-app.io/recordings/analytics/best-practices-for-analytics-with-mida/#31-monitor-the-funnel---find-drop-off-points)

Follow _Product viewed → Cart added → Checkout started → Order placed_.

If a step drops heavily (e.g., Cart → Checkout), ask: technical errors? trust gaps (badges/reviews)? unclear design?

→ **Action:** Use **Session Replays** or **Heatmaps** to inspect behavior at that step.

#### 3.1.1. Landing → View Product (Viewed)

[Section titled “3.1.1. Landing → View Product (Viewed)”](https://docs.mida-app.io/recordings/analytics/best-practices-for-analytics-with-mida/#311-landing--view-product-viewed)

**Common causes**

- **Message mismatch:** Landing content doesn’t match ad/keyword promise.
- **Weak mobile presentation:** CTA/navigation lacks prominence; hero section too tall; products appear only after deep scroll.
- **Speed/compatibility issues:** Heavy page; browser/device rendering errors.
- **Poor orientation:** Key categories/best-selling products not highlighted.

**How to handle with MIDA**

- **Heatmaps (homepage/landing):** Check click-through on CTA/menu/banner; validate **scroll depth** reaches product blocks.
- **Analytics → Traffic Sources & Top Pages:** Compare **Paid/Organic/Referral/Direct**; find landing pages that drive the most **View product**.

**Quick actions**

- Surface the **primary CTA** and **best-selling products** higher (especially on mobile).
- Align **ad messaging ↔ landing content**.
- Streamline **top navigation**: concise menu, clear category entry points.
- **QA display** across popular devices/browsers (mobile first).

* * *

#### 3.1.2 View Product (PDP) → Add to Cart

[Section titled “3.1.2 View Product (PDP) → Add to Cart”](https://docs.mida-app.io/recordings/analytics/best-practices-for-analytics-with-mida/#312-view-product-pdp--add-to-cart)

**Common causes**

- **Missing info:** Size guide, images, benefits, price/shipping are unclear.
- **CTA not prominent / not sticky on mobile.**
- **Variants:** Users don’t see/believe the right color/size exists.
- **Weak trust:** No reviews; missing warranty/returns badges.
- **Unclear value:** Pricing, bundles, promos, or free-shipping thresholds aren’t obvious.

**How to handle with MIDA**

- **Session Replays:** Compare sessions **with** vs **without** Add to cart (watch variant selection and **rage clicks** on CTA).
- **Heatmaps (PDP):** Check clicks on **gallery, size guide, reviews, CTA**; confirm attention is concentrated on key areas; verify **scroll** to descriptions/specs.
- **Suggested Filters**
  - View product: **Event = View product**
  - Heavy browsers: **Page Count > 10 + Event = View product**
  - Device comparison: **Device = Mobile / Desktop**
  - Exit on PDP: **Exit Page contains /products/**

**Quick actions**

- Make the **Add to cart** CTA highly visible; consider **sticky ATC** on mobile.
- Place **size guide / returns / shipping** near the CTA; clarify **variant** selection.
- Add **reviews** and concise **benefit bullets** (with real-life images).
- Show **promotions & free-shipping thresholds** clearly.

* * *

#### 3.1.3 Add to Cart → Checkout Started

[Section titled “3.1.3 Add to Cart → Checkout Started”](https://docs.mida-app.io/recordings/analytics/best-practices-for-analytics-with-mida/#313-add-to-cart--checkout-started)

**Common causes**

- **UI interruptions:** Mini-cart obscures the “Proceed to checkout” CTA; checkout path is unclear.
- **Pop-ups/upsells** create noise; **app conflicts** cause issues.
- **Trust concerns:** Worries about returns/shipping/payment gateways.
- **“Probe carts”:** Users are only testing price/shipping.

**How to handle with MIDA**

- **Session Replays:** Inspect sessions that have **Add to cart** to observe whether users progress to checkout.

**Quick actions**

- **Reduce noise:** Limit pop-ups/upsells that block the path to checkout.
- **Emphasize trust:** Returns, secure payment, fast support.
- **Clarify the checkout CTA:** Fixed, visible placement (especially in drawers/mini-carts).

* * *

#### 3.1.4 Checkout Started → Order Placed

[Section titled “3.1.4 Checkout Started → Order Placed”](https://docs.mida-app.io/recordings/analytics/best-practices-for-analytics-with-mida/#314-checkout-started--order-placed)

**Shopify plan notes**

- **Non-Shopify Plus:** You cannot modify checkout UI; you can **monitor** with MIDA.
- **Shopify Plus:** You can **review checkout sessions** to spot drop points and **add trust badges** to increase credibility and completion.

**(From Analytics steps)**

### **3.2. Evaluate traffic sources - which channels convert?**

[Section titled “3.2. Evaluate traffic sources - which channels convert?”](https://docs.mida-app.io/recordings/analytics/best-practices-for-analytics-with-mida/#32-evaluate-traffic-sources---which-channels-convert)

Compare _Paid vs Organic vs Referral vs Direct_. Some drive volume but convert poorly.

→ **Action:** Scale high-converting channels; optimize landing for weak ones; align ad messaging with page content.

### **3.3. Focus on high-performing pages/products**

[Section titled “3.3. Focus on high-performing pages/products”](https://docs.mida-app.io/recordings/analytics/best-practices-for-analytics-with-mida/#33-focus-on-high-performing-pagesproducts)

Identify frequently viewed pages or PDPs. Ask why they perform (visuals, CTA, clear pricing/promos).

→ **Action:** Replicate winning elements on weaker pages; ensure clear, mobile-friendly CTAs; use **Heatmaps** to confirm users don’t skip primary actions.

### **3.4. heck device & browser compatibility**

[Section titled “3.4. heck device & browser compatibility”](https://docs.mida-app.io/recordings/analytics/best-practices-for-analytics-with-mida/#34-heck-device--browser-compatibility)

If most users are on mobile, prioritize mobile UX. Low engagement on certain browsers may indicate bugs.

→ **Action:** QA on popular devices/browsers; improve load speed, layout, and button responsiveness on mobile.

### **3.5. Detect & fix button errors (Error Clicks)**

[Section titled “3.5. Detect & fix button errors (Error Clicks)”](https://docs.mida-app.io/recordings/analytics/best-practices-for-analytics-with-mida/#35-detect--fix-button-errors-error-clicks)

Broken/unresponsive buttons directly block conversion.

→ **Action:** Use **Session Replays** to find unresponsive clicks; fix CTAs/checkout immediately; show fallback error messages like “Something went wrong, try again.”

* * *

If you have any questions, feel free to contact us via **Crisp Chat** or email us at [support@mida-app.io](mailto:support@mida-app.io?subject=%5BMIDA%20Support%5D%20Question%20about%20Fraud%20Score&body=Hi%20MIDA%20Team%2C%0A%0AI%20have%20a%20question%20about%20the%20Fraud%20Score%20feature.%20Please%20assist%20me%20with%20the%20following%3A%0A%0A-%20Shop%20URL%3A%20%0A-%20Issue%20details%3A%20%0A%0AThank%20you!%0A%0A%2D%20Your%20Name).