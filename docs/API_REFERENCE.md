# CCNA StudyLab -- API Reference

> **Last updated:** 2026-03-01
> **Version:** 1.0.0

---

## Table of Contents

1. [Next.js API Routes (Web Backend)](#nextjs-api-routes-web-backend)
2. [Lab Engine API (FastAPI :8100)](#lab-engine-api-fastapi-8100)

---

## Next.js API Routes (Web Backend)

Base URL: `http://localhost:3000`

---

### POST /api/chat

AI Tutor chat endpoint. Streams Claude responses back to the client using chunked transfer encoding.

**Authentication:** None (server-side API key from environment)

**Request Body:**

```json
{
  "messages": [
    { "role": "user", "content": "Explain the difference between OSPF and EIGRP" },
    { "role": "assistant", "content": "OSPF and EIGRP are both interior gateway protocols..." },
    { "role": "user", "content": "Can you show me how to configure OSPF on a Cisco router?" }
  ],
  "domain": "ip-connectivity"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `messages` | `Array<{role, content}>` | Yes | Conversation history. Each message must have `role` ("user" or "assistant") and `content` (string). |
| `domain` | `string \| null` | No | Domain slug to activate domain-specific system prompt. One of: `network-fundamentals`, `network-access`, `ip-connectivity`, `ip-services`, `security-fundamentals`, `automation-programmability`. |

**Response:** Streaming `text/plain; charset=utf-8`

The response is a raw text stream (not SSE, not JSON). Each chunk contains a fragment of the assistant's response text. The client accumulates chunks to build the full message.

**Response Headers:**
```
Content-Type: text/plain; charset=utf-8
Cache-Control: no-cache
Transfer-Encoding: chunked
```

**Error Responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 400 | `{"error": "Messages array is required and must not be empty."}` | Missing or empty messages array |
| 400 | `{"error": "Each message must have a role and content."}` | Malformed message object |
| 400 | `{"error": "Message role must be 'user' or 'assistant'."}` | Invalid role value |
| 200 | Streaming text explaining the key is not configured | Missing or invalid API key (rendered as a chat message) |
| 200 | Streaming text asking user to wait | Anthropic rate limit exceeded (rendered as a chat message) |
| 200 | Streaming text with error details | Anthropic API or server error (rendered as a chat message) |

---

### GET /api/flashcards

List all flashcards, optionally filtered by domain.

**Authentication:** None

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `domain` | `string` | No | Domain slug to filter (e.g., `ip-connectivity`, `network-fundamentals`) |

**Response:** `200 OK`

```json
{
  "flashcards": [
    {
      "id": "fc-001",
      "question": "What is the default administrative distance of OSPF?",
      "answer": "110",
      "explanation": "OSPF has an administrative distance of 110, which is higher than EIGRP (90) but lower than RIP (120).",
      "domain": "IP Connectivity",
      "domainSlug": "ip-connectivity",
      "objectiveCode": "3.1",
      "difficulty": "easy",
      "tags": ["ospf", "routing", "administrative-distance"]
    }
  ],
  "total": 199,
  "byDomain": {
    "network-fundamentals": 30,
    "network-access": 33,
    "ip-connectivity": 35,
    "ip-services": 30,
    "security-fundamentals": 36,
    "automation-programmability": 35
  }
}
```

---

### GET /api/flashcards/progress

Retrieve the authenticated user's flashcard SM-2 progress from the database.

**Authentication:** Session (returns empty object when unauthenticated)

**Response:** `200 OK`

```json
{
  "progress": {
    "fc-001": {
      "ease": 2.6,
      "interval": 4,
      "repetitions": 3,
      "nextReview": "2026-03-01",
      "lastReview": "2026-02-25"
    }
  }
}
```

---

### POST /api/flashcards/progress

Save flashcard review result. Persists to both localStorage (client-side) and the database (server-side, fire-and-forget).

**Authentication:** Optional (persists to DB only when authenticated)

**Request Body:**

```json
{
  "flashcardId": "fc-001",
  "quality": 3,
  "currentProgress": {
    "ease": 2.5,
    "interval": 1,
    "repetitions": 1
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `flashcardId` | `string` | Yes | Flashcard identifier |
| `quality` | `number` | Yes | SM-2 rating (0-5 scale: 0=blackout, 1=wrong, 2=wrong-but-close, 3=correct-with-difficulty, 4=correct, 5=perfect). The UI uses 1-4 buttons labeled Again, Hard, Good, Easy. |
| `currentProgress` | `object \| null` | Yes | Current SM-2 state or null for new cards |

**Response:** `200 OK`

```json
{
  "progress": {
    "flashcardId": "fc-001",
    "repetitions": 2,
    "ease": 2.6,
    "interval": 6,
    "nextReview": "2026-03-05T00:00:00.000Z",
    "lastReview": "2026-02-27T10:00:00.000Z",
    "quality": 3
  }
}
```

---

### GET /api/exams

List available practice exams, optionally filtered by domain.

**Authentication:** None

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `domain` | `string` | No | Domain slug to filter questions |

**Response:** `200 OK`

```json
{
  "exams": [
    {
      "id": "sample-exam-1",
      "title": "CCNA 200-301 Practice Exam 1",
      "questionCount": 40,
      "timeLimit": 60
    }
  ]
}
```

---

### GET /api/exams/{examId}

Get a specific exam with questions (answers stripped for the client).

**Authentication:** None

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `examId` | `string` | Exam identifier (e.g., `sample-exam-1`) |

**Response:** `200 OK`

Returns the exam object with questions. Correct answers are stripped to prevent cheating.

**Error Responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 404 | `{"error": "Exam \"...\" not found"}` | Invalid exam ID |

---

### POST /api/exams/{examId}/grade

Grade a submitted exam and optionally persist the attempt.

**Authentication:** Optional (persists to DB when authenticated)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `examId` | `string` | Exam identifier |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `domain` | `string` | No | Domain filter applied during the exam |

**Request Body:**

```json
{
  "answers": {
    "q-001": "B",
    "q-002": ["A", "C"]
  },
  "timeTaken": 3600
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `answers` | `Record<string, string \| string[]>` | Yes | Map of question ID to selected answer(s) |
| `timeTaken` | `number` | Yes | Time in seconds |

**Response:** `200 OK`

```json
{
  "score": 78,
  "totalQuestions": 40,
  "correctCount": 31,
  "passed": true,
  "timeTaken": 3600,
  "questions": [...],
  "domainScores": {...}
}
```

---

### GET /api/exams/attempts

Retrieve past exam attempts for the authenticated user.

**Authentication:** Session (returns empty array when unauthenticated)

**Response:** `200 OK`

```json
{
  "attempts": [
    {
      "id": "att-001",
      "score": 78,
      "totalQuestions": 40,
      "domainFilter": null,
      "timeTakenSeconds": 3600,
      "createdAt": "2026-02-27T10:00:00Z"
    }
  ]
}
```

---

### GET /api/labs

List all available labs, optionally filtered by type or domain.

**Authentication:** None

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | `string` | No | Lab type: `ios-cli`, `subnetting`, `config-review`, `python`, `acl-builder` |
| `domain` | `string` | No | Domain slug |

**Response:** `200 OK`

Returns an array of lab metadata.

---

### GET /api/labs/{slug}

Get a specific lab by slug (solution code stripped).

**Authentication:** None

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `slug` | `string` | Lab slug (e.g., `ios-configure-vlan`, `subnet-class-c`) |

**Response:** `200 OK`

---

### POST /api/labs/{slug}/run

Execute submitted code for a lab and grade the result. The Next.js route proxies the request to the Lab Engine's grading endpoint, dispatching to the appropriate grader based on the lab's type.

**Authentication:** Optional (persists attempt to DB when authenticated)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `slug` | `string` | Lab slug |

**Request Body:**

```json
{
  "code": "enable\nconfigure terminal\ninterface GigabitEthernet0/0\nip address 192.168.1.1 255.255.255.0\nno shutdown\nexit",
  "language": "ios-cli"
}
```

**Response:** `200 OK`

```json
{
  "passed": true,
  "output": "Matched 6/6 commands.",
  "errors": "",
  "score": 1.0,
  "feedback": "Great work! Your solution is correct."
}
```

---

### GET /api/labs/{slug}/solution

Get the solution code and expected output for a lab.

**Authentication:** None

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `slug` | `string` | Lab slug (e.g., `ios-configure-vlan`) |

**Response:** `200 OK`

```json
{
  "solutionCode": "enable\nconfigure terminal\nvlan 10\nname SALES\nexit",
  "expectedOutput": "Expected output text..."
}
```

**Error Responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 404 | `{"error": "Lab \"...\" not found"}` | Invalid lab slug |

---

### GET /api/labs/attempts

Retrieve lab completion statuses for the authenticated user.

**Authentication:** Session (returns empty object when unauthenticated)

**Response:** `200 OK`

```json
{
  "attempts": {
    "ios-configure-vlan": {
      "labSlug": "ios-configure-vlan",
      "status": "completed",
      "lastAttemptAt": "2026-02-27T10:00:00Z"
    }
  }
}
```

---

### GET /api/study/{slug}

Get a study guide by domain slug.

**Authentication:** None

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `slug` | `string` | Domain slug (e.g., `network-fundamentals`, `ip-connectivity`) |

**Response:** `200 OK`

Returns the study guide content.

---

### GET /api/study/progress

Retrieve completed study objectives for the authenticated user.

**Authentication:** Session (returns empty array when unauthenticated)

**Response:** `200 OK`

```json
{
  "completed": ["1.1", "1.2", "2.1"]
}
```

---

### POST /api/study/progress

Toggle a study objective's completion status.

**Authentication:** Optional (persists to DB when authenticated)

**Request Body:**

```json
{
  "objectiveCode": "1.1",
  "completed": true
}
```

**Response:** `200 OK`

```json
{ "ok": true }
```

---

### GET /api/dashboard/stats

Aggregated dashboard statistics for the authenticated user.

**Authentication:** Session (returns null when unauthenticated)

**Response:** `200 OK`

```json
{
  "stats": {
    "overallProgress": 48,
    "bestExamScore": 85,
    "domains": [...],
    "recentActivity": [...]
  }
}
```

---

### POST /api/auth/[...nextauth]

Auth.js authentication handler. Supports credentials-based login.

**Authentication:** None

See [Auth.js documentation](https://authjs.dev/) for the full NextAuth REST API.

---

### GET /api/tutor/conversations

List all tutor conversations for the authenticated user, ordered by most recent.

**Authentication:** Session (returns empty array when unauthenticated)

**Response:** `200 OK`

```json
{
  "conversations": [
    {
      "id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
      "title": "Explain the difference between OSPF and EIGRP",
      "domainId": 3,
      "createdAt": "2026-02-27T10:00:00.000Z",
      "updatedAt": "2026-02-27T10:05:00.000Z"
    }
  ]
}
```

---

### POST /api/tutor/conversations

Create a new tutor conversation.

**Authentication:** Session (returns `{ id: null }` when unauthenticated)

**Request Body:**

```json
{
  "title": "Help me understand STP port states",
  "domainId": 2
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | `string` | Yes | Conversation title (typically the first message) |
| `domainId` | `number \| null` | No | Domain ID (1-6) or null for all domains |

**Response:** `200 OK`

```json
{ "id": "a1b2c3d4-5678-90ab-cdef-1234567890ab" }
```

---

### GET /api/tutor/conversations/{id}

Get a single conversation with all its messages.

**Authentication:** Session

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | Conversation UUID |

**Response:** `200 OK`

```json
{
  "conversation": {
    "id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
    "title": "Help me understand STP port states",
    "domainId": 2,
    "createdAt": "2026-02-27T10:00:00.000Z",
    "updatedAt": "2026-02-27T10:05:00.000Z",
    "messages": [
      { "id": 1, "role": "user", "content": "Help me understand STP port states", "createdAt": "2026-02-27T10:00:00.000Z" },
      { "id": 2, "role": "assistant", "content": "Spanning Tree Protocol (STP) defines five port states...", "createdAt": "2026-02-27T10:00:05.000Z" }
    ]
  }
}
```

**Error Responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 404 | `{"error": "Conversation not found"}` | Invalid ID or not owned by user |

---

### PATCH /api/tutor/conversations/{id}

Update a conversation's title.

**Authentication:** Session

**Request Body:**

```json
{ "title": "Updated conversation title" }
```

**Response:** `200 OK`

```json
{ "success": true }
```

---

### DELETE /api/tutor/conversations/{id}

Delete a conversation and all its messages.

**Authentication:** Session

**Response:** `200 OK`

```json
{ "success": true }
```

---

### POST /api/tutor/conversations/{id}/messages

Save a message to a conversation.

**Authentication:** Session

**Request Body:**

```json
{
  "role": "user",
  "content": "What is the difference between standard and extended ACLs?"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `role` | `string` | Yes | `"user"` or `"assistant"` |
| `content` | `string` | Yes | Message text |

**Response:** `200 OK`

```json
{ "id": 3 }
```

**Error Responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 400 | `{"error": "role and content are required"}` | Missing fields |
| 400 | `{"error": "role must be 'user' or 'assistant'"}` | Invalid role |

---

## Lab Engine API (FastAPI :8100)

Base URL: `http://localhost:8100`

OpenAPI docs available at `http://localhost:8100/docs`

The lab engine grades five lab types for CCNA 200-301 study: IOS CLI command sequences, subnetting exercises, configuration reviews, ACL construction, and Python scripting.

---

### GET /health

Service health check.

**Authentication:** None

**Response:** `200 OK`

```json
{
  "status": "healthy",
  "service": "lab-engine",
  "version": "1.0.0",
  "lab_types": ["ios-cli", "subnetting", "config-review", "python", "acl-builder"]
}
```

---

### POST /api/v1/grade

Grade a submitted lab exercise. The `lab_type` field determines which grader is dispatched:

| `lab_type` | Grader | What it validates |
|------------|--------|-------------------|
| `ios-cli` | `ios_grader` | IOS CLI command sequences, with abbreviation support and optional ordering |
| `subnetting` | `subnet_grader` | Subnetting answers: network address, broadcast, first/last host, host count, subnet mask |
| `config-review` | `config_grader` | Device configuration corrections using `required_lines`, `forbidden_lines`, and `required_sections` |
| `acl-builder` | `acl_grader` | ACL statements with optional ordering and interface application checks |
| `python` | `python_grader` | Python code execution in a sandboxed subprocess, with output matching |

**Authentication:** None

**Request Body:**

```json
{
  "exercise_id": "ex-001",
  "code": "<user submission>",
  "lab_type": "ios-cli",
  "expected": { ... }
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `exercise_id` | `string` | Yes | -- | Exercise to grade against |
| `code` | `string` | Yes | -- | Student's submission (commands, answers, or source code depending on lab type) |
| `lab_type` | `string` | No | `"python"` | One of: `ios-cli`, `subnetting`, `config-review`, `acl-builder`, `python` |
| `expected` | `object \| null` | No | `null` | Grading criteria (structure varies by lab type, see examples below) |

**Response:** `200 OK`

```json
{
  "passed": true,
  "output": "...",
  "errors": "",
  "score": 1.0,
  "exercise_id": "ex-001",
  "feedback": "Great work! Your solution is correct."
}
```

| Field | Type | Description |
|-------|------|-------------|
| `passed` | `boolean` | Whether the submission passed |
| `output` | `string` | Grader output (matched commands, score breakdown, etc.) |
| `errors` | `string` | Error messages (empty string on success) |
| `score` | `float` | 0.0 to 1.0 (partial credit supported) |
| `exercise_id` | `string` | Echo of the submitted exercise ID |
| `feedback` | `string \| null` | Human-readable feedback message |

**Error Responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 400 | `{"detail": "Unknown lab type: <type>"}` | Invalid `lab_type` value |

#### Example: IOS CLI lab

Validates that the user enters the correct sequence of IOS commands. Supports command abbreviations (e.g., `int gi0/0` matches `interface GigabitEthernet0/0`) and optional ordering.

```json
{
  "exercise_id": "ios-configure-interface",
  "code": "enable\nconfigure terminal\ninterface GigabitEthernet0/0\nip address 192.168.1.1 255.255.255.0\nno shutdown\nexit",
  "lab_type": "ios-cli",
  "expected": {
    "commands": [
      "enable",
      "configure terminal",
      "interface GigabitEthernet0/0",
      "ip address 192.168.1.1 255.255.255.0",
      "no shutdown",
      "exit"
    ],
    "ordered": true
  }
}
```

#### Example: Subnetting lab

Validates key=value answers for subnetting calculations.

```json
{
  "exercise_id": "subnet-class-c",
  "code": "network=192.168.1.0\nbroadcast=192.168.1.255\nfirst_host=192.168.1.1\nlast_host=192.168.1.254\nhosts=254\nsubnet_mask=255.255.255.0",
  "lab_type": "subnetting",
  "expected": {
    "answers": {
      "network": "192.168.1.0",
      "broadcast": "192.168.1.255",
      "first_host": "192.168.1.1",
      "last_host": "192.168.1.254",
      "hosts": "254",
      "subnet_mask": "255.255.255.0"
    }
  }
}
```

#### Example: Config review lab

Validates a corrected device configuration against required and forbidden lines, plus required sections with their sub-lines.

```json
{
  "exercise_id": "config-fix-routing",
  "code": "hostname R1\nip routing\ninterface GigabitEthernet0/0\n ip address 192.168.1.1 255.255.255.0\n no shutdown\n!\nrouter ospf 1\n network 192.168.1.0 0.0.0.255 area 0",
  "lab_type": "config-review",
  "expected": {
    "required_lines": ["hostname R1", "ip routing"],
    "forbidden_lines": ["no ip routing"],
    "required_sections": {
      "interface GigabitEthernet0/0": [
        "ip address 192.168.1.1 255.255.255.0",
        "no shutdown"
      ],
      "router ospf 1": [
        "network 192.168.1.0 0.0.0.255 area 0"
      ]
    }
  }
}
```

#### Example: ACL builder lab

Validates ACL entries with optional ordering and interface application checks.

```json
{
  "exercise_id": "acl-web-traffic",
  "code": "access-list 100 permit tcp 192.168.1.0 0.0.0.255 any eq 80\naccess-list 100 permit tcp 192.168.1.0 0.0.0.255 any eq 443\naccess-list 100 deny ip any any\ninterface GigabitEthernet0/0\n ip access-group 100 in",
  "lab_type": "acl-builder",
  "expected": {
    "entries": [
      "access-list 100 permit tcp 192.168.1.0 0.0.0.255 any eq 80",
      "access-list 100 permit tcp 192.168.1.0 0.0.0.255 any eq 443",
      "access-list 100 deny ip any any"
    ],
    "ordered": true,
    "check_apply": {
      "interface": "GigabitEthernet0/0",
      "direction": "in"
    }
  }
}
```

#### Example: Python lab

Executes Python code in a sandboxed subprocess and checks stdout against expected output.

```json
{
  "exercise_id": "python-subnet-calculator",
  "code": "import ipaddress\nnet = ipaddress.ip_network('192.168.10.0/24')\nprint(f'Network: {net.network_address}')\nprint(f'Broadcast: {net.broadcast_address}')\nprint(f'Hosts: {net.num_addresses - 2}')",
  "lab_type": "python",
  "expected": {
    "output_contains": "Network: 192.168.10.0"
  }
}
```

---

### POST /api/v1/sandbox/run

Execute arbitrary code in a sandboxed subprocess. For open-ended practice without exercise-specific validation.

**Authentication:** None

**Request Body:**

```json
{
  "code": "import ipaddress\nfor net in ipaddress.ip_network('10.0.0.0/8').subnets(new_prefix=16):\n    print(net)",
  "language": "python",
  "timeout": 10
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `code` | `string` | Yes | -- | Source code to execute |
| `language` | `string` | No | `"python"` | Programming language |
| `timeout` | `integer` | No | `10` | Max execution time in seconds |

**Response:** `200 OK`

```json
{
  "output": "10.0.0.0/16\n10.1.0.0/16\n10.2.0.0/16\n...",
  "errors": "",
  "exit_code": 0
}
```

| Field | Type | Description |
|-------|------|-------------|
| `output` | `string` | Captured stdout |
| `errors` | `string` | Captured stderr |
| `exit_code` | `integer` | 0 for success, 1 for errors |
