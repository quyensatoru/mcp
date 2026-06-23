---
title: "How to Preview the Block Screen? | MIDA Docs"
url: ""
crawledAt: "2026-06-22T03:19:05.844Z"
---
[Skip to content](https://docs.mida-app.io/fraud-filter/faq/how-to-preview-the-block-screen/#_top)

# How to Preview the Block Screen?

MIDA Fraud Filter, IP Blocker allows you to preview the block experience before enabling rules for real visitors.

Follow these steps to test your block screen:

Step 1: Get your IP address

Go to: [https://www.whatismyip.com](https://www.whatismyip.com/) or [https://ipinfo.io\](https://ipinfo.io%5C/)
Copy your public IP address (e.g. 203.123.45.67)

Step 2: Create a test block rule

In the MIDA app:

- Go to the Rules tab
- Click “Create Rule”
- Condition → Select “IP/CIDR”
- Enter your IP address from Step 1
- Action → Select “Block” (or Redirect)
- Save the rule
- Keep the rule in “Test Mode” or deactivate all other rules to avoid blocking real traffic.

Step 3: Open your storefront in an incognito/private window

Visit your storefront URL (e.g. [https://yourstore.com)\](https://yourstore.com)%5C/)
Since the IP in the rule matches yours, you’ll be blocked — and you’ll see your customized block screen.

Step 4: Adjust your block screen design (optional)

- Go to Settings > Block Page
- Customize title, message, colors, images, etc.
- Repeat the preview to see how it looks

Step 5: Remove or deactivate the test rule

Once you’re satisfied with the result, you can remove or disable the test rule.

🧪 Tip: This method is great for testing without risking accidental block of real customers.

If you have any questions, feel free to contact us via **Crisp Chat** or email us at [support@mida-app.io](mailto:support@mida-app.io?subject=%5BMIDA%20Support%5D%20Question%20about%20Fraud%20Filter&body=Hi%20MIDA%20Team%2C%0A%0AI%20have%20a%20question%20about%20the%20Fraud%20Filter%20app.%20Please%20assist%20me%20with%20the%20following%3A%0A%0A-%20Shop%20URL%3A%20%0A-%20Issue%20details%3A%20%0A%0AThank%20you!%0A%0A%2D%20Your%20Name).