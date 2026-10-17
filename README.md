# Lighthouse

**An independent Customer Success and account-intelligence application.**

Lighthouse explores a problem familiar from managing enterprise accounts: how to see which customer relationships need attention, understand the signals behind that priority, and prepare a useful next action.

[Open the working demo](https://lighthouse-alpha-two.vercel.app/) · [See the project on rlemor.com](https://rlemor.com/projects#lighthouse)

![Actual Lighthouse account-intelligence dashboard, showing example portfolio information](https://rlemor.com/projects/lighthouse/overview-desktop.webp)

*Actual application interface with illustrative account data. This is not a live customer portfolio.*

## The problem

Customer information is often scattered across usage trends, support activity, renewal dates, account history, and individual notes. A busy account manager needs a way to notice changes and decide where to focus without treating a single score as the whole relationship.

## What the demo demonstrates

- **Accounts:** an account workspace with health signals, risk indicators, usage information, and context for follow-up.
- **Portfolio:** a consolidated view of account health, renewal exposure, and prioritization across a sample portfolio.
- **AI-assisted analysis:** account health analysis and executive briefing workflows, using an Anthropic integration when configured.
- **Light and dark themes:** a light-default interface with an optional dark theme and saved preference.
- **Responsive layouts:** desktop and mobile presentations of the same account-management workflow.

The sample records and calculated indicators are for demonstration. Lighthouse is not connected to an employer's CRM or real client data.

## Product decisions

The goal is not to replace a Customer Success manager's judgment. The interface is designed to make scattered signals easier to inspect, distinguish risk from context, and turn a portfolio review into a clearer next conversation.

This is an **independent working demo**, not a claim of enterprise adoption or validated customer outcomes.

## Implementation

- Next.js App Router, React, and TypeScript
- Recharts for data visualization
- Lucide icons and CSS styling
- Anthropic SDK for the optional AI endpoint
- Vercel for the live demo

The account dataset and health-score logic live in the application source. The AI endpoint requires a configured API key.

## Run locally

Requires Node.js and npm.

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To enable the Anthropic-backed analysis endpoint, configure `ANTHROPIC_API_KEY` in a local environment file. Do not commit credentials.

For a production build:

```bash
npm run build
npm run start
```

## About

Built by **Rafael Lemor**, whose background is in Customer Success, account management, commercial relationships, and operations. Lighthouse grew out of his interest in building practical tools for the kinds of decisions he has handled professionally.

[Explore Rafael's work](https://rlemor.com/work)
