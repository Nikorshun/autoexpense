# AutoExpense — Architecture

This document explains *how the whole system fits together*. For a deep dive on each
individual AWS service (what it is, why it was chosen, and its specific role here), see
[`AWS-SERVICES.md`](AWS-SERVICES.md).

All diagrams are written in **Mermaid**, which GitHub renders natively — so they stay
in version control next to the code instead of going stale in a slide deck.

---

## 1. Design principles

Three principles drive every choice below.

1. **Serverless and event-driven.** There are no servers to patch or scale. Work happens
   in response to events (a receipt arrives, a transaction is fetched), so the system
   costs almost nothing when idle and scales automatically under load.
2. **Use purpose-built services over general-purpose code.** Reading a receipt is a solved
   problem — Amazon Textract `AnalyzeExpense` does it better than any regex we could write.
   We lean on managed AI rather than reinventing it.
3. **Offline-first, not offline-bolted-on.** The client owns a local copy of the data and
   treats the network as an enhancement. Sync and conflict resolution are handled by the
   platform (AppSync + DataStore), not hand-rolled.

---

## 2. The master diagram

```mermaid
flowchart TB
    subgraph CLIENT["Client - any device, online or offline"]
        PWA["Progressive Web App<br/>React + TypeScript<br/>Workbox service worker<br/>IndexedDB local store"]
    end

    subgraph DELIVERY["Content delivery and identity"]
        S3W["S3<br/>static site bucket"]
        CF["CloudFront<br/>global CDN + TLS"]
        COG["Cognito<br/>user pools + federated<br/>Google / Apple sign-in"]
    end

    subgraph API["API layer"]
        APPSYNC["AppSync GraphQL<br/>offline sync + subscriptions"]
        APIGW["API Gateway REST<br/>webhooks and integrations"]
    end

    subgraph INGEST["Ingestion - the automatic part"]
        OB["Open Banking link<br/>Plaid / TrueLayer"]
        SES["SES inbound email<br/>e-receipts"]
        UP["Photo / PDF upload"]
    end

    subgraph CORE["Event-driven processing core"]
        EB["EventBridge<br/>event bus + schedules"]
        SQS["SQS<br/>buffering / retries"]
        SF["Step Functions<br/>orchestrates the pipeline"]
        L1["Lambda: extract"]
        L2["Lambda: enrich"]
        L3["Lambda: policy match"]
        L4["Lambda: submit"]
    end

    subgraph AI["Managed AI"]
        TX["Textract<br/>AnalyzeExpense"]
        CMP["Comprehend<br/>entity / language"]
        BR["Bedrock<br/>categorise + match policy"]
    end

    subgraph DATA["State"]
        DDB[("DynamoDB<br/>expenses / transactions")]
        S3R[("S3<br/>receipt files")]
    end

    subgraph OUT["Output"]
        SNS["SNS / Pinpoint<br/>push + email alerts"]
        EXT["Expense system<br/>QuickBooks / Xero / Concur"]
    end

    subgraph OPS["Cross-cutting"]
        CW["CloudWatch + X-Ray"]
        IAM["IAM least-privilege"]
        SSM["SSM Parameter Store<br/>free secrets"]
        BUD["AWS Budgets<br/>1 dollar alarm"]
    end

    PWA --> CF --> S3W
    PWA --> COG
    PWA <--> APPSYNC
    OB --> APIGW
    SES --> S3R
    UP --> S3R

    APIGW --> EB
    SES --> EB
    S3R --> EB
    EB --> SQS --> SF

    SF --> L1 --> TX
    L1 --> S3R
    SF --> L2 --> CMP
    L2 --> BR
    SF --> L3 --> BR
    SF --> L4 --> EXT

    L2 --> DDB
    L3 --> DDB
    APPSYNC <--> DDB
    L4 --> SNS

    CORE -.observed by.-> CW
    AI -.observed by.-> CW
```

---

## 3. End-to-end flows

The system has three ingestion paths that converge on one processing pipeline.
Showing them as sequence diagrams makes the runtime behaviour concrete.

### 3.1 Email e-receipt (the closest thing to "do nothing")

The user sets up auto-forwarding (or the merchant sends) e-receipts to a unique
address like `u-8a3f@inbox.autoexpense.app`. From there it's fully automatic.

```mermaid
sequenceDiagram
    autonumber
    participant M as Merchant / Inbox
    participant SES as SES (inbound)
    participant S3 as S3 (raw email)
    participant EB as EventBridge
    participant SF as Step Functions
    participant TX as Textract AnalyzeExpense
    participant BR as Bedrock
    participant DDB as DynamoDB
    participant PWA as User's PWA

    M->>SES: e-receipt email
    SES->>S3: store raw MIME
    S3->>EB: ObjectCreated event
    EB->>SF: start pipeline
    SF->>TX: extract line items + totals
    TX-->>SF: structured fields
    SF->>BR: categorise + match policy
    BR-->>SF: category, policy verdict
    SF->>DDB: write expense (status: auto-approved / needs-review)
    DDB-->>PWA: AppSync subscription pushes update
    Note over PWA: User sees a finished<br/>expense with zero taps
```

### 3.2 Open Banking transaction sync

