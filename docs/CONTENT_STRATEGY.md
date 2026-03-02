# CCNA StudyLab -- Content Strategy

> **Last updated:** 2026-02-27
> **Version:** 1.0.0

---

## Table of Contents

1. [Content Overview](#content-overview)
2. [Content Sources](#content-sources)
3. [Question Generation Methodology](#question-generation-methodology)
4. [Validation Pipeline](#validation-pipeline)
5. [Content Schemas](#content-schemas)
6. [Bloom's Taxonomy Mapping](#blooms-taxonomy-mapping)
7. [Coverage Matrix](#coverage-matrix)
8. [Update and Maintenance Process](#update-and-maintenance-process)

---

## Content Overview

CCNA StudyLab content is organized around three primary content types that reinforce learning through different modalities:

| Content Type | Purpose | Count Target | Storage |
|-------------|---------|--------------|---------|
| **Flashcards** | Spaced repetition review of key concepts | 10-15 per objective (~600 total) | `flashcards` table |
| **Practice Questions** | Exam-style assessment with multiple question types | 5-10 per objective (~400 total) | `practice_questions` table |
| **Labs** | Hands-on coding exercises with auto-grading | 1-2 per objective (~60 total) | `labs` table + exercise files |

All content is mapped to the 53 exam objectives across 6 domains, ensuring complete coverage of the CCNA 200-301 exam blueprint.

---

## Content Sources

Content is derived from authoritative sources only. No proprietary exam questions or brain dumps are used.

### Primary Sources

| Source | Type | Usage |
|--------|------|-------|
| **Cisco CCNA 200-301 Exam Blueprint (v1.1)** | Official | Defines all 53 objectives and domain weights |
| **Cisco IOS Configuration Guides** | Official | Router and switch configuration references |
| **Cisco Learning Network** | Official | Study materials and community resources |
| **RFC Documents** | Standard | OSPF (RFC 2328), IPv6 (RFC 8200), DHCP (RFC 2131), DNS (RFC 1035) |
| **Cisco Press CCNA Official Cert Guide** | Educational | Comprehensive CCNA topic coverage |
| **IEEE 802.1Q / 802.1D Standards** | Standard | VLAN trunking, spanning tree protocol |
| **Python Official Documentation** | Standard | Language reference for automation scripting |

### Secondary Sources

| Source | Type | Usage |
|--------|------|-------|
| **Cisco Packet Tracer** | Practice | Network simulation and lab exercises |
| **Cisco IOS Command Reference** | Reference | CLI commands, syntax, and output formats |
| **Cisco Press publications** | Educational | Concept explanations and examples |
| **Subnetting practice tools** | Practice | IP addressing and VLSM calculation references |

### Prohibited Sources

- Actual exam questions or "brain dumps"
- Copyrighted course material (without license)
- AI-generated content without fact-checking
- Outdated documentation (pre-2024 for IOS references)

---

## Question Generation Methodology

### Process

1. **Objective Analysis:** Parse each exam objective to identify the knowledge and skills required
2. **Concept Extraction:** Break objectives into atomic concepts (facts, procedures, comparisons)
3. **Question Drafting:** Create questions targeting each concept using appropriate Bloom's levels
4. **Distractor Design:** Craft plausible but incorrect answers based on common misconceptions
5. **Explanation Writing:** Write detailed explanations referencing source material
6. **Difficulty Calibration:** Assign difficulty based on Bloom's level and concept complexity
7. **Peer Review:** Technical review for accuracy and clarity
8. **Tagging:** Apply domain, objective, and topic tags

### Question Types

| Type | Database Enum | Format | Use Case |
|------|--------------|--------|----------|
| **Multiple Choice** | `multiple_choice` | Single correct answer from 4 options | Factual recall, concept identification |
| **Multiple Select** | `multiple_select` | 2-3 correct answers from 5-6 options | Comprehensive understanding |
| **Drag & Drop** | `drag_drop` | Match or order items | Sequence understanding, categorization |
| **Fill in the Blank** | `fill_blank` | Type the correct value | Exact recall (ports, subnet masks, IOS commands) |

### Distractor Guidelines

- Each distractor must be plausible to someone who partially understands the topic
- Distractors should represent common misconceptions, not random wrong answers
- Avoid "all of the above" and "none of the above" options
- Distractors should be similar in length and structure to the correct answer
- Never use trick questions or intentionally misleading wording

---

## Validation Pipeline

Content passes through a four-stage validation pipeline before being marked as production-ready.

### Stage 1: Schema Validation

Automated validation that every content item conforms to its JSON schema.

**Checks:**
- All required fields are present and non-empty
- Field types match the schema (string, array, enum values)
- Difficulty enum is one of: `easy`, `medium`, `hard`
- Question type enum is one of: `multiple_choice`, `multiple_select`, `drag_drop`, `fill_blank`
- `correct_answer` format matches the question type
- `options` array length is 4 (MC) or 5-6 (MS) when applicable
- `source_url` is a valid URL when provided
- `tags` is an array of non-empty strings

### Stage 2: Fact-Checking

Manual and semi-automated verification of technical accuracy.

**Checks:**
- Correct answers are verified against official documentation
- IOS commands and syntax match current IOS-XE versions
- Configuration examples are syntactically valid
- Port numbers, protocol names, and version numbers are current
- Technology names use current branding (e.g., "Wi-Fi 6" not just "802.11ax")

### Stage 3: Coverage Audit

Ensures complete coverage of the exam blueprint.

**Checks:**
- Every objective has at least 5 practice questions
- Every objective has at least 10 flashcards
- Difficulty distribution is balanced (30% easy, 50% medium, 20% hard)
- Question type distribution includes at least 2 types per objective
- No domain has fewer than its weighted proportion of total questions

### Stage 4: Duplicate Detection

Prevents redundant content.

**Checks:**
- No two flashcards have the same question text (fuzzy matching)
- No two practice questions test the identical concept at the same difficulty
- Questions that seem similar are flagged for manual review
- Cross-domain questions are intentionally mapped to the primary objective

---

## Content Schemas

### Flashcard Schema

```typescript
interface Flashcard {
  id: string;              // UUID, auto-generated
  objectiveId: number;     // FK to objectives table
  question: string;        // Front of card (plain text or markdown)
  answer: string;          // Back of card (plain text or markdown)
  explanation?: string;    // Extended explanation with context
  sourceUrl?: string;      // Reference URL for fact-checking
  difficulty: "easy" | "medium" | "hard";
  tags?: string[];         // Topic tags for filtering
}
```

**Example:**
```json
{
  "objectiveId": 8,
  "question": "What is the purpose of the OSPF Router ID?",
  "answer": "The OSPF Router ID uniquely identifies each router in an OSPF domain. It is a 32-bit value in dotted-decimal format. Selection priority: 1) Manually configured with 'router-id' command. 2) Highest IP on a loopback interface. 3) Highest IP on an active physical interface.",
  "explanation": "The Router ID is critical for OSPF neighbor relationships and LSA origination. If two routers share the same Router ID, adjacency issues and routing problems will occur. Best practice is to explicitly configure the Router ID or use a loopback address for stability.",
  "sourceUrl": "https://www.cisco.com/c/en/us/support/docs/ip/open-shortest-path-first-ospf/",
  "difficulty": "medium",
  "tags": ["ospf", "routing", "router-id"]
}
```

### Practice Question Schema

```typescript
interface PracticeQuestion {
  id: string;              // UUID, auto-generated
  objectiveId: number;     // FK to objectives table
  type: "multiple_choice" | "multiple_select" | "drag_drop" | "fill_blank";
  question: string;        // Question text (markdown supported)
  options?: JsonValue;     // Answer options (varies by type)
  correctAnswer: JsonValue; // Correct answer(s)
  explanation?: string;    // Why the answer is correct
  sourceUrl?: string;      // Reference URL
  difficulty: "easy" | "medium" | "hard";
  tags?: string[];         // Topic tags
}
```

**Multiple Choice Example:**
```json
{
  "objectiveId": 12,
  "type": "multiple_choice",
  "question": "Which command assigns a switch port to VLAN 10?",
  "options": [
    { "key": "A", "text": "switchport mode trunk" },
    { "key": "B", "text": "switchport access vlan 10" },
    { "key": "C", "text": "vlan 10 name Sales" },
    { "key": "D", "text": "interface vlan 10" }
  ],
  "correctAnswer": "B",
  "explanation": "The 'switchport access vlan 10' command assigns the interface to VLAN 10 as an access port. 'switchport mode trunk' configures trunking. 'vlan 10 name Sales' names the VLAN. 'interface vlan 10' creates an SVI, not a port assignment.",
  "difficulty": "easy",
  "tags": ["vlans", "switching", "ios-commands"]
}
```

**Multiple Select Example:**
```json
{
  "objectiveId": 35,
  "type": "multiple_select",
  "question": "Which of the following are characteristics of OSPF? (Choose 3)",
  "options": [
    { "key": "A", "text": "Uses Dijkstra's SPF algorithm" },
    { "key": "B", "text": "Distance-vector routing protocol" },
    { "key": "C", "text": "Supports VLSM and CIDR" },
    { "key": "D", "text": "Default administrative distance of 110" },
    { "key": "E", "text": "Uses hop count as its metric" }
  ],
  "correctAnswer": ["A", "C", "D"],
  "explanation": "OSPF is a link-state protocol (not distance-vector) that uses Dijkstra's SPF algorithm, supports VLSM/CIDR, and has an AD of 110. OSPF uses cost (based on bandwidth) as its metric, not hop count (which is RIP).",
  "difficulty": "medium",
  "tags": ["ospf", "routing", "link-state"]
}
```

**Fill in the Blank Example:**
```json
{
  "objectiveId": 5,
  "type": "fill_blank",
  "question": "A /24 subnet mask in dotted-decimal notation is ____.",
  "options": null,
  "correctAnswer": "255.255.255.0",
  "explanation": "A /24 prefix means 24 bits are used for the network portion, leaving 8 bits for hosts. This translates to 255.255.255.0 in dotted-decimal. Common masks: /8 = 255.0.0.0, /16 = 255.255.0.0, /24 = 255.255.255.0.",
  "difficulty": "easy",
  "tags": ["subnetting", "ipv4", "network-fundamentals"]
}
```

---

## Bloom's Taxonomy Mapping

Questions are designed to target specific cognitive levels from Bloom's Taxonomy, mapped to difficulty:

### Level Mapping

| Bloom's Level | Difficulty | Question Approach | Example Verbs |
|--------------|-----------|-------------------|---------------|
| **Remember** | Easy | Direct recall of facts, definitions, ports | Define, list, identify, name |
| **Understand** | Easy-Medium | Explain concepts, compare approaches | Describe, explain, compare, distinguish |
| **Apply** | Medium | Use knowledge in a new scenario | Implement, construct, demonstrate, use |
| **Analyze** | Medium-Hard | Break down problems, troubleshoot | Analyze, troubleshoot, differentiate, examine |
| **Evaluate** | Hard | Judge best approach, assess tradeoffs | Evaluate, justify, recommend, assess |
| **Create** | Hard (Labs) | Design solutions, write code | Design, construct, build, develop |

### Distribution Target

| Bloom's Level | Flashcard % | Question % | Lab % |
|--------------|-------------|------------|-------|
| Remember | 40% | 15% | 0% |
| Understand | 35% | 25% | 10% |
| Apply | 15% | 30% | 40% |
| Analyze | 8% | 20% | 25% |
| Evaluate | 2% | 8% | 15% |
| Create | 0% | 2% | 10% |

---

## Coverage Matrix

### Domain Coverage Requirements

| Domain | Weight | Questions (min) | Flashcards (min) | Labs (min) |
|--------|--------|-----------------|-------------------|------------|
| 1. Network Fundamentals | 20% | 60 | 120 | 6 |
| 2. Network Access | 20% | 60 | 120 | 6 |
| 3. IP Connectivity | 25% | 75 | 150 | 8 |
| 4. IP Services | 10% | 30 | 60 | 3 |
| 5. Security Fundamentals | 15% | 45 | 90 | 5 |
| 6. Automation and Programmability | 10% | 30 | 60 | 3 |
| **Total** | **100%** | **300+** | **600+** | **31+** |

### Objective-Level Coverage

Each of the 53 objectives should have:

| Content Type | Minimum | Target | Maximum |
|-------------|---------|--------|---------|
| Flashcards | 5 | 10-15 | 20 |
| Practice Questions | 3 | 5-10 | 15 |
| Labs | 0 | 1-2 | 3 |

### Current Coverage Status (as of initial launch)

| Domain | Objectives | Flashcards | Questions | Labs |
|--------|-----------|------------|-----------|------|
| 1. Network Fundamentals | 13 | 45 | -- | 2 (subnetting-ipv4, cable-types) |
| 2. Network Access | 9 | 33 | -- | 2 (vlan-config, stp-basics) |
| 3. IP Connectivity | 9 | 35 | -- | 2 (ospf-config, static-routing) |
| 4. IP Services | 8 | 30 | -- | 1 (dhcp-config) |
| 5. Security Fundamentals | 7 | 28 | -- | 1 (acl-builder) |
| 6. Automation and Programmability | 7 | 28 | -- | 1 (python-automation) |

**Note:** The 199 flashcards cover all 53 objectives with 3-5 cards per objective. Full content population to meet per-objective targets (10-15 per objective) is part of the content development roadmap.

---

## Update and Maintenance Process

### Content Lifecycle

```
Draft --> Schema Validated --> Fact-Checked --> Coverage Audited --> Published
  ^                                                                    |
  |                                                                    v
  +------------------------- Review Cycle <------- Flagged for Update
```

### Triggers for Content Updates

| Trigger | Action | Priority |
|---------|--------|----------|
| Cisco exam blueprint update | Add/remove/modify objectives and all related content | Critical |
| IOS-XE version update | Verify commands, syntax, and feature availability | High |
| Protocol standard update | Update RFC references and protocol behavior descriptions | Medium |
| Student feedback / error reports | Correct inaccuracies, improve explanations | Medium |
| New Cisco networking feature | Add content for new exam-relevant topics | Low |
| Quarterly review cycle | Audit all content for accuracy and freshness | Routine |

### Content Review Schedule

| Frequency | Activity |
|-----------|----------|
| **Weekly** | Review flagged content issues and student reports |
| **Monthly** | Check for Cisco IOS/platform documentation updates |
| **Quarterly** | Full coverage audit and difficulty rebalancing |
| **Annually** | Complete blueprint alignment review |
| **On-demand** | Cisco exam blueprint revision triggers full content review |

### Version Control

- All content changes are tracked in the database with timestamps
- Content JSON files (when used for bulk import) are version-controlled in Git
- The `source_url` field on each content item traces back to the authoritative source
- Content validation scripts (`scripts/validate-docs.ts`) run in CI to detect gaps

### Quality Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Objective coverage | 100% of objectives | Validation script |
| Difficulty balance | 30/50/20 easy/medium/hard | Database query |
| Source URL presence | > 80% of items | Database query |
| Explanation coverage | 100% of questions | Schema validation |
| Student pass rate | > 70% on first attempt | Practice attempt analytics |
| Flashcard mastery rate | > 60% within 30 days | Flashcard progress analytics |