```mermaid
sequenceDiagram
    autonumber
    participant CRON as EventBridge Scheduler
    participant L as Lambda (fetcher)
    participant SM as Secrets Manager
    participant PLD as Plaid / TrueLayer
    participant SF as Step Functions
    participant DDB as DynamoDB

    CRON->>L: every 6h
    L->>SM: get API + user tokens
    L->>PLD: fetch new transactions
    PLD-->>L: merchant, amount, date
    L->>SF: start enrichment pipeline
    SF->>DDB: upsert transaction
    Note over SF,DDB: If a matching e-receipt exists,<br/>the two are reconciled into one expense
```

### 3.3 Photo / PDF fallback

```mermaid
sequenceDiagram
    autonumber
    participant PWA as PWA
    participant COG as Cognito
    participant S3 as S3 (uploads)
    participant EB as EventBridge
    participant SF as Step Functions
    participant TX as Textract

    PWA->>COG: get temp credentials
    PWA->>S3: pre-signed upload of image
    S3->>EB: ObjectCreated
    EB->>SF: start pipeline
    SF->>TX: AnalyzeExpense on the image
    Note over TX: Same pipeline as email —<br/>only the entry point differs
```

---

## 4. Offline mode (the paid tier)

The free tier is online. The paid **"Offline Pro"** tier turns on full offline-first
behaviour. This is the realistic, defensible version of your "works on a plane / on the
same device" idea.

```mermaid
flowchart LR
    subgraph Device["On-device"]
        UI["PWA UI"]
        DS["Amplify DataStore<br/>IndexedDB"]
        SW["Workbox service worker<br/>cached app shell"]
    end
    subgraph Cloud["AWS - when reachable"]
        AS["AppSync"]
        DDB[("DynamoDB")]
    end

    UI <--> DS
    SW -. serves app offline .-> UI
    DS <-. auto-sync when online .-> AS <--> DDB
```

**What "offline" actually means here, precisely:**

- The **app shell** (HTML/CSS/JS) is cached by the service worker, so it opens with no network.
- **Data** lives locally in IndexedDB via DataStore. You can browse, edit, and add expenses offline.
- When connectivity returns, DataStore **syncs automatically** and resolves conflicts
  (last-writer-wins by default, customisable).
- **Why it's a paid tier:** offline ingestion needs more on-device work — local OCR
  (e.g. Tesseract WASM) so a receipt photo can be parsed without the cloud, larger local
  storage quotas, and background sync. That extra footprint and support cost is what the
  subscription covers.

> ⚠️ **On the original Bluetooth idea:** a web app cannot read a phone's wallet or another
> device's transactions over Bluetooth — the OS and Web Bluetooth security model don't
> allow it. The genuine version of "use it across my devices" is: install the PWA on each
> device under the same account; each device keeps its own offline copy and they reconcile
> through AppSync when any of them is online. See [`DATA-SOURCES.md`](DATA-SOURCES.md).

---

## 5. Why these choices (trade-offs in one place)

| Decision | Chosen | Considered instead | Why |
|----------|--------|--------------------|-----|
| Compute | Lambda | ECS/Fargate, EC2 | Spiky, event-driven workload; scale-to-zero; no ops. |
| API | AppSync (+ API Gateway for webhooks) | API Gateway only | AppSync gives offline sync + real-time subscriptions for free. |
| Orchestration | Step Functions | Chained Lambdas | Visual, retryable, auditable pipeline; no glue code. |
| Receipt OCR | Textract `AnalyzeExpense` | Rekognition + regex | Purpose-built for receipts/invoices; returns structured fields. |
| Categorisation | Bedrock (lazy) | Hard-coded rules | Rules + Comprehend run first; Bedrock is only called for low-confidence cases, so token spend stays near zero. |
| Database | DynamoDB | RDS/Aurora | Key-access patterns, serverless scaling, integrates with AppSync. |
| Hosting | S3 + CloudFront | Amplify Hosting | Cheap, global, fine-grained control; classic and well understood. |
| Secrets | SSM Parameter Store | Secrets Manager | Standard parameters are free; Secrets Manager is ~$0.40/secret/month. |
| Networking | No VPC | VPC + NAT Gateway | Everything is serverless, so we skip the ~$32/month NAT Gateway entirely. |
| IaC | AWS CDK (TypeScript) | SAM, Terraform | Same language as the app; type-safe; strong AWS-native story. |

> 💰 **Cost stance:** this architecture is designed to sit at or near $0 on the AWS Free Tier
> for personal/demo usage. The full reasoning, per-service cost table, and the budget-alarm
> setup live in [`COSTS.md`](COSTS.md).

---

## 6. Roadmap / open items

- [x] Scaffold `web/` — React + Vite PWA with Workbox and offline IndexedDB store.
- [x] Scaffold `infra/` — CDK app defining the stack (synthesizes cleanly).
- [x] Scaffold `services/` — Lambda handlers for extract / enrich / match / submit.
- [x] Define the DynamoDB single-table data model (`PK=USER#..`, `SK=EXPENSE#..`).
- [x] Wire the email/upload ingestion path end-to-end (S3 → EventBridge → Step Functions).
- [ ] Connect the PWA to AppSync (swap the local repository for the cloud one).
- [ ] Enable SES inbound rule (needs a verified domain).
- [ ] Add the Open Banking (Plaid/TrueLayer) connector Lambda.
- [ ] Add CI/CD (GitHub Actions → CDK deploy).

The email path is implemented first, since it's the most "magical" demo and is genuinely
hands-off.
